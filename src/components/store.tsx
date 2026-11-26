"use client";

/**
 * Single client store. Loads the workspace snapshot from /api/bootstrap once, applies optimistic
 * mutations locally, then reconciles with the server's response. On any failure it reloads the
 * snapshot so the UI never drifts from the database.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { todayKey } from "@/lib/dates";
import { buildScoreContext, scoreTask, type ScoreResult } from "@/lib/scoring";
import type { CategoryDTO, MilestoneDTO, ProjectDTO, SettingsDTO, SubcategoryDTO, TaskDTO, Workspace } from "@/lib/types";
import type { TaskInput } from "@/lib/validation";

type BulkAction = "update" | "complete" | "reopen" | "delete" | "restore" | "purge" | "archive" | "unarchive";
type TaskPatch = Partial<Omit<TaskInput, "checklist">> & { checklist?: { id?: string; text: string; done: boolean }[] };

async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

function applyTaskPatch(t: TaskDTO, p: TaskPatch): TaskDTO {
  const now = new Date().toISOString();
  const next: TaskDTO = { ...t, ...(p as Partial<TaskDTO>), updatedAt: now };
  if (p.checklist) next.checklist = p.checklist.map((c, i) => ({ id: c.id ?? uid(), text: c.text, done: c.done, sortOrder: i }));
  if (p.archived !== undefined) next.archivedAt = p.archived ? now : null;
  if (p.deleted !== undefined) next.deletedAt = p.deleted ? now : null;
  if (p.status === "completed" && t.status !== "completed") next.completedAt = now;
  if (p.status && p.status !== "completed") next.completedAt = null;
  delete (next as Partial<TaskDTO> & { archived?: boolean }).archived;
  delete (next as Partial<TaskDTO> & { deleted?: boolean }).deleted;
  return next;
}

function blankTask(input: TaskPatch & { title: string; id: string }): TaskDTO {
  const now = new Date().toISOString();
  return applyTaskPatch(
    {
      id: input.id, title: input.title, description: "", notes: "", categoryId: null, subcategoryId: null, projectId: null,
      milestoneId: null, parentId: null, status: "todo", priority: 3, importance: 3, urgency: 3, impact: 3, energy: "medium",
      manualScore: null, pinnedToday: false, myDayDate: null, delegatable: false, startDate: null, dueDate: null, dueTime: null,
      scheduledStart: null, scheduledEnd: null, estimateMin: null, actualMin: 0, tags: [], recurrence: null,
      recurrenceParentId: null, waitingOn: null, followUpDate: null, postponeCount: 0, sortOrder: 0, isDemo: false,
      createdAt: now, updatedAt: now, completedAt: null, archivedAt: null, deletedAt: null, checklist: [], dependsOn: [],
    },
    input,
  );
}

type Store = {
  ws: Workspace | null;
  error: string | null;
  scores: Map<string, ScoreResult>;
  today: string;
  reload: () => Promise<void>;
  // tasks
  createTask: (input: TaskPatch & { title: string }) => Promise<TaskDTO | undefined>;
  updateTask: (id: string, patch: TaskPatch) => Promise<void>;
  toggleComplete: (t: TaskDTO) => Promise<void>;
  bulk: (ids: string[], action: BulkAction, patch?: TaskPatch) => Promise<void>;
  purgeTask: (id: string) => Promise<void>;
  // categories
  saveCategory: (c: Partial<CategoryDTO> & { name: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  saveSubcategory: (s: Partial<SubcategoryDTO> & { name: string; categoryId: string }) => Promise<void>;
  deleteSubcategory: (id: string, categoryId: string) => Promise<void>;
  // projects
  saveProject: (p: Partial<ProjectDTO> & { archived?: boolean; deleted?: boolean }) => Promise<ProjectDTO | undefined>;
  purgeProject: (id: string) => Promise<void>;
  saveMilestone: (m: Partial<MilestoneDTO> & { projectId: string; completed?: boolean }) => Promise<void>;
  deleteMilestone: (id: string, projectId: string) => Promise<void>;
  // settings
  saveSettings: (s: Partial<SettingsDTO>) => Promise<void>;
  loadDemo: () => Promise<void>;
  removeDemo: () => Promise<void>;
  // UI
  editingId: string | null;
  openTask: (id: string | null) => void;
  quickAdd: { open: boolean; defaults?: TaskPatch };
  openQuickAdd: (defaults?: TaskPatch) => void;
  closeQuickAdd: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
};

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<{ open: boolean; defaults?: TaskPatch }>({ open: false });
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Empty until mounted: reading the clock during prerender is not allowed (cacheComponents).
  const [today, setToday] = useState("");

  const reload = useCallback(async () => {
    try {
      const data = await api<Workspace>("GET", "/api/bootstrap");
      setWs(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is read only on the client
    setToday(todayKey());
    void reload();
    // Roll "today" over at midnight so My Day and overdue badges stay correct.
    const t = setInterval(() => setToday(todayKey()), 60_000);
    return () => clearInterval(t);
  }, [reload]);

  /** Run a mutation; on error show a toast and resync from the server. */
  const guard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (e) {
        toast.error(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
        await reload();
        return undefined;
      }
    },
    [reload],
  );

  const setTasks = useCallback((fn: (tasks: TaskDTO[]) => TaskDTO[]) => {
    setWs((w) => (w ? { ...w, tasks: fn(w.tasks) } : w));
  }, []);
  const upsertTasks = useCallback(
    (list: TaskDTO[]) =>
      setTasks((tasks) => {
        const map = new Map(list.map((t) => [t.id, t]));
        const merged = tasks.map((t) => map.get(t.id) ?? t);
        for (const t of list) if (!tasks.some((x) => x.id === t.id)) merged.push(t);
        return merged;
      }),
    [setTasks],
  );

  const createTask = useCallback<Store["createTask"]>(
    async (input) => {
      const id = uid();
      const optimistic = blankTask({ ...input, id });
      setTasks((ts) => [...ts, optimistic]);
      return guard(async () => {
        const { task } = await api<{ task: TaskDTO }>("POST", "/api/tasks", { ...input, id });
        upsertTasks([task]);
        return task;
      });
    },
    [guard, setTasks, upsertTasks],
  );

  const updateTask = useCallback<Store["updateTask"]>(
    async (id, patch) => {
      setTasks((ts) => ts.map((t) => (t.id === id ? applyTaskPatch(t, patch) : t)));
      await guard(async () => {
        const r = await api<{ task: TaskDTO; spawned?: TaskDTO }>("PATCH", `/api/tasks/${id}`, patch);
        upsertTasks(r.spawned ? [r.task, r.spawned] : [r.task]);
        if (r.spawned) toast.success(`Next occurrence scheduled for ${r.spawned.dueDate}`);
      });
    },
    [guard, setTasks, upsertTasks],
  );

  const toggleComplete = useCallback<Store["toggleComplete"]>(
    async (t) => {
      const completing = t.status !== "completed";
      await updateTask(t.id, { status: completing ? "completed" : "todo" });
      if (completing) {
        toast.success("Task completed", {
          description: t.title,
          action: { label: "Undo", onClick: () => void updateTask(t.id, { status: t.status }) },
        });
      }
    },
    [updateTask],
  );

  const bulk = useCallback<Store["bulk"]>(
    async (ids, action, patch) => {
      if (!ids.length) return;
      const set = new Set(ids);
      const optimistic: Record<BulkAction, TaskPatch> = {
        update: patch ?? {},
        complete: { status: "completed" },
        reopen: { status: "todo" },
        delete: { deleted: true },
        restore: { deleted: false },
        archive: { archived: true },
        unarchive: { archived: false },
        purge: {},
      };
      if (action === "purge") setTasks((ts) => ts.filter((t) => !set.has(t.id)));
      else setTasks((ts) => ts.map((t) => (set.has(t.id) ? applyTaskPatch(t, optimistic[action]) : t)));
      await guard(async () => {
        const r = await api<{ tasks: TaskDTO[]; spawned: TaskDTO[] }>("POST", "/api/tasks/bulk", { ids, action, patch });
        upsertTasks([...r.tasks, ...r.spawned]);
      });
    },
    [guard, setTasks, upsertTasks],
  );

  const purgeTask = useCallback<Store["purgeTask"]>(
    async (id) => {
      setTasks((ts) => ts.filter((t) => t.id !== id && t.parentId !== id));
      await guard(() => api("DELETE", `/api/tasks/${id}`));
    },
    [guard, setTasks],
  );

  const setCategories = (fn: (c: CategoryDTO[]) => CategoryDTO[]) =>
    setWs((w) => (w ? { ...w, categories: fn(w.categories) } : w));
  const setProjects = (fn: (c: ProjectDTO[]) => ProjectDTO[]) => setWs((w) => (w ? { ...w, projects: fn(w.projects) } : w));

  const saveCategory = useCallback<Store["saveCategory"]>(
    async (c) => {
      await guard(async () => {
        const { id, name, color, icon, importance, sortOrder, hidden, pinned } = c;
        const body = { name, color, icon, importance, sortOrder, hidden, pinned };
        const r = id
          ? await api<{ category: CategoryDTO }>("PATCH", `/api/categories/${id}`, body)
          : await api<{ category: CategoryDTO }>("POST", "/api/categories", body);
        setCategories((cs) => (cs.some((x) => x.id === r.category.id) ? cs.map((x) => (x.id === r.category.id ? r.category : x)) : [...cs, r.category]));
      });
    },
    [guard],
  );

  const deleteCategory = useCallback<Store["deleteCategory"]>(
    async (id) => {
      setCategories((cs) => cs.filter((c) => c.id !== id));
      await guard(async () => {
        await api("DELETE", `/api/categories/${id}`);
        await reload(); // tasks/projects lose their category server-side
      });
    },
    [guard, reload],
  );

  const saveSubcategory = useCallback<Store["saveSubcategory"]>(
    async (s) => {
      await guard(async () => {
        const r = s.id
          ? await api<{ subcategory: SubcategoryDTO }>("PATCH", `/api/subcategories/${s.id}`, { name: s.name, hidden: s.hidden })
          : await api<{ subcategory: SubcategoryDTO }>("POST", "/api/subcategories", { name: s.name, categoryId: s.categoryId });
        setCategories((cs) =>
          cs.map((c) =>
            c.id !== s.categoryId
              ? c
              : {
                  ...c,
                  subcategories: c.subcategories.some((x) => x.id === r.subcategory.id)
                    ? c.subcategories.map((x) => (x.id === r.subcategory.id ? r.subcategory : x))
                    : [...c.subcategories, r.subcategory],
                },
          ),
        );
      });
    },
    [guard],
  );

  const deleteSubcategory = useCallback<Store["deleteSubcategory"]>(
    async (id, categoryId) => {
      setCategories((cs) => cs.map((c) => (c.id === categoryId ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== id) } : c)));
      setTasks((ts) => ts.map((t) => (t.subcategoryId === id ? { ...t, subcategoryId: null } : t)));
      await guard(() => api("DELETE", `/api/subcategories/${id}`));
    },
    [guard, setTasks],
  );

  const saveProject = useCallback<Store["saveProject"]>(
    async (p) => {
      return guard(async () => {
        const { id, name, description, categoryId, priority, importance, status, startDate, targetDate, notes, color, pinned, useWeightedMilestones, archived, deleted } = p;
        const body = { name, description, categoryId, priority, importance, status, startDate, targetDate, notes, color, pinned, useWeightedMilestones, archived, deleted };
        const r = id
          ? await api<{ project: ProjectDTO }>("PATCH", `/api/projects/${id}`, body)
          : await api<{ project: ProjectDTO }>("POST", "/api/projects", body);
        setProjects((ps) => (ps.some((x) => x.id === r.project.id) ? ps.map((x) => (x.id === r.project.id ? r.project : x)) : [...ps, r.project]));
        return r.project;
      });
    },
    [guard],
  );

  const purgeProject = useCallback<Store["purgeProject"]>(
    async (id) => {
      setProjects((ps) => ps.filter((p) => p.id !== id));
      setTasks((ts) => ts.map((t) => (t.projectId === id ? { ...t, projectId: null, milestoneId: null } : t)));
      await guard(() => api("DELETE", `/api/projects/${id}`));
    },
    [guard, setTasks],
  );

  const saveMilestone = useCallback<Store["saveMilestone"]>(
    async (m) => {
      await guard(async () => {
        const { id, projectId, title, dueDate, weight, sortOrder, completed } = m;
        const r = id
          ? await api<{ milestone: MilestoneDTO }>("PATCH", `/api/milestones/${id}`, { title, dueDate, weight, sortOrder, completed })
          : await api<{ milestone: MilestoneDTO }>("POST", "/api/milestones", { projectId, title, dueDate, weight, completed });
        setProjects((ps) =>
          ps.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  milestones: p.milestones.some((x) => x.id === r.milestone.id)
                    ? p.milestones.map((x) => (x.id === r.milestone.id ? r.milestone : x))
                    : [...p.milestones, r.milestone],
                },
          ),
        );
      });
    },
    [guard],
  );

  const deleteMilestone = useCallback<Store["deleteMilestone"]>(
    async (id, projectId) => {
      setProjects((ps) => ps.map((p) => (p.id === projectId ? { ...p, milestones: p.milestones.filter((m) => m.id !== id) } : p)));
      setTasks((ts) => ts.map((t) => (t.milestoneId === id ? { ...t, milestoneId: null } : t)));
      await guard(() => api("DELETE", `/api/milestones/${id}`));
    },
    [guard, setTasks],
  );

  const saveSettings = useCallback<Store["saveSettings"]>(
    async (s) => {
      setWs((w) => (w ? { ...w, settings: { ...w.settings, ...s } } : w));
      await guard(async () => {
        const { demoLoaded: _d, ...body } = s;
        void _d;
        const r = await api<{ settings: SettingsDTO }>("PATCH", "/api/settings", body);
        setWs((w) => (w ? { ...w, settings: r.settings } : w));
      });
    },
    [guard],
  );

  const loadDemo = useCallback(async () => {
    await guard(async () => {
      await api("POST", "/api/demo");
      await reload();
      toast.success("Demo data loaded");
    });
  }, [guard, reload]);

  const removeDemo = useCallback(async () => {
    await guard(async () => {
      await api("DELETE", "/api/demo");
      await reload();
      toast.success("Demo data removed");
    });
  }, [guard, reload]);

  const scores = useMemo(() => {
    const map = new Map<string, ScoreResult>();
    if (!ws) return map;
    const ctx = buildScoreContext(ws.tasks, ws.categories, ws.projects, ws.settings.energyLevel, ws.settings.scoringWeights);
    ctx.today = today;
    for (const t of ws.tasks) map.set(t.id, scoreTask(t, ctx));
    return map;
  }, [ws, today]);

  const value: Store = {
    ws,
    error,
    scores,
    today,
    reload,
    createTask,
    updateTask,
    toggleComplete,
    bulk,
    purgeTask,
    saveCategory,
    deleteCategory,
    saveSubcategory,
    deleteSubcategory,
    saveProject,
    purgeProject,
    saveMilestone,
    deleteMilestone,
    saveSettings,
    loadDemo,
    removeDemo,
    editingId,
    openTask: setEditingId,
    quickAdd,
    openQuickAdd: (defaults) => setQuickAdd({ open: true, defaults }),
    closeQuickAdd: () => setQuickAdd({ open: false }),
    paletteOpen,
    setPaletteOpen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
