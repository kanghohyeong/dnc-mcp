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
      job_title: string;
      goal?: string;
      status?: string;
      acceptance?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "job-to-update",
      goal: "Updated Goal",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("업데이트되었습니다");

    const taskContent = await fs.readFile(".dnc/job-to-update/task.json", "utf-8");
    const updatedTask = JSON.parse(taskContent) as Task;

    expect(updatedTask.goal).toBe("Updated Goal");
    expect(updatedTask.status).toBe("pending"); // 변경되지 않음
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
      job_title: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "job-to-update",
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
      job_title: string;
      acceptance?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "job-to-update",
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
      job_title: string;
      goal?: string;
      status?: string;
      acceptance?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "job-to-update",
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
      job_title: string;
      parent_job_title?: string;
      goal?: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "job-child",
      parent_job_title: "job-parent",
      goal: "Updated Child Goal",
      status: "done",
    });

    expect(result.isError).toBeUndefined();

    const taskContent = await fs.readFile(".dnc/job-parent/task.json", "utf-8");
    const updatedParent = JSON.parse(taskContent) as Task;

    expect(updatedParent.tasks[0].goal).toBe("Updated Child Goal");
    expect(updatedParent.tasks[0].status).toBe("done");
  });

  it("should return error for invalid status", async () => {
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
      job_title: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "job-to-update",
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
      job_title: string;
      goal?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "non-existent",
      goal: "New Goal",
    });

    expect(result.isError).toBe(true);
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
      job_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_title: "job-to-update" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("최소 하나");
  });

  it("should return error when job_title is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_title: "" });

    expect(result.isError).toBe(true);
  });
});
