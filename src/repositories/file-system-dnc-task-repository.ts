import { promises as fs } from "fs";
import path from "path";
import type { IDncTaskRepository, Task } from "./dnc-task-repository.interface.js";

export class FileSystemDncTaskRepository implements IDncTaskRepository {
  private readonly dncDir: string;

  constructor(dncDir?: string) {
    this.dncDir = dncDir ?? path.join(process.cwd(), ".dnc");
  }

  async ensureReady(): Promise<void> {
    await fs.mkdir(this.dncDir, { recursive: true });
  }

  async rootTaskExists(rootTaskId: string): Promise<boolean> {
    try {
      await fs.access(this.getTaskPath(rootTaskId));
      return true;
    } catch {
      return false;
    }
  }

  async findRootTask(rootTaskId: string): Promise<Task> {
    const taskPath = this.getTaskPath(rootTaskId);
    const content = await fs.readFile(taskPath, "utf-8");
    const task = JSON.parse(content) as Task;
    this.migratePendingToInit(task);
    return task;
  }

  async saveRootTask(rootTaskId: string, task: Task): Promise<void> {
    await fs.mkdir(path.join(this.dncDir, rootTaskId), { recursive: true });
    const taskPath = this.getTaskPath(rootTaskId);
    await fs.writeFile(taskPath, JSON.stringify(task, null, 2), "utf-8");
  }

  async deleteRootTask(rootTaskId: string): Promise<void> {
    await fs.rm(path.join(this.dncDir, rootTaskId), { recursive: true, force: true });
  }

  async listRootTaskIds(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.dncDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private getTaskPath(rootTaskId: string): string {
    return path.join(this.dncDir, rootTaskId, "task.json");
  }

  private migratePendingToInit(task: Task): void {
    if (task.status === "pending") {
      task.status = "init";
    }
    task.tasks.forEach((child) => this.migratePendingToInit(child));
  }
}
