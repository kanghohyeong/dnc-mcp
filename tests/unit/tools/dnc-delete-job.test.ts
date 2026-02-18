import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncDeleteJobTool } from "../../../src/tools/dnc-delete-job.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";

import { FileSystemDncTaskRepository } from "../../../src/repositories/index.js";
import type { Task } from "../../../src/repositories/index.js";

describe("dnc-delete-job tool", () => {
  let repository: FileSystemDncTaskRepository;
  const testRoot = path.join(process.cwd(), ".dnc-test-delete");
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

    registerDncDeleteJobTool(mcpServer, repository);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    expect(registerToolSpy.mock.calls[0][0]).toBe("dnc_delete_job");
  });

  it("should delete root job and all files", async () => {
    const task: Task = {
      id: "job-to-delete",
      goal: "Task to Delete",
      acceptance: "Deleted",
      status: "pending",
      tasks: [],
    };

    await repository.saveRootTask("job-to-delete", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "job-to-delete", task_id: "job-to-delete" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("삭제되었습니다");

    const dirExists = await fs
      .access(".dnc/job-to-delete")
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(false);
  });

  it("should delete child job from parent", async () => {
    const task: Task = {
      id: "job-parent",
      goal: "Parent",
      acceptance: "Done",
      status: "pending",
      tasks: [
        {
          id: "job-child-to-delete",
          goal: "Child to Delete",
          acceptance: "Deleted",
          status: "pending",
          tasks: [],
        },
      ],
    };

    await repository.saveRootTask("job-parent", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-parent",
      task_id: "job-child-to-delete",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("삭제되었습니다");

    const taskContent = await fs.readFile(".dnc/job-parent/task.json", "utf-8");
    const updatedParent = JSON.parse(taskContent) as Task;
    expect(updatedParent.tasks).toHaveLength(0);
  });

  it("should recursively delete nested jobs", async () => {
    const task: Task = {
      id: "job-root",
      goal: "Root",
      acceptance: "Done",
      status: "pending",
      tasks: [
        {
          id: "job-level-1",
          goal: "Level 1",
          acceptance: "Done",
          status: "pending",
          tasks: [
            {
              id: "job-level-2",
              goal: "Level 2",
              acceptance: "Done",
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
    registerDncDeleteJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-root",
      task_id: "job-level-2",
    });

    expect(result.isError).toBeUndefined();

    const taskContent = await fs.readFile(".dnc/job-root/task.json", "utf-8");
    const updatedRoot = JSON.parse(taskContent) as Task;
    expect(updatedRoot.tasks[0].tasks).toHaveLength(0);
  });

  it("should return error when job not found", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "non-existent-job", task_id: "non-existent-job" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Root task");
    expect(result.content[0].text).toContain("존재하지 않습니다");
  });

  it("should return error when job_title is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id?: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "", task_id: "valid-task" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("root_task_id");
    expect(result.content[0].text).toContain("유효하지 않습니다");
  });

  it("should return error when task_id is invalid", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "valid-root", task_id: "Invalid Task" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("task_id");
    expect(result.content[0].text).toContain("유효하지 않습니다");
  });

  it("should return error when child task not in tree", async () => {
    const task: Task = {
      id: "job-root",
      goal: "Root",
      acceptance: "Done",
      status: "pending",
      tasks: [
        {
          id: "child-1",
          goal: "Child 1",
          acceptance: "Done",
          status: "pending",
          tasks: [],
        },
      ],
    };

    await repository.saveRootTask("job-root", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "job-root", task_id: "wrong-child" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("wrong-child");
    expect(result.content[0].text).toContain("트리에서 찾을 수 없습니다");
  });

  it("should delete deeply nested child (level-3)", async () => {
    const task: Task = {
      id: "job-root",
      goal: "Root",
      acceptance: "Done",
      status: "pending",
      tasks: [
        {
          id: "child-1",
          goal: "Child 1",
          acceptance: "Done",
          status: "pending",
          tasks: [
            {
              id: "child-2",
              goal: "Child 2",
              acceptance: "Done",
              status: "pending",
              tasks: [
                {
                  id: "child-3",
                  goal: "Child 3",
                  acceptance: "Done",
                  status: "pending",
                  tasks: [],
                },
              ],
            },
          ],
        },
      ],
    };

    await repository.saveRootTask("job-root", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "job-root", task_id: "child-3" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("삭제되었습니다");

    const taskContent = await fs.readFile(".dnc/job-root/task.json", "utf-8");
    const updatedRoot = JSON.parse(taskContent) as Task;
    expect(updatedRoot.tasks[0].tasks[0].tasks).toHaveLength(0);
  });
});
