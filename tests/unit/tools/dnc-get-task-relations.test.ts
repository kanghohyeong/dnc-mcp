import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncGetTaskRelationsTool } from "../../../src/tools/dnc-get-task-relations.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";

import { FileSystemDncTaskRepository } from "../../../src/repositories/index.js";
import type { Task } from "../../../src/repositories/index.js";

describe("dnc-get-task-relations tool", () => {
  let repository: FileSystemDncTaskRepository;
  const testRoot = path.join(process.cwd(), ".dnc-test-get");
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

    registerDncGetTaskRelationsTool(mcpServer, repository);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    expect(registerToolSpy.mock.calls[0][0]).toBe("dnc_get_task_relations");
  });

  it("should return simple task without subtasks", async () => {
    const task: Task = {
      id: "job-simple",
      goal: "Simple Task",
      acceptance: "Task completed successfully",
      status: "pending",
      tasks: [],
    };

    await repository.saveRootTask("job-simple", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetTaskRelationsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      task_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ task_title: "job-simple" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("job-simple");
    expect(result.content[0].text).toContain("Simple Task");
    expect(result.content[0].text).toContain("Task completed successfully");
    expect(result.content[0].text).toContain("init");
  });

  it("should return task with subtasks", async () => {
    const task: Task = {
      id: "job-parent",
      goal: "Parent Task",
      acceptance: "All children completed",
      status: "in-progress",
      tasks: [
        {
          id: "job-child-1",
          goal: "Child 1",
          acceptance: "Child 1 done",
          status: "done",
          tasks: [],
        },
        {
          id: "job-child-2",
          goal: "Child 2",
          acceptance: "Child 2 done",
          status: "pending",
          tasks: [],
        },
      ],
    };

    await repository.saveRootTask("job-parent", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetTaskRelationsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      task_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ task_title: "job-parent" });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;

    expect(text).toContain("job-parent");
    expect(text).toContain("Parent Task");
    expect(text).toContain("All children completed");
    expect(text).toContain("in-progress");
    expect(text).toContain("job-child-1");
    expect(text).toContain("Child 1");
    expect(text).toContain("done");
    expect(text).toContain("job-child-2");
    expect(text).toContain("Child 2");
    expect(text).toContain("init");
  });

  it("should return deeply nested task structure", async () => {
    const task: Task = {
      id: "job-root",
      goal: "Root Task",
      acceptance: "All levels completed",
      status: "in-progress",
      tasks: [
        {
          id: "job-level-1",
          goal: "Level 1",
          acceptance: "Level 1 completed",
          status: "in-progress",
          tasks: [
            {
              id: "job-level-2",
              goal: "Level 2",
              acceptance: "Level 2 completed",
              status: "pending",
              tasks: [],
            },
          ],
        },
      ],
    };

    await repository.saveRootTask("job-root", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetTaskRelationsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      task_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ task_title: "job-root" });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;

    expect(text).toContain("job-root");
    expect(text).toContain("job-level-1");
    expect(text).toContain("job-level-2");
    expect(text).toContain("Root Task");
    expect(text).toContain("Level 1");
    expect(text).toContain("Level 2");
  });

  it("should return error when task not found", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetTaskRelationsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      task_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ task_title: "non-existent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("존재하지 않습니다");
  });

  it("should return error when task_title is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetTaskRelationsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      task_title?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ task_title: "" });

    expect(result.isError).toBe(true);
  });

  it("should handle corrupted JSON gracefully", async () => {
    await fs.mkdir(".dnc/job-corrupted", { recursive: true });
    await fs.writeFile(".dnc/job-corrupted/task.json", "invalid json{", "utf-8");

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetTaskRelationsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      task_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ task_title: "job-corrupted" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("오류");
  });

  it("should return formatted JSON", async () => {
    const task: Task = {
      id: "job-format",
      goal: "Format Test",
      acceptance: "Formatted correctly",
      status: "pending",
      tasks: [],
    };

    await repository.saveRootTask("job-format", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetTaskRelationsTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      task_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ task_title: "job-format" });

    expect(result.isError).toBeUndefined();

    // JSON 파싱 가능 여부 확인
    const text = result.content[0].text;
    const jsonMatch = text.match(/```json\n([\s\S]+?)\n```/);
    expect(jsonMatch).toBeTruthy();

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]) as Task;
      expect(parsed.id).toBe("job-format");
      expect(parsed.goal).toBe("Format Test");
      expect(parsed.acceptance).toBe("Formatted correctly");
    }
  });
});
