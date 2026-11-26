import "server-only";
import { prisma } from "../db";
import { addDaysKey, todayKey } from "../dates";
import type { TaskInput } from "../validation";
import { createTask } from "./tasks";

/** Default life categories (from the spec). Created once, on first launch, as normal (non-demo) rows. */
export const DEFAULT_CATEGORIES: { name: string; color: string; icon: string; importance: number; subs: string[] }[] = [
  { name: "Business", color: "blue", icon: "Briefcase", importance: 4, subs: ["Clients", "Sales", "Operations", "Marketing"] },
  { name: "PhD & Research", color: "violet", icon: "GraduationCap", importance: 5, subs: ["Papers", "Experiments", "Literature", "Advisor meetings", "Prelim"] },
  { name: "Teaching", color: "amber", icon: "Presentation", importance: 3, subs: ["Grading", "Office hours", "Lecture prep"] },
  { name: "Career", color: "teal", icon: "Rocket", importance: 4, subs: ["Applications", "Networking", "Interviews"] },
  { name: "Side Projects", color: "fuchsia", icon: "Lightbulb", importance: 2, subs: ["Apps", "Writing"] },
  { name: "Personal & Family", color: "rose", icon: "Home", importance: 4, subs: ["Family", "Home", "Errands"] },
  { name: "Finance", color: "emerald", icon: "Wallet", importance: 3, subs: ["Bills", "Taxes", "Savings"] },
  { name: "Health", color: "red", icon: "HeartPulse", importance: 4, subs: ["Exercise", "Appointments", "Sleep"] },
  { name: "Learning", color: "sky", icon: "BookOpen", importance: 3, subs: ["Courses", "Reading"] },
];

export async function ensureDefaults() {
  await prisma.settings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  const count = await prisma.category.count();
  if (count > 0) return;
  for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
    await prisma.category.create({
      data: {
        name: c.name,
        color: c.color,
        icon: c.icon,
        importance: c.importance,
        sortOrder: i,
        subcategories: { create: c.subs.map((name, j) => ({ name, sortOrder: j })) },
      },
    });
  }
}

