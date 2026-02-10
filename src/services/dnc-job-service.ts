import fs from "fs/promises";
import path from "path";
import type { Task } from "../utils/dnc-utils.js";

export class DncJobService {
  private dncDir: string;

  constructor(dncDir?: string) {
    this.dncDir = dncDir || path.join(process.cwd(), ".dnc");
  }

  /**
   * .dnc 디렉토리에서 모든 root task를 읽어옵니다.
   */
  async getAllRootTasks(): Promise<Task[]> {
    try {
      // .dnc 디렉토리 확인
      const entries = await fs.readdir(this.dncDir, { withFileTypes: true });

      const tasks: Task[] = [];

      // 각 디렉토리에서 task.json 읽기
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const taskPath = path.join(this.dncDir, entry.name, "task.json");

          try {
            const content = await fs.readFile(taskPath, "utf-8");
            const task = JSON.parse(content) as Task;
            tasks.push(task);
          } catch {
            // 파일이 없거나 invalid JSON이면 스킵
            continue;
          }
        }
      }

      return tasks;
    } catch {
      // .dnc 디렉토리가 없으면 빈 배열 반환
      return [];
    }
  }

  /**
   * 특정 ID의 task를 찾아 반환합니다.
   */
  async getTaskById(taskId: string): Promise<Task | null> {
    const allTasks = await this.getAllRootTasks();

    // root task에서 찾기
    for (const task of allTasks) {
      if (task.id === taskId) {
        return task;
      }

      // 하위 작업에서 재귀적으로 찾기
      const found = this.findTaskInTree(task, taskId);
      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * task 트리에서 특정 ID의 task를 재귀적으로 찾습니다.
   */
  private findTaskInTree(task: Task, targetId: string): Task | null {
    if (task.id === targetId) {
      return task;
    }

    for (const childTask of task.tasks) {
      const found = this.findTaskInTree(childTask, targetId);
      if (found) {
        return found;
      }
    }

    return null;
  }
}
