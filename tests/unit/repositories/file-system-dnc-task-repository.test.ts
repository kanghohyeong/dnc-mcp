import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { FileSystemDncTaskRepository } from "../../../src/repositories/index.js";
import type { Task } from "../../../src/repositories/index.js";

describe("FileSystemDncTaskRepository", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-repo");
  let repository: FileSystemDncTaskRepository;

  beforeEach(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    repository = new FileSystemDncTaskRepository(testRoot);
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  const makeTask = (id: string, overrides: Partial<Task> = {}): Task => ({
    id,
    goal: `Goal of ${id}`,
    acceptance: `Acceptance of ${id}`,
    status: "init",
    tasks: [],
    ...overrides,
  });

  // ───────────────────────────────────────────
  // ensureReady
  // ───────────────────────────────────────────
  describe("ensureReady", () => {
    it("creates the dnc directory when it does not exist", async () => {
      const newDir = path.join(testRoot, "new-dnc");
      const repo = new FileSystemDncTaskRepository(newDir);

      await repo.ensureReady();

      const stat = await fs.stat(newDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it("does not throw when directory already exists", async () => {
      await repository.ensureReady();
      await expect(repository.ensureReady()).resolves.not.toThrow();
    });
  });

  // ───────────────────────────────────────────
  // rootTaskExists
  // ───────────────────────────────────────────
  describe("rootTaskExists", () => {
    it("returns false when task does not exist", async () => {
      const exists = await repository.rootTaskExists("non-existent");
      expect(exists).toBe(false);
    });

    it("returns true when task file exists", async () => {
      const task = makeTask("existing-task");
      await repository.saveRootTask("existing-task", task);

      const exists = await repository.rootTaskExists("existing-task");
      expect(exists).toBe(true);
    });

    it("returns false when directory exists but task.json is missing", async () => {
      await fs.mkdir(path.join(testRoot, "no-json-dir"), { recursive: true });

      const exists = await repository.rootTaskExists("no-json-dir");
      expect(exists).toBe(false);
    });
  });

  // ───────────────────────────────────────────
  // saveRootTask
  // ───────────────────────────────────────────
  describe("saveRootTask", () => {
    it("creates directory and writes task.json", async () => {
      const task = makeTask("my-task");

      await repository.saveRootTask("my-task", task);

      const content = await fs.readFile(path.join(testRoot, "my-task", "task.json"), "utf-8");
      const saved = JSON.parse(content) as Task;
      expect(saved.id).toBe("my-task");
      expect(saved.goal).toBe("Goal of my-task");
      expect(saved.status).toBe("init");
    });

    it("overwrites existing task", async () => {
      const original = makeTask("my-task");
      await repository.saveRootTask("my-task", original);

      const updated = { ...original, goal: "Updated Goal" };
      await repository.saveRootTask("my-task", updated);

      const content = await fs.readFile(path.join(testRoot, "my-task", "task.json"), "utf-8");
      const saved = JSON.parse(content) as Task;
      expect(saved.goal).toBe("Updated Goal");
    });

    it("saves nested tasks correctly", async () => {
      const task = makeTask("parent", {
        tasks: [makeTask("child")],
      });

      await repository.saveRootTask("parent", task);

      const content = await fs.readFile(path.join(testRoot, "parent", "task.json"), "utf-8");
      const saved = JSON.parse(content) as Task;
      expect(saved.tasks).toHaveLength(1);
      expect(saved.tasks[0].id).toBe("child");
    });
  });

  // ───────────────────────────────────────────
  // findRootTask
  // ───────────────────────────────────────────
  describe("findRootTask", () => {
    it("returns task when it exists", async () => {
      const task = makeTask("find-me");
      await repository.saveRootTask("find-me", task);

      const found = await repository.findRootTask("find-me");
      expect(found.id).toBe("find-me");
      expect(found.goal).toBe("Goal of find-me");
    });

    it("throws when task does not exist", async () => {
      await expect(repository.findRootTask("ghost")).rejects.toThrow();
    });

    it("migrates pending status to init automatically", async () => {
      const pendingTask = makeTask("migrate-me", { status: "pending" });
      await fs.mkdir(path.join(testRoot, "migrate-me"), { recursive: true });
      await fs.writeFile(
        path.join(testRoot, "migrate-me", "task.json"),
        JSON.stringify(pendingTask),
        "utf-8"
      );

      const found = await repository.findRootTask("migrate-me");
      expect(found.status).toBe("init");
    });

    it("migrates nested pending tasks to init", async () => {
      const task = makeTask("root", {
        tasks: [makeTask("child", { status: "pending" })],
      });
      await fs.mkdir(path.join(testRoot, "root"), { recursive: true });
      await fs.writeFile(path.join(testRoot, "root", "task.json"), JSON.stringify(task), "utf-8");

      const found = await repository.findRootTask("root");
      expect(found.tasks[0].status).toBe("init");
    });

    it("returns tasks with all fields intact", async () => {
      const task = makeTask("full-task", {
        status: "in-progress",
        acceptance: "Custom acceptance",
      });
      await repository.saveRootTask("full-task", task);

      const found = await repository.findRootTask("full-task");
      expect(found.status).toBe("in-progress");
      expect(found.acceptance).toBe("Custom acceptance");
    });
  });

  // ───────────────────────────────────────────
  // deleteRootTask
  // ───────────────────────────────────────────
  describe("deleteRootTask", () => {
    it("deletes task directory and its contents", async () => {
      const task = makeTask("to-delete");
      await repository.saveRootTask("to-delete", task);

      await repository.deleteRootTask("to-delete");

      const exists = await fs
        .access(path.join(testRoot, "to-delete"))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it("does not throw when directory does not exist", async () => {
      await expect(repository.deleteRootTask("non-existent")).resolves.not.toThrow();
    });
  });

  // ───────────────────────────────────────────
  // listRootTaskIds
  // ───────────────────────────────────────────
  describe("listRootTaskIds", () => {
    it("returns empty array when dncDir does not exist", async () => {
      const nonExistentDir = path.join(testRoot, "ghost-dir");
      const repo = new FileSystemDncTaskRepository(nonExistentDir);

      const ids = await repo.listRootTaskIds();
      expect(ids).toEqual([]);
    });

    it("returns empty array when no task directories exist", async () => {
      const ids = await repository.listRootTaskIds();
      expect(ids).toEqual([]);
    });

    it("returns list of root task IDs", async () => {
      await repository.saveRootTask("task-a", makeTask("task-a"));
      await repository.saveRootTask("task-b", makeTask("task-b"));

      const ids = await repository.listRootTaskIds();
      expect(ids).toContain("task-a");
      expect(ids).toContain("task-b");
      expect(ids).toHaveLength(2);
    });

    it("returns IDs sorted alphabetically", async () => {
      await repository.saveRootTask("zebra", makeTask("zebra"));
      await repository.saveRootTask("apple", makeTask("apple"));
      await repository.saveRootTask("mango", makeTask("mango"));

      const ids = await repository.listRootTaskIds();
      expect(ids).toEqual(["apple", "mango", "zebra"]);
    });

    it("ignores files (only lists directories)", async () => {
      await repository.saveRootTask("real-task", makeTask("real-task"));
      await fs.writeFile(path.join(testRoot, "stray-file.json"), "{}", "utf-8");

      const ids = await repository.listRootTaskIds();
      expect(ids).toEqual(["real-task"]);
    });
  });
});
