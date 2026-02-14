import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncAppendDividedJobTool } from "../../../src/tools/dnc-append-divided-job.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import { writeTask, ensureDncDirectory, type Task } from "../../../src/utils/dnc-utils.js";

describe("dnc-append-divided-job tool", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-append");
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

    registerDncAppendDividedJobTool(mcpServer);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    expect(registerToolSpy.mock.calls[0][0]).toBe("dnc_append_divided_job");
  });

  it("should append divided job to parent", async () => {
    const parentTask: Task = {
      id: "parent-job",
      goal: "Parent Task",
      acceptance: "Parent done",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("parent-job");
    await writeTask("parent-job", parentTask);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      parent_task_id: string;
      child_job_title: string;
      child_goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "parent-job",
      parent_task_id: "parent-job",
      child_job_title: "child-task",
      child_goal: "Child Task",
      acceptance: "Child done",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("추가되었습니다");

    const taskContent = await fs.readFile(".dnc/parent-job/task.json", "utf-8");
    const updatedParent = JSON.parse(taskContent) as Task;

    expect(updatedParent.tasks).toHaveLength(1);
    expect(updatedParent.tasks[0].goal).toBe("Child Task");
    expect(updatedParent.tasks[0].id).toBe("child-task");
    expect(updatedParent.tasks[0].acceptance).toBe("Child done");
  });

  it("should return error when root_task_id does not exist", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      parent_task_id: string;
      child_job_title: string;
      child_goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "non-existent",
      parent_task_id: "any",
      child_job_title: "child-task",
      child_goal: "Child Task",
      acceptance: "Done",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Root task");
    expect(result.content[0].text).toContain("존재하지 않습니다");
  });

  it("should prevent duplicate child job titles", async () => {
    const parentTask: Task = {
      id: "parent-job",
      goal: "Parent Task",
      acceptance: "Parent done",
      status: "pending",
      tasks: [
        {
          id: "existing-child",
          goal: "Existing Child",
          acceptance: "Child done",
          status: "pending",
          tasks: [],
        },
      ],
    };

    await ensureDncDirectory("parent-job");
    await writeTask("parent-job", parentTask);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      parent_task_id: string;
      child_job_title: string;
      child_goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "parent-job",
      parent_task_id: "parent-job",
      child_job_title: "existing-child",
      child_goal: "Existing Child",
      acceptance: "Done",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("이미 존재");
  });

  it("should handle empty child_goal", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      parent_task_id: string;
      child_job_title: string;
      child_goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "parent-job",
      parent_task_id: "parent-job",
      child_job_title: "child-task",
      child_goal: "",
      acceptance: "Done",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("child_goal");
  });

  it("should append multiple divided jobs", async () => {
    const parentTask: Task = {
      id: "parent-job",
      goal: "Parent Task",
      acceptance: "Parent done",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("parent-job");
    await writeTask("parent-job", parentTask);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      parent_task_id: string;
      child_job_title: string;
      child_goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    await handler({
      root_task_id: "parent-job",
      parent_task_id: "parent-job",
      child_job_title: "child-1",
      child_goal: "Child 1",
      acceptance: "Done 1",
    });
    await handler({
      root_task_id: "parent-job",
      parent_task_id: "parent-job",
      child_job_title: "child-2",
      child_goal: "Child 2",
      acceptance: "Done 2",
    });
    await handler({
      root_task_id: "parent-job",
      parent_task_id: "parent-job",
      child_job_title: "child-3",
      child_goal: "Child 3",
      acceptance: "Done 3",
    });

    const taskContent = await fs.readFile(".dnc/parent-job/task.json", "utf-8");
    const updatedParent = JSON.parse(taskContent) as Task;

    expect(updatedParent.tasks).toHaveLength(3);
    expect(updatedParent.tasks[0].goal).toBe("Child 1");
    expect(updatedParent.tasks[1].goal).toBe("Child 2");
    expect(updatedParent.tasks[2].goal).toBe("Child 3");
  });

  it("should return error for invalid child_job_title format", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      parent_task_id: string;
      child_job_title: string;
      child_goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "parent-job",
      parent_task_id: "parent-job",
      child_job_title: "Invalid Title With Spaces",
      child_goal: "Child Task",
      acceptance: "Done",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("child_job_title이 유효하지 않습니다");
  });

  describe("nested task append", () => {
    it("should append child to level-1 task", async () => {
      const rootTask: Task = {
        id: "root",
        goal: "Root Task",
        acceptance: "Root done",
        status: "pending",
        tasks: [],
      };

      await ensureDncDirectory("root");
      await writeTask("root", rootTask);

      const mcpServer = createTestMcpServer();
      const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
      registerDncAppendDividedJobTool(mcpServer);
      const handler = registerToolSpy.mock.calls[0][2] as (args: {
        root_task_id: string;
        parent_task_id: string;
        child_job_title: string;
        child_goal: string;
        acceptance: string;
      }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

      // Setup: root → child-level-1 구조 생성
      await handler({
        root_task_id: "root",
        parent_task_id: "root",
        child_job_title: "child-level-1",
        child_goal: "Level 1",
        acceptance: "Done 1",
      });

      // Action: child-level-1에 child-level-2 추가
      const result = await handler({
        root_task_id: "root",
        parent_task_id: "child-level-1",
        child_job_title: "child-level-2",
        child_goal: "Level 2",
        acceptance: "Done 2",
      });

      // Assert: 성공 + 트리 구조 검증
      expect(result.isError).toBeUndefined();
      const taskContent = await fs.readFile(".dnc/root/task.json", "utf-8");
      const updatedRoot = JSON.parse(taskContent) as Task;
      expect(updatedRoot.tasks[0].tasks).toHaveLength(1);
      expect(updatedRoot.tasks[0].tasks[0].id).toBe("child-level-2");
      expect(updatedRoot.tasks[0].tasks[0].goal).toBe("Level 2");
    });

    it("should append child to level-2 task", async () => {
      const rootTask: Task = {
        id: "root",
        goal: "Root Task",
        acceptance: "Root done",
        status: "pending",
        tasks: [],
      };

      await ensureDncDirectory("root");
      await writeTask("root", rootTask);

      const mcpServer = createTestMcpServer();
      const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
      registerDncAppendDividedJobTool(mcpServer);
      const handler = registerToolSpy.mock.calls[0][2] as (args: {
        root_task_id: string;
        parent_task_id: string;
        child_job_title: string;
        child_goal: string;
        acceptance: string;
      }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

      // Setup: root → child-1 → child-2 구조 생성
      await handler({
        root_task_id: "root",
        parent_task_id: "root",
        child_job_title: "child-1",
        child_goal: "Level 1",
        acceptance: "Done 1",
      });
      await handler({
        root_task_id: "root",
        parent_task_id: "child-1",
        child_job_title: "child-2",
        child_goal: "Level 2",
        acceptance: "Done 2",
      });

      // Action: child-2에 child-3 추가
      const result = await handler({
        root_task_id: "root",
        parent_task_id: "child-2",
        child_job_title: "child-3",
        child_goal: "Level 3",
        acceptance: "Done 3",
      });

      // Assert: 3단계 깊이 구조 검증
      expect(result.isError).toBeUndefined();
      const taskContent = await fs.readFile(".dnc/root/task.json", "utf-8");
      const updatedRoot = JSON.parse(taskContent) as Task;
      expect(updatedRoot.tasks[0].tasks[0].tasks).toHaveLength(1);
      expect(updatedRoot.tasks[0].tasks[0].tasks[0].id).toBe("child-3");
      expect(updatedRoot.tasks[0].tasks[0].tasks[0].goal).toBe("Level 3");
    });
  });

  it("should return error when parent_task_id not in tree", async () => {
    const rootTask: Task = {
      id: "root",
      goal: "Root Task",
      acceptance: "Root done",
      status: "pending",
      tasks: [
        {
          id: "existing-child",
          goal: "Existing",
          acceptance: "Done",
          status: "pending",
          tasks: [],
        },
      ],
    };

    await ensureDncDirectory("root");
    await writeTask("root", rootTask);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      parent_task_id: string;
      child_job_title: string;
      child_goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "root",
      parent_task_id: "wrong-parent",
      child_job_title: "new-child",
      child_goal: "Goal",
      acceptance: "Done",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Parent task");
    expect(result.content[0].text).toContain("트리에서 찾을 수 없습니다");
  });

  it("should append to root when root_task_id === parent_task_id", async () => {
    const rootTask: Task = {
      id: "my-root",
      goal: "Root Task",
      acceptance: "Root done",
      status: "pending",
      tasks: [],
    };

    await ensureDncDirectory("my-root");
    await writeTask("my-root", rootTask);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      root_task_id: string;
      parent_task_id: string;
      child_job_title: string;
      child_goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      root_task_id: "my-root",
      parent_task_id: "my-root",
      child_job_title: "direct-child",
      child_goal: "Goal",
      acceptance: "Done",
    });

    expect(result.isError).toBeUndefined();
    const taskContent = await fs.readFile(".dnc/my-root/task.json", "utf-8");
    const updatedRoot = JSON.parse(taskContent) as Task;
    expect(updatedRoot.tasks).toHaveLength(1);
    expect(updatedRoot.tasks[0].id).toBe("direct-child");
  });
});
