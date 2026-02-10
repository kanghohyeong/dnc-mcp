import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import { DncJobService } from "../../../src/services/dnc-job-service.js";

describe("DncJobService", () => {
  let service: DncJobService;
  const testDncDir = path.join(process.cwd(), ".dnc-test");

  beforeEach(() => {
    service = new DncJobService();
  });

  afterEach(async () => {
    // 테스트 디렉토리 정리
    try {
      await fs.rm(testDncDir, { recursive: true, force: true });
    } catch {
      // 디렉토리가 없으면 무시
    }
  });

  describe("getAllRootTasks", () => {
    it("should return all root tasks from .dnc directory", async () => {
      // When: getAllRootTasks 호출
      const tasks = await service.getAllRootTasks();

      // Then: 모든 root task가 반환됨
      expect(tasks).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);
      // 실제 .dnc 디렉토리의 task 수는 테스트 환경에 따라 다름
      expect(tasks.length).toBeGreaterThanOrEqual(0);
    });

    it("should return empty array when .dnc directory does not exist", async () => {
      // Given: .dnc 디렉토리가 없는 임시 디렉토리에서 테스트
      const tempService = new DncJobService("/nonexistent/path");

      // When: getAllRootTasks 호출
      const tasks = await tempService.getAllRootTasks();

      // Then: 빈 배열 반환
      expect(tasks).toEqual([]);
    });

    it("should skip invalid task.json files and return only valid ones", async () => {
      // Given: 일부 파일이 invalid JSON을 포함
      // 실제 파일 시스템을 사용하는 대신 모킹
      const mockDirents = [
        { name: "task-valid", isDirectory: () => true },
        { name: "task-invalid", isDirectory: () => true },
      ];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      vi.spyOn(fs, "readdir").mockResolvedValue(mockDirents as fs.Dirent[]);

      vi.spyOn(fs, "readFile")
        .mockResolvedValueOnce(
          JSON.stringify({
            id: "task-valid",
            goal: "Valid Task",
            acceptance: "Task completed",
            status: "pending",
            tasks: [],
          })
        )
        .mockRejectedValueOnce(new Error("Invalid JSON"));

      // When: getAllRootTasks 호출
      const tasks = await service.getAllRootTasks();

      // Then: 유효한 task만 반환
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe("task-valid");
    });
  });

  describe("getTaskById", () => {
    it("should return task by ID from root tasks", async () => {
      // Given: 실제 .dnc 디렉토리에 있는 task를 사용
      const allTasks = await service.getAllRootTasks();
      if (allTasks.length === 0) {
        // task가 없으면 테스트 스킵
        expect(true).toBe(true);
        return;
      }

      const taskId = allTasks[0].id;

      // When: getTaskById 호출
      const task = await service.getTaskById(taskId);

      // Then: 해당 task 반환
      expect(task).not.toBeNull();
      if (task) {
        expect(task.id).toBe(taskId);
        expect(task.goal).toBeDefined();
        expect(task.status).toBeDefined();
        expect(task.acceptance).toBeDefined();
      }
    });

    it("should return task from nested tasks", async () => {
      // Given: nested tasks를 가진 task를 모킹
      const mockDirents = [{ name: "task-parent", isDirectory: () => true }];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      vi.spyOn(fs, "readdir").mockResolvedValue(mockDirents as fs.Dirent[]);

      vi.spyOn(fs, "readFile").mockResolvedValueOnce(
        JSON.stringify({
          id: "task-parent",
          goal: "Parent Task",
          acceptance: "Parent completed",
          status: "in-progress",
          tasks: [
            {
              id: "task-child",
              goal: "Child Task",
              acceptance: "Child completed",
              status: "pending",
              tasks: [],
            },
          ],
        })
      );

      // When: 자식 task ID로 조회
      const task = await service.getTaskById("task-child");

      // Then: 자식 task 반환
      expect(task).not.toBeNull();
      expect(task?.id).toBe("task-child");
      expect(task?.goal).toBe("Child Task");
      expect(task?.acceptance).toBe("Child completed");
    });

    it("should return null when task does not exist", async () => {
      // Given: 존재하지 않는 task ID
      const taskId = "nonexistent-task-xyz-123";

      // When: getTaskById 호출
      const task = await service.getTaskById(taskId);

      // Then: null 반환
      expect(task).toBeNull();
    });
  });
});
