import type { TaskStatus } from "./constants";
import type { RecurrenceRule } from "./recurrence";

export type ChecklistItemDTO = { id: string; text: string; done: boolean; sortOrder: number };

export type TaskDTO = {
  id: string;
  title: string;
  description: string;
  notes: string;
  categoryId: string | null;
  subcategoryId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  parentId: string | null;
  status: TaskStatus;
  priority: number;
  importance: number;
  urgency: number;
  impact: number;
  energy: "low" | "medium" | "high";
  manualScore: number | null;
  pinnedToday: boolean;
  myDayDate: string | null;
  delegatable: boolean;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  estimateMin: number | null;
  actualMin: number;
  tags: string[];
  recurrence: RecurrenceRule | null;
  recurrenceParentId: string | null;
  waitingOn: string | null;
  followUpDate: string | null;
  postponeCount: number;
  sortOrder: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  checklist: ChecklistItemDTO[];
  dependsOn: string[];
};

export type SubcategoryDTO = {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  hidden: boolean;
  isDemo: boolean;
};

export type CategoryDTO = {
  id: string;
  name: string;
  color: string;
  icon: string;
  importance: number;
  sortOrder: number;
  hidden: boolean;
  pinned: boolean;
  isDemo: boolean;
  subcategories: SubcategoryDTO[];
};

export type MilestoneDTO = {
  id: string;
  projectId: string;
  title: string;
  dueDate: string | null;
  weight: number;
  sortOrder: number;
  completedAt: string | null;
  isDemo: boolean;
};

export type ProjectDTO = {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  priority: number;
  importance: number;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  notes: string;
  color: string | null;
  icon: string;
  pinned: boolean;
  useWeightedMilestones: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  milestones: MilestoneDTO[];
};

export type SettingsDTO = {
  displayName: string;
  workdayStart: string;
  workdayEnd: string;
  dailyCapacityMin: number;
  energyLevel: "low" | "medium" | "high";
  weekStartsOn: number;
  scoringWeights: Record<string, number>;
  demoLoaded: boolean;
};

export type SavedViewDTO = {
  id: string;
  name: string;
  icon: string;
  filters: TaskFilter;
  sort: string;
  pinned: boolean;
};

export type DailyNoteDTO = { date: string; content: string };

export type Workspace = {
  settings: SettingsDTO;
  categories: CategoryDTO[];
  projects: ProjectDTO[];
  tasks: TaskDTO[];
  views: SavedViewDTO[];
  dailyNotes: DailyNoteDTO[];
};

export type TaskFilter = {
  search?: string;
  categoryIds?: string[];
  projectIds?: string[];
  priorities?: number[];
  statuses?: string[];
  energy?: string[];
  maxMinutes?: number;
  due?: "overdue" | "today" | "tomorrow" | "week" | "next7" | "next30" | "none" | "any";
  tag?: string;
  highPriority?: boolean;
  waiting?: boolean;
  includeCompleted?: boolean;
};
