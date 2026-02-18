import { findTaskInTree } from "../utils/dnc-utils.js";
import type { IDncTaskRepository, Task } from "../repositories/index.js";

export class DncJobService {
  constructor(private readonly repository: IDncTaskRepository) {}

  /**
   * 모든 root task를 읽어옵니다.
   */
  async getAllRootTasks(): Promise<Task[]> {
    const taskIds = await this.repository.listRootTaskIds();
    const tasks: Task[] = [];

    for (const taskId of taskIds) {
      try {
        const task = await this.repository.findRootTask(taskId);
        tasks.push(task);
      } catch {
        // 파일이 없거나 invalid JSON이면 스킵
        continue;
      }
    }

    return tasks;
  }

  /**
   * 모든 root task를 done / active 로 분리하여 반환합니다.
   */
  async getAllRootTasksSplit(): Promise<{ doneJobs: Task[]; activeJobs: Task[] }> {
    const tasks = await this.getAllRootTasks();
    return {
      doneJobs: tasks.filter((t) => t.status === "done"),
      activeJobs: tasks.filter((t) => t.status !== "done"),
    };
  }

  /**
   * 특정 ID의 task를 찾아 반환합니다.
   */
  async getTaskById(taskId: string): Promise<Task | null> {
    const allTasks = await this.getAllRootTasks();

    for (const task of allTasks) {
      if (task.id === taskId) {
        return task;
      }

      const found = findTaskInTree(task, taskId);
      if (found) {
        return found;
      }
    }

    return null;
  }
}
