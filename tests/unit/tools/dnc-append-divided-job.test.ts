import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncAppendDividedJobTool } from "../../../src/tools/dnc-append-divided-job.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import {
  writeJobRelation,
  ensureDncDirectory,
  type JobRelation,
} from "../../../src/utils/dnc-utils.js";

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
    // 부모 job 생성
    const parentJob: JobRelation = {
      job_title: "parent-job",
      goal: "Parent Job",
      spec: ".dnc/parent-job/specs/parent-job.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("parent-job");
    await writeJobRelation("parent-job", parentJob);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      parent_job_title: string;
      child_job_title: string;
      child_goal: string;
      requirements?: string;
      constraints?: string;
      acceptance_criteria?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      parent_job_title: "parent-job",
      child_job_title: "child-task",
      child_goal: "Child Task",
      requirements: "Requirement 1",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("추가되었습니다");

    // 부모 job 검증
    const jobRelationContent = await fs.readFile(".dnc/parent-job/job_relation.json", "utf-8");
    const updatedParent = JSON.parse(jobRelationContent) as JobRelation;

    expect(updatedParent.divided_jobs).toHaveLength(1);
    expect(updatedParent.divided_jobs[0].goal).toBe("Child Task");
    expect(updatedParent.divided_jobs[0].job_title).toBe("child-task");

    // Spec 파일 검증
    const specPath = ".dnc/parent-job/specs/child-task.md";
    const specExists = await fs
      .access(specPath)
      .then(() => true)
      .catch(() => false);
    expect(specExists).toBe(true);

    const specContent = await fs.readFile(specPath, "utf-8");
    expect(specContent).toContain("# Child Task");
    expect(specContent).toContain("Requirement 1");
  });

  it("should return error when parent job not found", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      parent_job_title: string;
      child_job_title: string;
      child_goal: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      parent_job_title: "non-existent",
      child_job_title: "child-task",
      child_goal: "Child Task",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("존재하지 않습니다");
  });

  it("should prevent duplicate child job titles", async () => {
    // 부모 job 생성
    const parentJob: JobRelation = {
      job_title: "parent-job",
      goal: "Parent Job",
      spec: ".dnc/parent-job/specs/parent-job.md",
      status: "pending",
      divided_jobs: [
        {
          job_title: "existing-child",
          goal: "Existing Child",
          spec: ".dnc/parent-job/specs/existing-child.md",
          status: "pending",
          divided_jobs: [],
        },
      ],
    };

    await ensureDncDirectory("parent-job");
    await writeJobRelation("parent-job", parentJob);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      parent_job_title: string;
      child_job_title: string;
      child_goal: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      parent_job_title: "parent-job",
      child_job_title: "existing-child",
      child_goal: "Existing Child",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("이미 존재");
  });

  it("should handle empty child_goal", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      parent_job_title: string;
      child_job_title: string;
      child_goal: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      parent_job_title: "parent-job",
      child_job_title: "child-task",
      child_goal: "",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("child_goal");
  });

  it("should append multiple divided jobs", async () => {
    const parentJob: JobRelation = {
      job_title: "parent-job",
      goal: "Parent Job",
      spec: ".dnc/parent-job/specs/parent-job.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("parent-job");
    await writeJobRelation("parent-job", parentJob);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      parent_job_title: string;
      child_job_title: string;
      child_goal: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    await handler({
      parent_job_title: "parent-job",
      child_job_title: "child-1",
      child_goal: "Child 1",
    });
    await handler({
      parent_job_title: "parent-job",
      child_job_title: "child-2",
      child_goal: "Child 2",
    });
    await handler({
      parent_job_title: "parent-job",
      child_job_title: "child-3",
      child_goal: "Child 3",
    });

    const jobRelationContent = await fs.readFile(".dnc/parent-job/job_relation.json", "utf-8");
    const updatedParent = JSON.parse(jobRelationContent) as JobRelation;

    expect(updatedParent.divided_jobs).toHaveLength(3);
    expect(updatedParent.divided_jobs[0].goal).toBe("Child 1");
    expect(updatedParent.divided_jobs[1].goal).toBe("Child 2");
    expect(updatedParent.divided_jobs[2].goal).toBe("Child 3");
  });

  it("should return error for invalid child_job_title format", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncAppendDividedJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      parent_job_title: string;
      child_job_title: string;
      child_goal: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      parent_job_title: "parent-job",
      child_job_title: "Invalid Title With Spaces",
      child_goal: "Child Task",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("child_job_title이 유효하지 않습니다");
  });
});
