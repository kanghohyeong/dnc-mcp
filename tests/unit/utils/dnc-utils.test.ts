import { describe, it, expect } from "vitest";
import {
  validateTaskStatus,
  validateStatusTransition,
  migratePendingToInit,
  validateTaskId,
  findTaskInTree,
  updateTaskInTree,
  deleteTaskInTree,
  type Task,
} from "../../../src/utils/dnc-utils.js";

describe("dnc-utils", () => {
  describe("validateTaskStatus", () => {
    it("should return true for all valid statuses", () => {
      expect(validateTaskStatus("init")).toBe(true);
      expect(validateTaskStatus("accept")).toBe(true);
      expect(validateTaskStatus("in-progress")).toBe(true);
      expect(validateTaskStatus("done")).toBe(true);
      expect(validateTaskStatus("delete")).toBe(true);
      expect(validateTaskStatus("hold")).toBe(true);
      expect(validateTaskStatus("split")).toBe(true);
    });

    it("should return false for invalid statuses including pending", () => {
      expect(validateTaskStatus("pending")).toBe(false);
      expect(validateTaskStatus("invalid")).toBe(false);
      expect(validateTaskStatus("")).toBe(false);
      expect(validateTaskStatus("PENDING")).toBe(false);
    });
  });

  describe("validateStatusTransition", () => {
    describe("normal flow", () => {
      it("should allow init -> accept", () => {
        const result = validateStatusTransition("init", "accept");
        expect(result.isValid).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it("should allow accept -> in-progress", () => {
        const result = validateStatusTransition("accept", "in-progress");
        expect(result.isValid).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it("should allow in-progress -> done", () => {
        const result = validateStatusTransition("in-progress", "done");
        expect(result.isValid).toBe(true);
        expect(result.warning).toBeUndefined();
      });
    });

    describe("special transitions from init", () => {
      it("should allow init -> delete", () => {
        const result = validateStatusTransition("init", "delete");
        expect(result.isValid).toBe(true);
      });

      it("should allow init -> hold", () => {
        const result = validateStatusTransition("init", "hold");
        expect(result.isValid).toBe(true);
      });

      it("should allow init -> split", () => {
        const result = validateStatusTransition("init", "split");
        expect(result.isValid).toBe(true);
      });
    });

    describe("hold recovery", () => {
      it("should allow hold -> init", () => {
        const result = validateStatusTransition("hold", "init");
        expect(result.isValid).toBe(true);
      });

      it("should allow hold -> accept", () => {
        const result = validateStatusTransition("hold", "accept");
        expect(result.isValid).toBe(true);
      });

      it("should NOT allow hold -> in-progress", () => {
        const result = validateStatusTransition("hold", "in-progress");
        expect(result.isValid).toBe(false);
        expect(result.warning).toContain("비권장 상태 전이");
      });
    });

    describe("invalid transitions", () => {
      it("should warn for done -> any status", () => {
        const result = validateStatusTransition("done", "init");
        expect(result.isValid).toBe(false);
        expect(result.warning).toBeDefined();
      });

      it("should warn for delete -> any status", () => {
        const result = validateStatusTransition("delete", "init");
        expect(result.isValid).toBe(false);
        expect(result.warning).toBeDefined();
      });

      it("should warn for split -> accept (should go to init first)", () => {
        const result = validateStatusTransition("split", "accept");
        expect(result.isValid).toBe(false);
        expect(result.warning).toBeDefined();
      });
    });
  });

  describe("migratePendingToInit", () => {
    it("should migrate pending to init", () => {
      const task = {
        id: "test",
        goal: "Test",
        acceptance: "Done",
        status: "pending",
        tasks: [],
      } as Task;

      migratePendingToInit(task);
      expect(task.status).toBe("init");
    });

    it("should migrate nested tasks recursively", () => {
      const task = {
        id: "root",
        goal: "Root",
        acceptance: "Done",
        status: "pending",
        tasks: [
          {
            id: "child",
            goal: "Child",
            acceptance: "Done",
            status: "pending",
            tasks: [],
          },
        ],
      } as Task;

      migratePendingToInit(task);
      expect(task.status).toBe("init");
      expect(task.tasks[0].status).toBe("init");
    });

    it("should not change non-pending statuses", () => {
      const task: Task = {
        id: "test",
        goal: "Test",
        acceptance: "Done",
        status: "done",
        tasks: [],
      };

      migratePendingToInit(task);
      expect(task.status).toBe("done");
    });

    it("should handle deeply nested tasks", () => {
      const task = {
        id: "root",
        goal: "Root",
        acceptance: "Done",
        status: "pending",
        tasks: [
          {
            id: "child-1",
            goal: "Child 1",
            acceptance: "Done",
            status: "in-progress",
            tasks: [
              {
                id: "grandchild",
                goal: "Grandchild",
                acceptance: "Done",
                status: "pending",
                tasks: [],
              },
            ],
          },
        ],
      } as Task;

      migratePendingToInit(task);
      expect(task.status).toBe("init");
      expect(task.tasks[0].status).toBe("in-progress");
      expect(task.tasks[0].tasks[0].status).toBe("init");
    });
  });

  describe("validateTaskId", () => {
    it("should accept valid task ID with 3 words", () => {
      const result = validateTaskId("implement-user-auth");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid task ID with numbers", () => {
      const result = validateTaskId("fix-bug-123");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid task ID with exactly 10 words", () => {
      const result = validateTaskId("one-two-three-four-five-six-seven-eight-nine-ten");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject task ID with more than 10 words", () => {
      const result = validateTaskId("one-two-three-four-five-six-seven-eight-nine-ten-eleven");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("10 words");
    });

    it("should reject task ID with uppercase letters", () => {
      const result = validateTaskId("Implement-Auth");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("lowercase");
    });

    it("should reject task ID with underscores", () => {
      const result = validateTaskId("implement_auth");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("lowercase letters, numbers, and hyphens");
    });

    it("should reject task ID with spaces", () => {
      const result = validateTaskId("implement auth");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("lowercase letters, numbers, and hyphens");
    });

    it("should reject empty task ID", () => {
      const result = validateTaskId("");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("should reject task ID with leading hyphen", () => {
      const result = validateTaskId("-implement");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot start/end with hyphen");
    });

    it("should reject task ID with trailing hyphen", () => {
      const result = validateTaskId("implement-");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot start/end with hyphen");
    });

    it("should reject task ID with consecutive hyphens", () => {
      const result = validateTaskId("implement--auth");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("consecutive hyphens");
    });
  });

  describe("findTaskInTree", () => {
    it("should find root task", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Root done",
        status: "pending",
        tasks: [],
      };

      const found = findTaskInTree(task, "root-task");
      expect(found).toEqual(task);
    });

    it("should find nested child task", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Root done",
        status: "pending",
        tasks: [
          {
            id: "child-task",
            goal: "Child",
            acceptance: "Child done",
            status: "pending",
            tasks: [
              {
                id: "grandchild-task",
                goal: "Grandchild",
                acceptance: "Grandchild done",
                status: "pending",
                tasks: [],
              },
            ],
          },
        ],
      };

      const found = findTaskInTree(task, "grandchild-task");
      expect(found).not.toBeNull();
      expect(found?.id).toBe("grandchild-task");
    });

    it("should return null for non-existent task", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Root done",
        status: "pending",
        tasks: [],
      };

      const found = findTaskInTree(task, "non-existent");
      expect(found).toBeNull();
    });

    it("should handle empty tasks array", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Root done",
        status: "pending",
        tasks: [],
      };

      const found = findTaskInTree(task, "child-task");
      expect(found).toBeNull();
    });
  });

  describe("updateTaskInTree", () => {
    it("should update root task goal", () => {
      const task: Task = {
        id: "root-task",
        goal: "Old Goal",
        acceptance: "Done",
        status: "pending",
        tasks: [],
      };

      const updated = updateTaskInTree(task, "root-task", { goal: "New Goal" });
      expect(updated).toBe(true);
      expect(task.goal).toBe("New Goal");
    });

    it("should update child task status", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Root done",
        status: "pending",
        tasks: [
          {
            id: "child-task",
            goal: "Child",
            acceptance: "Child done",
            status: "pending",
            tasks: [],
          },
        ],
      };

      const updated = updateTaskInTree(task, "child-task", { status: "done" });
      expect(updated).toBe(true);
      expect(task.tasks[0].status).toBe("done");
    });

    it("should update acceptance field", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Old acceptance",
        status: "pending",
        tasks: [],
      };

      const updated = updateTaskInTree(task, "root-task", {
        acceptance: "New acceptance",
      });
      expect(updated).toBe(true);
      expect(task.acceptance).toBe("New acceptance");
    });

    it("should return false for non-existent task", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Done",
        status: "pending",
        tasks: [],
      };

      const updated = updateTaskInTree(task, "non-existent", { goal: "New" });
      expect(updated).toBe(false);
    });

    it("should update additionalInstructions on root task", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Done",
        status: "init",
        tasks: [],
      };

      const updated = updateTaskInTree(task, "root-task", {
        additionalInstructions: "추가 지침 내용입니다.",
      });
      expect(updated).toBe(true);
      expect(task.additionalInstructions).toBe("추가 지침 내용입니다.");
    });

    it("should update additionalInstructions on child task", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Done",
        status: "init",
        tasks: [
          {
            id: "child-task",
            goal: "Child",
            acceptance: "Child done",
            status: "init",
            tasks: [],
          },
        ],
      };

      const updated = updateTaskInTree(task, "child-task", {
        additionalInstructions: "서브태스크 추가 지침",
      });
      expect(updated).toBe(true);
      expect(task.tasks[0].additionalInstructions).toBe("서브태스크 추가 지침");
    });

    it("should not change additionalInstructions when not provided", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Done",
        status: "init",
        additionalInstructions: "기존 지침",
        tasks: [],
      };

      const updated = updateTaskInTree(task, "root-task", { goal: "New Goal" });
      expect(updated).toBe(true);
      expect(task.additionalInstructions).toBe("기존 지침");
    });

    it("should update status and additionalInstructions together", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Done",
        status: "init",
        tasks: [],
      };

      const updated = updateTaskInTree(task, "root-task", {
        status: "in-progress",
        additionalInstructions: "동시 업데이트 지침",
      });
      expect(updated).toBe(true);
      expect(task.status).toBe("in-progress");
      expect(task.additionalInstructions).toBe("동시 업데이트 지침");
    });
  });

  describe("deleteTaskInTree", () => {
    it("should delete child task from array", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Root done",
        status: "pending",
        tasks: [
          {
            id: "child-task",
            goal: "Child",
            acceptance: "Child done",
            status: "pending",
            tasks: [],
          },
        ],
      };

      const deleted = deleteTaskInTree(task, "child-task");
      expect(deleted).toBe(true);
      expect(task.tasks).toHaveLength(0);
    });

    it("should return false for non-existent task", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Done",
        status: "pending",
        tasks: [],
      };

      const deleted = deleteTaskInTree(task, "non-existent");
      expect(deleted).toBe(false);
    });

    it("should not delete root task", () => {
      const task: Task = {
        id: "root-task",
        goal: "Root",
        acceptance: "Done",
        status: "pending",
        tasks: [],
      };

      const deleted = deleteTaskInTree(task, "root-task");
      expect(deleted).toBe(false);
    });
  });
});
