import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncInitJobTool } from "../../../src/tools/dnc-init-job.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import type { JobRelation } from "../../../src/utils/dnc-utils.js";

describe("dnc-init-job tool", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-init");
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

    registerDncInitJobTool(mcpServer);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    const call = registerToolSpy.mock.calls[0];
    expect(call[0]).toBe("dnc_init_job");
  });

  it("should create root job with valid job_title and goal", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
      requirements?: string;
      constraints?: string;
      acceptance_criteria?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "implement-auth",
      goal: "Implement Authentication",
      requirements: "JWT tokens, OAuth2",
      constraints: "Use existing user model",
      acceptance_criteria: "All tests pass",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("성공적으로 생성되었습니다");

    // 파일 시스템 검증
    const jobRelationPath = ".dnc/implement-auth/job_relation.json";
    const specPath = ".dnc/implement-auth/specs/implement-auth.md";

    const jobRelationExists = await fs
      .access(jobRelationPath)
      .then(() => true)
      .catch(() => false);
    const specExists = await fs
      .access(specPath)
      .then(() => true)
      .catch(() => false);

    expect(jobRelationExists).toBe(true);
    expect(specExists).toBe(true);

    // JSON 내용 검증
    const jobRelationContent = await fs.readFile(jobRelationPath, "utf-8");
    const jobRelation = JSON.parse(jobRelationContent) as JobRelation;

    expect(jobRelation.job_title).toBe("implement-auth");
    expect(jobRelation.goal).toBe("Implement Authentication");
    expect(jobRelation.status).toBe("pending");
    expect(jobRelation.divided_jobs).toEqual([]);
    expect(jobRelation.spec).toBe(specPath);

    // Spec 내용 검증
    const specContent = await fs.readFile(specPath, "utf-8");
    expect(specContent).toContain("# Implement Authentication");
    expect(specContent).toContain("JWT tokens, OAuth2");
    expect(specContent).toContain("Use existing user model");
    expect(specContent).toContain("All tests pass");
  });

  it("should return error when job_title is invalid (uppercase)", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "Implement-Auth",
      goal: "Implement Authentication",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("lowercase");
  });

  it("should return error when job_title exceeds 10 words", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "one-two-three-four-five-six-seven-eight-nine-ten-eleven",
      goal: "Test Goal",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("10 words");
  });

  it("should return error when goal is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_title: "test-job", goal: "" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("goal");
  });

  it("should return error when job already exists", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    // 첫 번째 생성
    await handler({ job_title: "test-job", goal: "Test Goal" });

    // 중복 생성 시도
    const result = await handler({ job_title: "test-job", goal: "Test Goal" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("이미 존재");
  });

  it("should create spec with optional fields omitted", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncInitJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      goal: string;
      requirements?: string;
      constraints?: string;
      acceptance_criteria?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    await handler({ job_title: "simple-task", goal: "Simple Task" });

    const specPath = ".dnc/simple-task/specs/simple-task.md";
    const specContent = await fs.readFile(specPath, "utf-8");

    expect(specContent).toContain("# Simple Task");
    expect(specContent).toContain("없음");
  });
});
