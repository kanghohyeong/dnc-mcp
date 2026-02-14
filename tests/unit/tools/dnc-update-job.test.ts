import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncUpdateJobTool } from "../../../src/tools/dnc-update-job.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import { writeTask, ensureDncDirectory, type Task } from "../../../src/utils/dnc-utils.js";

describe("dnc-update-job tool", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-update");
  const originalCwd = process.cwd();

  beforeEach(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    process.chdir(testRoot);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("should register tool with correct name", () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");

    registerDncUpdateJobTool(mcpServer);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    expect(registerToolSpy.mock.calls[0][0]).toBe("dnc_update_job");
  });

  it("should update task goal", async () => {
    const task: Task = {
      id: "job-to-update",
      goal: "Original Goal",
      acceptance: "Original acceptance criteria",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeTask("job-to-update", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      goal?: string;
      status?: string;
      acceptance?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-to-update",
      task_id: "job-to-update",
      goal: "Updated Goal",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("업데이트되었습니다");

    const taskContent = await fs.readFile(".dnc/job-to-update/task.json", "utf-8");
    const updatedTask = JSON.parse(taskContent) as Task;

    expect(updatedTask.goal).toBe("Updated Goal");
    expect(updatedTask.status).toBe("init"); // 마이그레이션으로 init으로 변환됨
    expect(updatedTask.acceptance).toBe("Original acceptance criteria"); // 변경되지 않음
  });

  it("should update task status", async () => {
    const task: Task = {
      id: "job-to-update",
      goal: "Test Goal",
      acceptance: "Test acceptance",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeTask("job-to-update", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-to-update",
      task_id: "job-to-update",
      status: "in-progress",
    });

    expect(result.isError).toBeUndefined();

    const taskContent = await fs.readFile(".dnc/job-to-update/task.json", "utf-8");
    const updatedTask = JSON.parse(taskContent) as Task;

    expect(updatedTask.status).toBe("in-progress");
  });

  it("should update task acceptance", async () => {
    const task: Task = {
      id: "job-to-update",
      goal: "Test Goal",
      acceptance: "Original acceptance",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeTask("job-to-update", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      acceptance?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-to-update",
      task_id: "job-to-update",
      acceptance: "Updated acceptance criteria",
    });

    expect(result.isError).toBeUndefined();

    const taskContent = await fs.readFile(".dnc/job-to-update/task.json", "utf-8");
    const updatedTask = JSON.parse(taskContent) as Task;

    expect(updatedTask.acceptance).toBe("Updated acceptance criteria");
  });

  it("should update goal, status, and acceptance together", async () => {
    const task: Task = {
      id: "job-to-update",
      goal: "Original Goal",
      acceptance: "Original acceptance",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeTask("job-to-update", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      goal?: string;
      status?: string;
      acceptance?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-to-update",
      task_id: "job-to-update",
      goal: "New Goal",
      status: "done",
      acceptance: "New acceptance",
    });

    expect(result.isError).toBeUndefined();

    const taskContent = await fs.readFile(".dnc/job-to-update/task.json", "utf-8");
    const updatedTask = JSON.parse(taskContent) as Task;

    expect(updatedTask.goal).toBe("New Goal");
    expect(updatedTask.status).toBe("done");
    expect(updatedTask.acceptance).toBe("New acceptance");
  });

  it("should update child task in parent", async () => {
    const parentTask: Task = {
      id: "job-parent",
      goal: "Parent Task",
      acceptance: "Parent acceptance",
      status: "pending",
      tasks: [
        {
          id: "job-child",
          goal: "Original Child Goal",
          acceptance: "Child acceptance",
          status: "pending",
          tasks: [],
        },
      ],
    };

    await ensureDncDirectory("job-parent");
    await writeTask("job-parent", parentTask);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      goal?: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-parent",
      task_id: "job-child",
      goal: "Updated Child Goal",
      status: "done",
    });

    expect(result.isError).toBeUndefined();

    const taskContent = await fs.readFile(".dnc/job-parent/task.json", "utf-8");
    const updatedParent = JSON.parse(taskContent) as Task;

    expect(updatedParent.tasks[0].goal).toBe("Updated Child Goal");
    expect(updatedParent.tasks[0].status).toBe("done");
  });

  describe("status updates with 7-state system", () => {
    it.each(["init", "accept", "in-progress", "done", "delete", "hold", "split"])(
      "should update status to %s",
      async (status) => {
        const task: Task = {
          id: "test-job",
          goal: "Test Goal",
          acceptance: "Test acceptance",
          status: "init",
          tasks: [],
        };

        await ensureDncDirectory("test-job");
        await writeTask("test-job", task);

        const mcpServer = createTestMcpServer();
        const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
        registerDncUpdateJobTool(mcpServer);
        const handler = registerToolSpy.mock.calls[0][2] as (args: {
          root_task_id: string;
          task_id: string;
          status?: string;
        }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

        const result = await handler({
          root_task_id: "test-job",
          task_id: "test-job",
          status: status,
        });

        expect(result.isError).toBeUndefined();

        const taskContent = await fs.readFile(".dnc/test-job/task.json", "utf-8");
        const updatedTask = JSON.parse(taskContent) as Task;
        expect(updatedTask.status).toBe(status);

        // Cleanup for next iteration
        await fs.rm(".dnc", { recursive: true, force: true });
      }
    );

    it("should reject pending as invalid status", async () => {
      const task: Task = {
        id: "test-job",
        goal: "Test Goal",
        acceptance: "Test acceptance",
        status: "init",
        tasks: [],
      };

      await ensureDncDirectory("test-job");
      await writeTask("test-job", task);

      const mcpServer = createTestMcpServer();
      const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
      registerDncUpdateJobTool(mcpServer);
      const handler = registerToolSpy.mock.calls[0][2] as (args: {
        root_task_id: string;
        task_id: string;
        status?: string;
      }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

      const result = await handler({
        root_task_id: "test-job",
        task_id: "test-job",
        status: "pending" as string,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("유효하지 않은 status");
    });
  });

  it("should return error for invalid status", async () => {
    const task: Task = {
      id: "job-to-update",
      goal: "Test Goal",
      acceptance: "Test acceptance",
      status: "init",
      tasks: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeTask("job-to-update", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-to-update",
      task_id: "job-to-update",
      status: "invalid-status",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("유효하지 않은");
  });

  it("should return error when task not found", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      goal?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "non-existent",
      task_id: "non-existent",
      goal: "New Goal",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Root task");
    expect(result.content[0].text).toContain("존재하지 않습니다");
  });

  it("should return error when no updates provided", async () => {
    const task: Task = {
      id: "job-to-update",
      goal: "Test Goal",
      acceptance: "Test acceptance",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeTask("job-to-update", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "job-to-update", task_id: "job-to-update" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("최소 하나");
  });

  it("should return error when job_title is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id?: string;
      task_id: string;
      goal?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "", task_id: "valid", goal: "New Goal" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("root_task_id");
    expect(result.content[0].text).toContain("유효하지 않습니다");
  });

  it("should return error when task_id is invalid", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      goal?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ root_task_id: "valid", task_id: "Invalid", goal: "New Goal" });

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

    await ensureDncDirectory("job-root");
    await writeTask("job-root", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      goal?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-root",
      task_id: "wrong-child",
      goal: "New Goal",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("wrong-child");
    expect(result.content[0].text).toContain("트리에서 찾을 수 없습니다");
  });

  it("should update nested child task (level-2)", async () => {
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
              tasks: [],
            },
          ],
        },
      ],
    };

    await ensureDncDirectory("job-root");
    await writeTask("job-root", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-root",
      task_id: "child-2",
      status: "done",
    });

    expect(result.isError).toBeUndefined();

    const taskContent = await fs.readFile(".dnc/job-root/task.json", "utf-8");
    const updatedRoot = JSON.parse(taskContent) as Task;

    expect(updatedRoot.tasks[0].tasks[0].status).toBe("done");
  });

  it("should update nested child task (level-3)", async () => {
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

    await ensureDncDirectory("job-root");
    await writeTask("job-root", task);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      task_id: string;
      goal?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "job-root",
      task_id: "child-3",
      goal: "Updated",
    });

    expect(result.isError).toBeUndefined();

    const taskContent = await fs.readFile(".dnc/job-root/task.json", "utf-8");
    const updatedRoot = JSON.parse(taskContent) as Task;

    expect(updatedRoot.tasks[0].tasks[0].tasks[0].goal).toBe("Updated");
  });
});
