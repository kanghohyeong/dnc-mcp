import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncListRootJobsTool } from "../../../src/tools/dnc-list-root-jobs.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import { writeTask, ensureDncDirectory } from "../../../src/utils/dnc-utils.js";
import { FileSystemDncTaskRepository } from "../../../src/repositories/index.js";
import type { Task } from "../../../src/repositories/index.js";

describe("dnc-list-root-jobs tool", () => {
  let repository: FileSystemDncTaskRepository;
  const testRoot = path.join(process.cwd(), ".dnc-test-list-root");
  const originalCwd = process.cwd();

  beforeEach(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    process.chdir(testRoot);
    repository = new FileSystemDncTaskRepository();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should register tool with correct name", () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");

    registerDncListRootJobsTool(mcpServer, repository);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    expect(registerToolSpy.mock.calls[0][0]).toBe("dnc_list_root_jobs");
  });

  it("should return message when .dnc directory does not exist", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncListRootJobsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("No root tasks found");
    expect(result.isError).toBeUndefined();
  });

  it("should return message when .dnc directory is empty", async () => {
    await fs.mkdir(".dnc", { recursive: true });

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncListRootJobsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("No root tasks found");
  });

  it("should list single root task", async () => {
    const task: Task = {
      id: "test-job",
      goal: "Test goal",
      acceptance: "Test acceptance",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("test-job");
    await writeTask("test-job", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncListRootJobsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const text = result.content[0].text;
    expect(text).toContain("Root Tasks:");
    expect(text).toContain("- test-job");
    expect(text).toContain("Goal: Test goal");
    expect(text).toContain("Status: init");
    expect(text).toContain("Total: 1 root task");
  });

  it("should list multiple root tasks", async () => {
    const task1: Task = {
      id: "job-alpha",
      goal: "Alpha goal",
      acceptance: "Alpha acceptance",
      status: "pending",
      tasks: [],
    };

    const task2: Task = {
      id: "job-beta",
      goal: "Beta goal",
      acceptance: "Beta acceptance",
      status: "in-progress",
      tasks: [],
    };

    const task3: Task = {
      id: "job-gamma",
      goal: "Gamma goal",
      acceptance: "Gamma acceptance",
      status: "done",
      tasks: [],
    };

    await ensureDncDirectory("job-alpha");
    await writeTask("job-alpha", task1);
    await ensureDncDirectory("job-beta");
    await writeTask("job-beta", task2);
    await ensureDncDirectory("job-gamma");
    await writeTask("job-gamma", task3);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncListRootJobsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const text = result.content[0].text;
    expect(text).toContain("Root Tasks:");
    expect(text).toContain("- job-alpha");
    expect(text).toContain("Goal: Alpha goal");
    expect(text).toContain("Status: init");
    expect(text).toContain("- job-beta");
    expect(text).toContain("Goal: Beta goal");
    expect(text).toContain("Status: in-progress");
    expect(text).toContain("- job-gamma");
    expect(text).toContain("Goal: Gamma goal");
    expect(text).toContain("Status: done");
    expect(text).toContain("Total: 3 root tasks");
  });

  it("should list tasks in alphabetical order", async () => {
    const taskZ: Task = {
      id: "z-task",
      goal: "Z goal",
      acceptance: "Z acceptance",
      status: "pending",
      tasks: [],
    };

    const taskA: Task = {
      id: "a-task",
      goal: "A goal",
      acceptance: "A acceptance",
      status: "pending",
      tasks: [],
    };

    const taskM: Task = {
      id: "m-task",
      goal: "M goal",
      acceptance: "M acceptance",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("z-task");
    await writeTask("z-task", taskZ);
    await ensureDncDirectory("a-task");
    await writeTask("a-task", taskA);
    await ensureDncDirectory("m-task");
    await writeTask("m-task", taskM);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncListRootJobsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const result = await handler();

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;

    // Check alphabetical order
    const aIndex = text.indexOf("- a-task");
    const mIndex = text.indexOf("- m-task");
    const zIndex = text.indexOf("- z-task");

    expect(aIndex).toBeGreaterThan(-1);
    expect(mIndex).toBeGreaterThan(-1);
    expect(zIndex).toBeGreaterThan(-1);
    expect(aIndex).toBeLessThan(mIndex);
    expect(mIndex).toBeLessThan(zIndex);
  });

  it("should display different statuses correctly", async () => {
    const taskPending: Task = {
      id: "pending-task",
      goal: "Pending goal",
      acceptance: "Pending acceptance",
      status: "pending",
      tasks: [],
    };

    const taskInProgress: Task = {
      id: "in-progress-task",
      goal: "In progress goal",
      acceptance: "In progress acceptance",
      status: "in-progress",
      tasks: [],
    };

    const taskDone: Task = {
      id: "done-task",
      goal: "Done goal",
      acceptance: "Done acceptance",
      status: "done",
      tasks: [],
    };

    await ensureDncDirectory("pending-task");
    await writeTask("pending-task", taskPending);
    await ensureDncDirectory("in-progress-task");
    await writeTask("in-progress-task", taskInProgress);
    await ensureDncDirectory("done-task");
    await writeTask("done-task", taskDone);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncListRootJobsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const result = await handler();

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    expect(text).toContain("Status: init");
    expect(text).toContain("Status: in-progress");
    expect(text).toContain("Status: done");
  });

  it("should skip corrupted task files and continue listing", async () => {
    const validTask: Task = {
      id: "valid-task",
      goal: "Valid goal",
      acceptance: "Valid acceptance",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("valid-task");
    await writeTask("valid-task", validTask);

    // Create corrupted task file
    await ensureDncDirectory("corrupted-task");
    await fs.writeFile(path.join(".dnc", "corrupted-task", "task.json"), "{ invalid json }");

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncListRootJobsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await handler();

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    expect(text).toContain("- valid-task");
    expect(text).toContain("Goal: Valid goal");
    expect(text).not.toContain("corrupted-task");
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Warning: Failed to read task"));
  });

  it("should handle tasks with empty goal", async () => {
    const task: Task = {
      id: "empty-goal",
      goal: "",
      acceptance: "Some acceptance",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("empty-goal");
    await writeTask("empty-goal", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncListRootJobsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;

    const result = await handler();

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;
    expect(text).toContain("- empty-goal");
    expect(text).toContain("Goal: ");
    expect(text).toContain("Status: init");
  });
});