export async function loadDemo() {
  await ensureDefaults();
  await removeDemo();
  const cats = await prisma.category.findMany({ include: { subcategories: true } });
  const cat = (name: string) => cats.find((c) => c.name === name);
  const sub = (catName: string, subName: string) => cat(catName)?.subcategories.find((s) => s.name === subName)?.id ?? null;
  const t = todayKey();
  const d = (n: number) => addDaysKey(t, n);

  const dissertation = await prisma.project.create({
    data: {
      name: "Dissertation chapter 3",
      description: "Write and submit the third chapter: methods and results for the main study.",
      categoryId: cat("PhD & Research")?.id,
      priority: 1,
      importance: 5,
      status: "active",
      startDate: d(-30),
      targetDate: d(25),
      pinned: true,
      isDemo: true,
      milestones: {
        create: [
          { title: "Outline approved by advisor", dueDate: d(-14), completedAt: new Date(), sortOrder: 0, isDemo: true },
          { title: "Results section drafted", dueDate: d(6), sortOrder: 1, isDemo: true },
          { title: "Full draft to committee", dueDate: d(25), sortOrder: 2, isDemo: true },
        ],
      },
    },
    include: { milestones: true },
  });
  const course = await prisma.project.create({
    data: {
      name: "Spring course prep",
      description: "Prepare syllabus, slides and first three labs.",
      categoryId: cat("Teaching")?.id,
      priority: 3,
      importance: 3,
      status: "planning",
      targetDate: d(40),
      isDemo: true,
      milestones: {
        create: [
          { title: "Syllabus final", dueDate: d(14), sortOrder: 0, isDemo: true },
          { title: "Labs 1–3 ready", dueDate: d(35), sortOrder: 1, isDemo: true },
        ],
      },
    },
    include: { milestones: true },
  });
  const client = await prisma.project.create({
    data: {
      name: "Client dashboard delivery",
      description: "Analytics dashboard for a consulting client.",
      categoryId: cat("Business")?.id,
      priority: 2,
      importance: 4,
      status: "active",
      targetDate: d(10),
      isDemo: true,
      milestones: { create: [{ title: "Prototype review", dueDate: d(3), sortOrder: 0, isDemo: true }] },
    },
    include: { milestones: true },
  });

  const ms = (p: typeof dissertation, i: number) => p.milestones.sort((a, b) => a.sortOrder - b.sortOrder)[i]?.id ?? null;
  const pid = (p: { id: string }) => p.id;

  const tasks: TaskInput[] = [
    { title: "Run final regression models for chapter 3", categoryId: cat("PhD & Research")?.id, subcategoryId: sub("PhD & Research", "Experiments"), projectId: pid(dissertation), milestoneId: ms(dissertation, 1), priority: 1, importance: 5, urgency: 4, impact: 5, energy: "high", dueDate: d(2), estimateMin: 180, status: "in_progress", pinnedToday: true, myDayDate: t, tags: ["deep-work"] },
    { title: "Write results section draft", categoryId: cat("PhD & Research")?.id, subcategoryId: sub("PhD & Research", "Papers"), projectId: pid(dissertation), milestoneId: ms(dissertation, 1), priority: 2, importance: 5, urgency: 3, impact: 5, energy: "high", dueDate: d(6), estimateMin: 240, status: "todo", tags: ["writing"] },
    { title: "Email advisor with progress update", categoryId: cat("PhD & Research")?.id, subcategoryId: sub("PhD & Research", "Advisor meetings"), projectId: pid(dissertation), priority: 2, importance: 4, urgency: 4, impact: 3, energy: "low", dueDate: d(0), estimateMin: 15, status: "todo", pinnedToday: true, myDayDate: t },
    { title: "Read 3 papers on causal inference", categoryId: cat("PhD & Research")?.id, subcategoryId: sub("PhD & Research", "Literature"), priority: 3, importance: 3, urgency: 2, impact: 3, energy: "medium", dueDate: d(9), estimateMin: 120, status: "todo", tags: ["reading"] },
    { title: "Grade midterm exams", categoryId: cat("Teaching")?.id, subcategoryId: sub("Teaching", "Grading"), priority: 2, importance: 3, urgency: 5, impact: 2, energy: "medium", dueDate: d(-1), estimateMin: 150, status: "todo" },
    { title: "Draft course syllabus", categoryId: cat("Teaching")?.id, subcategoryId: sub("Teaching", "Lecture prep"), projectId: pid(course), milestoneId: ms(course, 0), priority: 3, importance: 3, urgency: 2, impact: 3, energy: "medium", dueDate: d(12), estimateMin: 90, status: "todo" },
    { title: "Hold office hours", categoryId: cat("Teaching")?.id, subcategoryId: sub("Teaching", "Office hours"), priority: 3, importance: 3, urgency: 3, impact: 2, energy: "medium", dueDate: d(1), dueTime: "14:00", estimateMin: 60, status: "todo", recurrence: { freq: "weekly", interval: 1 } },
    { title: "Send prototype to client for review", categoryId: cat("Business")?.id, subcategoryId: sub("Business", "Clients"), projectId: pid(client), milestoneId: ms(client, 0), priority: 1, importance: 4, urgency: 5, impact: 4, energy: "medium", dueDate: d(3), estimateMin: 45, status: "todo" },
    { title: "Invoice last month's consulting hours", categoryId: cat("Business")?.id, subcategoryId: sub("Business", "Operations"), priority: 2, importance: 4, urgency: 4, impact: 3, energy: "low", dueDate: d(-3), estimateMin: 20, status: "todo" },
    { title: "Waiting on client feedback on scope", categoryId: cat("Business")?.id, projectId: pid(client), priority: 3, importance: 3, urgency: 3, impact: 3, energy: "low", status: "waiting", waitingOn: "Client PM", followUpDate: d(2) },
    { title: "Update CV with new publication", categoryId: cat("Career")?.id, subcategoryId: sub("Career", "Applications"), priority: 3, importance: 4, urgency: 2, impact: 4, energy: "medium", dueDate: d(14), estimateMin: 45, status: "todo" },
    { title: "Apply to summer research internship", categoryId: cat("Career")?.id, subcategoryId: sub("Career", "Applications"), priority: 2, importance: 5, urgency: 3, impact: 5, energy: "high", dueDate: d(18), estimateMin: 180, status: "todo", tags: ["deadline"] },
    { title: "Pay electricity bill", categoryId: cat("Finance")?.id, subcategoryId: sub("Finance", "Bills"), priority: 2, importance: 3, urgency: 5, impact: 2, energy: "low", dueDate: d(1), estimateMin: 5, status: "todo", recurrence: { freq: "monthly", interval: 1 } },
    { title: "Gather documents for taxes", categoryId: cat("Finance")?.id, subcategoryId: sub("Finance", "Taxes"), priority: 4, importance: 3, urgency: 1, impact: 3, energy: "low", dueDate: d(45), estimateMin: 60, status: "todo" },
    { title: "Gym — strength session", categoryId: cat("Health")?.id, subcategoryId: sub("Health", "Exercise"), priority: 3, importance: 4, urgency: 2, impact: 4, energy: "high", dueDate: d(0), estimateMin: 60, status: "todo", recurrence: { freq: "weekly", interval: 1, byWeekday: [1, 3, 5] } },
    { title: "Book annual physical", categoryId: cat("Health")?.id, subcategoryId: sub("Health", "Appointments"), priority: 3, importance: 3, urgency: 2, impact: 3, energy: "low", estimateMin: 10, status: "inbox" },
    { title: "Call parents", categoryId: cat("Personal & Family")?.id, subcategoryId: sub("Personal & Family", "Family"), priority: 2, importance: 5, urgency: 2, impact: 4, energy: "low", dueDate: d(2), estimateMin: 30, status: "todo" },
    { title: "Fix leaking kitchen tap", categoryId: cat("Personal & Family")?.id, subcategoryId: sub("Personal & Family", "Home"), priority: 4, importance: 2, urgency: 2, impact: 2, energy: "medium", estimateMin: 45, status: "inbox", delegatable: true },
    { title: "Finish online course module on transformers", categoryId: cat("Learning")?.id, subcategoryId: sub("Learning", "Courses"), priority: 4, importance: 3, urgency: 1, impact: 3, energy: "medium", dueDate: d(20), estimateMin: 90, status: "todo" },
    { title: "Sketch idea for habit-tracker side app", categoryId: cat("Side Projects")?.id, subcategoryId: sub("Side Projects", "Apps"), priority: 5, importance: 2, urgency: 1, impact: 2, energy: "medium", estimateMin: 60, status: "inbox" },
    { title: "Organize research notes folder", priority: 4, importance: 2, urgency: 1, impact: 2, energy: "low", estimateMin: 30, status: "inbox" },
    { title: "Submit conference reviewer form", categoryId: cat("PhD & Research")?.id, priority: 3, importance: 3, urgency: 3, impact: 2, energy: "low", dueDate: d(-6), estimateMin: 20, status: "completed" },
    { title: "Set up experiment tracking spreadsheet", categoryId: cat("PhD & Research")?.id, projectId: pid(dissertation), priority: 3, importance: 3, urgency: 2, impact: 3, energy: "medium", estimateMin: 40, status: "completed" },
  ];
  for (const input of tasks) await createTask(input, true);

  // Dependency: results draft waits on the regression models.
  const all = await prisma.task.findMany({ where: { isDemo: true }, select: { id: true, title: true } });
  const find = (prefix: string) => all.find((x) => x.title.startsWith(prefix))?.id;
  const models = find("Run final regression");
  const draft = find("Write results section");
  if (models && draft) await prisma.taskDependency.create({ data: { taskId: draft, dependsOnId: models } });
  // Spread completion dates over the past week so the dashboard has history.
  const done = await prisma.task.findMany({ where: { isDemo: true, status: "completed" } });
  for (const [i, x] of done.entries()) {
    await prisma.task.update({ where: { id: x.id }, data: { completedAt: new Date(Date.now() - (i * 2 + 1) * 86400000) } });
  }
  await prisma.settings.update({ where: { id: "singleton" }, data: { demoLoaded: true } });
}

export async function removeDemo() {
  await prisma.$transaction([
    prisma.task.deleteMany({ where: { isDemo: true } }),
    prisma.milestone.deleteMany({ where: { isDemo: true } }),
    prisma.project.deleteMany({ where: { isDemo: true } }),
    prisma.subcategory.deleteMany({ where: { isDemo: true } }),
    prisma.category.deleteMany({ where: { isDemo: true } }),
    prisma.settings.update({ where: { id: "singleton" }, data: { demoLoaded: false } }),
  ]);
}
