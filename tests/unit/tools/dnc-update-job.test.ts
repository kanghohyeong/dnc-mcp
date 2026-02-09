import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncUpdateJobTool } from "../../../src/tools/dnc-update-job.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import {
  writeJobRelation,
  ensureDncDirectory,
  type JobRelation,
} from "../../../src/utils/dnc-utils.js";

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

  it("should update job goal", async () => {
    const job: JobRelation = {
      id: "job-to-update",
      goal: "Original Goal",
      spec: ".dnc/job-to-update/specs/job-to-update.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeJobRelation("job-to-update", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
      goal?: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_id: "job-to-update",
      goal: "Updated Goal",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("업데이트되었습니다");

    const jobRelationContent = await fs.readFile(".dnc/job-to-update/job_relation.json", "utf-8");
    const updatedJob = JSON.parse(jobRelationContent) as JobRelation;

    expect(updatedJob.goal).toBe("Updated Goal");
    expect(updatedJob.status).toBe("pending"); // 변경되지 않음
  });

  it("should update job status", async () => {
    const job: JobRelation = {
      id: "job-to-update",
      goal: "Test Goal",
      spec: ".dnc/job-to-update/specs/job-to-update.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeJobRelation("job-to-update", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_id: "job-to-update",
      status: "in-progress",
    });

    expect(result.isError).toBeUndefined();

    const jobRelationContent = await fs.readFile(".dnc/job-to-update/job_relation.json", "utf-8");
    const updatedJob = JSON.parse(jobRelationContent) as JobRelation;

    expect(updatedJob.status).toBe("in-progress");
  });

  it("should update both goal and status", async () => {
    const job: JobRelation = {
      id: "job-to-update",
      goal: "Original Goal",
      spec: ".dnc/job-to-update/specs/job-to-update.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeJobRelation("job-to-update", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
      goal?: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_id: "job-to-update",
      goal: "New Goal",
      status: "done",
    });

    expect(result.isError).toBeUndefined();

    const jobRelationContent = await fs.readFile(".dnc/job-to-update/job_relation.json", "utf-8");
    const updatedJob = JSON.parse(jobRelationContent) as JobRelation;

    expect(updatedJob.goal).toBe("New Goal");
    expect(updatedJob.status).toBe("done");
  });

  it("should update child job in parent", async () => {
    const parentJob: JobRelation = {
      id: "job-parent",
      goal: "Parent Job",
      spec: ".dnc/job-parent/specs/job-parent.md",
      status: "pending",
      divided_jobs: [
        {
          id: "job-child",
          goal: "Original Child Goal",
          spec: ".dnc/job-parent/specs/job-child.md",
          status: "pending",
          divided_jobs: [],
        },
      ],
    };

    await ensureDncDirectory("job-parent");
    await writeJobRelation("job-parent", parentJob);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
      parent_job_id?: string;
      goal?: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_id: "job-child",
      parent_job_id: "job-parent",
      goal: "Updated Child Goal",
      status: "done",
    });

    expect(result.isError).toBeUndefined();

    const jobRelationContent = await fs.readFile(".dnc/job-parent/job_relation.json", "utf-8");
    const updatedParent = JSON.parse(jobRelationContent) as JobRelation;

    expect(updatedParent.divided_jobs[0].goal).toBe("Updated Child Goal");
    expect(updatedParent.divided_jobs[0].status).toBe("done");
  });

  it("should return error for invalid status", async () => {
    const job: JobRelation = {
      id: "job-to-update",
      goal: "Test Goal",
      spec: ".dnc/job-to-update/specs/job-to-update.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeJobRelation("job-to-update", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
      status?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_id: "job-to-update",
      status: "invalid-status",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("유효하지 않은 상태");
  });

  it("should return error when job not found", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
      goal?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_id: "non-existent",
      goal: "New Goal",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("존재하지 않습니다");
  });

  it("should return error when no updates provided", async () => {
    const job: JobRelation = {
      id: "job-to-update",
      goal: "Test Goal",
      spec: ".dnc/job-to-update/specs/job-to-update.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("job-to-update");
    await writeJobRelation("job-to-update", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_id: "job-to-update" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("업데이트할 내용");
  });

  it("should return error when job_id is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncUpdateJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("job_id");
  });
});
