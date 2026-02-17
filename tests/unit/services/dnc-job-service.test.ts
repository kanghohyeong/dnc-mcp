import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { DncJobService } from "../../../src/services/dnc-job-service.js";
import { FileSystemDncTaskRepository } from "../../../src/repositories/index.js";
import type { Task } from "../../../src/repositories/index.js";

describe("DncJobService", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-job-service");
  let repository: FileSystemDncTaskRepository;
  let service: DncJobService;

  const makeTask = (id: string, overrides: Partial<Task> = {}): Task => ({
    id,
    goal: `Goal of ${id}`,
    acceptance: `Acceptance of ${id}`,
    status: "init",
    tasks: [],
    ...overrides,
  });

  beforeEach(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    repository = new FileSystemDncTaskRepository(testRoot);
    service = new DncJobService(repository);
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  describe("getAllRootTasks", () => {
    it("should return all root tasks from .dnc directory", async () => {
      await repository.saveRootTask("task-a", makeTask("task-a"));
      await repository.saveRootTask("task-b", makeTask("task-b"));

      const tasks = await service.getAllRootTasks();

      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks).toHaveLength(2);
      const ids = tasks.map((t) => t.id);
      expect(ids).toContain("task-a");
      expect(ids).toContain("task-b");
    });

    it("should return empty array when no tasks exist", async () => {
      const tasks = await service.getAllRootTasks();
      expect(tasks).toEqual([]);
    });

    it("should return empty array when dncDir does not exist", async () => {
      const nonExistentRepo = new FileSystemDncTaskRepository("/nonexistent/path");
      const emptyService = new DncJobService(nonExistentRepo);

      const tasks = await emptyService.getAllRootTasks();
      expect(tasks).toEqual([]);
    });

    it("should skip invalid task.json files and return only valid ones", async () => {
      await repository.saveRootTask("task-valid", makeTask("task-valid"));
      // 손상된 파일 직접 생성
      await fs.mkdir(path.join(testRoot, "task-invalid"), { recursive: true });
      await fs.writeFile(
        path.join(testRoot, "task-invalid", "task.json"),
        "not-valid-json",
        "utf-8"
      );

      const tasks = await service.getAllRootTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe("task-valid");
    });
  });

  describe("getTaskById", () => {
    it("should return task by ID from root tasks", async () => {
      await repository.saveRootTask("my-task", makeTask("my-task"));

      const task = await service.getTaskById("my-task");

      expect(task).not.toBeNull();
      expect(task?.id).toBe("my-task");
      expect(task?.goal).toBe("Goal of my-task");
    });

    it("should return task from nested tasks", async () => {
      const parent = makeTask("parent", {
        tasks: [makeTask("child")],
      });
      await repository.saveRootTask("parent", parent);

      const task = await service.getTaskById("child");

      expect(task).not.toBeNull();
      expect(task?.id).toBe("child");
      expect(task?.goal).toBe("Goal of child");
    });

    it("should return null when task does not exist", async () => {
      const task = await service.getTaskById("nonexistent-xyz");
      expect(task).toBeNull();
    });
  });
});
