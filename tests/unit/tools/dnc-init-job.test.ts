import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncInitJobTool } from "../../../src/tools/dnc-init-job.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import { FileSystemDncTaskRepository } from "../../../src/repositories/index.js";
import type { Task } from "../../../src/repositories/index.js";

describe("dnc-init-job tool", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-init");
  const originalCwd = process.cwd();
  let repository: FileSystemDncTaskRepository;

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

    registerDncInitJobTool(mcpServer, repository);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    const call = registerToolSpy.mock.calls[0];
    expect(call[0]).toBe("dnc_init_job");
  });

  it("should create root task with valid job_title, goal, and acceptance", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "implement-auth",
      goal: "Implement Authentication",
      acceptance: "All authentication tests pass",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("성공적으로 생성되었습니다");

    // 파일 시스템 검증
    const taskPath = ".dnc/implement-auth/task.json";

    const taskExists = await fs
      .access(taskPath)
      .then(() => true)
      .catch(() => false);

    expect(taskExists).toBe(true);

    // JSON 내용 검증
    const taskContent = await fs.readFile(taskPath, "utf-8");
    const task = JSON.parse(taskContent) as Task;

    expect(task.id).toBe("implement-auth");
    expect(task.goal).toBe("Implement Authentication");
    expect(task.acceptance).toBe("All authentication tests pass");
    expect(task.status).toBe("init");
    expect(task.tasks).toEqual([]);
  });

  it("should return error when job_title is invalid (uppercase)", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "Implement-Auth",
      goal: "Implement Authentication",
      acceptance: "Tests pass",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("lowercase");
  });

  it("should return error when job_title exceeds 10 words", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "one-two-three-four-five-six-seven-eight-nine-ten-eleven",
      goal: "Test Goal",
      acceptance: "Done",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("10 words");
  });

  it("should return error when goal is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal?: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "test-job",
      goal: "",
      acceptance: "Done",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("goal");
  });

  it("should return error when acceptance is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
      acceptance?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "test-job",
      goal: "Test Goal",
      acceptance: "",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("acceptance");
  });

  it("should return error when job already exists", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer, repository);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
      acceptance: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    // 첫 번째 생성
    await handler({
      job_title: "test-job",
      goal: "Test Goal",
      acceptance: "Done",
    });

    // 중복 생성 시도
    const result = await handler({
      job_title: "test-job",
      goal: "Test Goal",
      acceptance: "Done",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("이미 존재");
  });
});
