import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncDeleteJobTool } from "../../../src/tools/dnc-delete-job.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import {
  writeJobRelation,
  ensureDncDirectory,
  type JobRelation,
} from "../../../src/utils/dnc-utils.js";

describe("dnc-delete-job tool", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-delete");
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

    registerDncDeleteJobTool(mcpServer);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    expect(registerToolSpy.mock.calls[0][0]).toBe("dnc_delete_job");
  });

  it("should delete root job and all files", async () => {
    const rootJob: JobRelation = {
      job_title: "job-to-delete",
      goal: "Job to Delete",
      spec: ".dnc/job-to-delete/specs/job-to-delete.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("job-to-delete");
    await writeJobRelation("job-to-delete", rootJob);
    await fs.writeFile(".dnc/job-to-delete/specs/job-to-delete.md", "# Test Spec", "utf-8");

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_title: "job-to-delete" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("삭제되었습니다");

    // 디렉토리가 삭제되었는지 확인
    const exists = await fs
      .access(".dnc/job-to-delete")
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("should delete child job from parent", async () => {
    const parentJob: JobRelation = {
      job_title: "job-parent",
      goal: "Parent Job",
      spec: ".dnc/job-parent/specs/job-parent.md",
      status: "pending",
      divided_jobs: [
        {
          job_title: "job-child-to-delete",
          goal: "Child to Delete",
          spec: ".dnc/job-parent/specs/job-child-to-delete.md",
          status: "pending",
          divided_jobs: [],
        },
        {
          job_title: "job-child-keep",
          goal: "Child to Keep",
          spec: ".dnc/job-parent/specs/job-child-keep.md",
          status: "pending",
          divided_jobs: [],
        },
      ],
    };

    await ensureDncDirectory("job-parent");
    await writeJobRelation("job-parent", parentJob);
    await fs.writeFile(".dnc/job-parent/specs/job-child-to-delete.md", "# Child Spec", "utf-8");
    await fs.writeFile(".dnc/job-parent/specs/job-child-keep.md", "# Keep Spec", "utf-8");

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
      parent_job_title?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({
      job_title: "job-child-to-delete",
      parent_job_title: "job-parent",
    });

    expect(result.isError).toBeUndefined();

    // Parent job의 divided_jobs 확인
    const jobRelationContent = await fs.readFile(".dnc/job-parent/job_relation.json", "utf-8");
    const updatedParent = JSON.parse(jobRelationContent) as JobRelation;

    expect(updatedParent.divided_jobs).toHaveLength(1);
    expect(updatedParent.divided_jobs[0].job_title).toBe("job-child-keep");

    // Spec 파일 삭제 확인
    const deletedSpecExists = await fs
      .access(".dnc/job-parent/specs/job-child-to-delete.md")
      .then(() => true)
      .catch(() => false);
    expect(deletedSpecExists).toBe(false);

    const keptSpecExists = await fs
      .access(".dnc/job-parent/specs/job-child-keep.md")
      .then(() => true)
      .catch(() => false);
    expect(keptSpecExists).toBe(true);
  });

  it("should recursively delete nested jobs", async () => {
    const rootJob: JobRelation = {
      job_title: "job-root",
      goal: "Root Job",
      spec: ".dnc/job-root/specs/job-root.md",
      status: "pending",
      divided_jobs: [
        {
          job_title: "job-child",
          goal: "Child Job",
          spec: ".dnc/job-root/specs/job-child.md",
          status: "pending",
          divided_jobs: [
            {
              job_title: "job-grandchild",
              goal: "Grandchild Job",
              spec: ".dnc/job-root/specs/job-grandchild.md",
              status: "pending",
              divided_jobs: [],
            },
          ],
        },
      ],
    };

    await ensureDncDirectory("job-root");
    await writeJobRelation("job-root", rootJob);
    await fs.writeFile(".dnc/job-root/specs/job-root.md", "# Root", "utf-8");
    await fs.writeFile(".dnc/job-root/specs/job-child.md", "# Child", "utf-8");
    await fs.writeFile(".dnc/job-root/specs/job-grandchild.md", "# Grandchild", "utf-8");

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_title: "job-root" });

    expect(result.isError).toBeUndefined();

    // 모든 파일 삭제 확인
    const exists = await fs
      .access(".dnc/job-root")
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("should return error when job not found", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_title: "non-existent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("존재하지 않습니다");
  });

  it("should return error when job_title is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncDeleteJobTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_title?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("job_title");
  });
});
