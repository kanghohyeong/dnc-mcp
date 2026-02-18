export type TaskStatus =
  | "pending"
  | "init"
  | "accept"
  | "in-progress"
  | "done"
  | "delete"
  | "hold"
  | "split"
  | "modify";

export interface Task {
  id: string;
  goal: string;
  acceptance: string;
  status: TaskStatus;
  tasks: Task[];
  additionalInstructions?: string;
}

/**
 * task 상태값이 유효한지 검증합니다.
 * @param status - 검증할 상태값
 * @returns 유효하면 true
 */
export function validateTaskStatus(status: string): status is TaskStatus {
  return ["init", "accept", "in-progress", "done", "delete", "hold", "split", "modify"].includes(
    status
  );
}

/**
 * 상태 전이가 권장 플로우를 따르는지 검증합니다.
 * @param fromStatus - 현재 상태
 * @param toStatus - 목표 상태
 * @returns 검증 결과 및 경고 메시지
 */
export function validateStatusTransition(
  fromStatus: TaskStatus,
  toStatus: TaskStatus
): { isValid: boolean; warning?: string } {
  const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
    pending: [],
    init: ["accept", "delete", "hold", "split", "modify"],
    accept: ["in-progress", "hold", "modify"],
    "in-progress": ["done", "hold"],
    done: [],
    delete: [],
    hold: ["init", "accept", "modify"],
    split: ["init"],
    modify: ["accept", "delete", "hold", "split"],
  };

  const allowed = allowedTransitions[fromStatus] || [];

  if (!allowed.includes(toStatus)) {
    return {
      isValid: false,
      warning: `비권장 상태 전이: ${fromStatus} → ${toStatus}. 권장 전이: ${allowed.join(", ") || "없음"}`,
    };
  }

  return { isValid: true };
}

/**
 * 기존 "pending" 상태를 "init"으로 마이그레이션합니다.
 * @param task - 마이그레이션할 task
 */
export function migratePendingToInit(task: Task): void {
  if (task.status === "pending") {
    task.status = "init";
  }
  task.tasks.forEach(migratePendingToInit);
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
  updates: {
    goal?: string;
    status?: TaskStatus;
    acceptance?: string;
    additionalInstructions?: string;
  }
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
    if (updates.additionalInstructions !== undefined) {
      task.additionalInstructions = updates.additionalInstructions;
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
