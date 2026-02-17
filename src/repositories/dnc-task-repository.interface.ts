export type TaskStatus =
  | "pending"
  | "init"
  | "accept"
  | "in-progress"
  | "done"
  | "delete"
  | "hold"
  | "split";

export interface Task {
  id: string;
  goal: string;
  acceptance: string;
  status: TaskStatus;
  tasks: Task[];
}

export interface IDncTaskRepository {
  ensureReady(): Promise<void>;
  rootTaskExists(rootTaskId: string): Promise<boolean>;
  findRootTask(rootTaskId: string): Promise<Task>;
  saveRootTask(rootTaskId: string, task: Task): Promise<void>;
  deleteRootTask(rootTaskId: string): Promise<void>;
  listRootTaskIds(): Promise<string[]>;
}
