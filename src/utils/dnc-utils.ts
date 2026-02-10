import * as fs from "fs/promises";

export type TaskStatus = "pending" | "in-progress" | "done";

export interface Task {
  id: string;
  goal: string;
  acceptance: string;
  status: TaskStatus;
  tasks: Task[];
}

/**
 * task 상태값이 유효한지 검증합니다.
 * @param status - 검증할 상태값
 * @returns 유효하면 true
 */
export function validateTaskStatus(status: string): status is TaskStatus {
  return status === "pending" || status === "in-progress" || status === "done";
}

/**
 * task ID 형식을 검증합니다.
 * - 영문만 허용 (a-z, 0-9, 하이픈)
 * - 하이픈 기준 10단어 이하
 * - kebab-case 형식
 * - 1-100자
 * @param taskId - 검증할 task ID
 * @returns 검증 결과 및 에러 메시지
 */
export function validateTaskId(taskId: string): {
  isValid: boolean;
  error?: string;
} {
  // 1. Empty check
  if (!taskId || taskId.trim() === "") {
    return { isValid: false, error: "task ID cannot be empty" };
  }

  // 2. Character validation (only a-z, 0-9, hyphens)
  if (!/^[a-z0-9-]+$/.test(taskId)) {
    return {
      isValid: false,
      error: "task ID must contain only lowercase letters, numbers, and hyphens",
    };
  }

  // 3. Length validation
  if (taskId.length < 1 || taskId.length > 100) {
    return {
      isValid: false,
      error: "task ID must be between 1 and 100 characters",
    };
  }

  // 4. Word count validation (split by hyphens)
  const words = taskId.split("-").filter((w) => w.length > 0);
  if (words.length > 10) {
    return {
      isValid: false,
      error: "task ID must not exceed 10 words (English only)",
    };
  }

  // 5. Check for double hyphens or leading/trailing hyphens
  if (taskId.startsWith("-") || taskId.endsWith("-") || taskId.includes("--")) {
    return {
      isValid: false,
      error: "task ID cannot start/end with hyphen or contain consecutive hyphens",
    };
  }

  return { isValid: true };
}

/**
 * task 파일 경로를 반환합니다.
 * @param taskId - task ID
 * @returns .dnc/{taskId}/task.json 경로
 */
export function getTaskPath(taskId: string): string {
  return `.dnc/${taskId}/task.json`;
}

/**
 * .dnc 디렉토리 구조를 생성합니다.
 * @param taskId - task ID
 */
export async function ensureDncDirectory(taskId: string): Promise<void> {
  await fs.mkdir(".dnc", { recursive: true });
  await fs.mkdir(`.dnc/${taskId}`, { recursive: true });
}

/**
 * task를 파일에 씁니다.
 * @param taskId - task ID
 * @param task - task 데이터
 */
export async function writeTask(taskId: string, task: Task): Promise<void> {
  const taskPath = getTaskPath(taskId);
  await fs.writeFile(taskPath, JSON.stringify(task, null, 2), "utf-8");
}

/**
 * task를 파일에서 읽습니다.
 * @param taskId - task ID
 * @returns task 데이터
 */
export async function readTask(taskId: string): Promise<Task> {
  const taskPath = getTaskPath(taskId);
  const content = await fs.readFile(taskPath, "utf-8");
  return JSON.parse(content) as Task;
}

/**
 * task가 존재하는지 확인합니다.
 * @param taskId - task ID
 * @returns 존재하면 true
 */
export async function taskExists(taskId: string): Promise<boolean> {
  try {
    await fs.access(getTaskPath(taskId));
    return true;
  } catch {
    return false;
  }
}

/**
 * task를 재귀적으로 찾습니다.
 * @param task - 탐색할 task
 * @param targetTaskId - 찾을 task ID
 * @returns 찾은 task 또는 null
 */
export function findTaskInTree(task: Task, targetTaskId: string): Task | null {
  if (task.id === targetTaskId) {
    return task;
  }

  for (const child of task.tasks) {
    const found = findTaskInTree(child, targetTaskId);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * task를 재귀적으로 업데이트합니다.
 * @param task - 탐색할 task
 * @param targetTaskId - 업데이트할 task ID
 * @param updates - 업데이트할 필드
 * @returns 업데이트 성공 여부
 */
export function updateTaskInTree(
  task: Task,
  targetTaskId: string,
  updates: { goal?: string; status?: TaskStatus; acceptance?: string }
): boolean {
  if (task.id === targetTaskId) {
    if (updates.goal !== undefined) {
      task.goal = updates.goal;
    }
    if (updates.status !== undefined) {
      task.status = updates.status;
    }
    if (updates.acceptance !== undefined) {
      task.acceptance = updates.acceptance;
    }
    return true;
  }

  for (const child of task.tasks) {
    if (updateTaskInTree(child, targetTaskId, updates)) {
      return true;
    }
  }

  return false;
}

/**
 * task를 재귀적으로 삭제합니다.
 * Root task는 삭제할 수 없습니다 (전체 디렉토리 삭제로만 처리).
 * @param task - 탐색할 task
 * @param targetTaskId - 삭제할 task ID
 * @returns 삭제 성공 여부
 */
export function deleteTaskInTree(task: Task, targetTaskId: string): boolean {
  // Root task는 삭제 불가
  if (task.id === targetTaskId) {
    return false;
  }

  // 직계 자식에서 삭제
  const initialLength = task.tasks.length;
  task.tasks = task.tasks.filter((child) => child.id !== targetTaskId);

  if (task.tasks.length < initialLength) {
    return true;
  }

  // 재귀적으로 하위 task 탐색
  for (const child of task.tasks) {
    if (deleteTaskInTree(child, targetTaskId)) {
      return true;
    }
  }

  return false;
}
