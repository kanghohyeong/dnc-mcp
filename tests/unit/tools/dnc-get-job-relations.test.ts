import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { registerDncGetJobRelationsTool } from "../../../src/tools/dnc-get-job-relations.js";
import { createTestMcpServer } from "../../helpers/test-utils.js";
import {
  writeJobRelation,
  ensureDncDirectory,
  type JobRelation,
} from "../../../src/utils/dnc-utils.js";

describe("dnc-get-job-relations tool", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-get");
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

    registerDncGetJobRelationsTool(mcpServer);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    expect(registerToolSpy.mock.calls[0][0]).toBe("dnc_get_job_relations");
  });

  it("should return simple job without divided_jobs", async () => {
    const job: JobRelation = {
      id: "job-simple",
      goal: "Simple Job",
      spec: ".dnc/job-simple/specs/job-simple.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("job-simple");
    await writeJobRelation("job-simple", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetJobRelationsTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_id: "job-simple" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("job-simple");
    expect(result.content[0].text).toContain("Simple Job");
    expect(result.content[0].text).toContain("pending");
  });

  it("should return job with divided_jobs", async () => {
    const job: JobRelation = {
      id: "job-parent",
      goal: "Parent Job",
      spec: ".dnc/job-parent/specs/job-parent.md",
      status: "in-progress",
      divided_jobs: [
        {
          id: "job-child-1",
          goal: "Child 1",
          spec: ".dnc/job-parent/specs/job-child-1.md",
          status: "done",
          divided_jobs: [],
        },
        {
          id: "job-child-2",
          goal: "Child 2",
          spec: ".dnc/job-parent/specs/job-child-2.md",
          status: "pending",
          divided_jobs: [],
        },
      ],
    };

    await ensureDncDirectory("job-parent");
    await writeJobRelation("job-parent", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetJobRelationsTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_id: "job-parent" });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;

    expect(text).toContain("job-parent");
    expect(text).toContain("Parent Job");
    expect(text).toContain("in-progress");
    expect(text).toContain("job-child-1");
    expect(text).toContain("Child 1");
    expect(text).toContain("done");
    expect(text).toContain("job-child-2");
    expect(text).toContain("Child 2");
    expect(text).toContain("pending");
  });

  it("should return deeply nested job structure", async () => {
    const job: JobRelation = {
      id: "job-root",
      goal: "Root Job",
      spec: ".dnc/job-root/specs/job-root.md",
      status: "in-progress",
      divided_jobs: [
        {
          id: "job-level-1",
          goal: "Level 1",
          spec: ".dnc/job-root/specs/job-level-1.md",
          status: "in-progress",
          divided_jobs: [
            {
              id: "job-level-2",
              goal: "Level 2",
              spec: ".dnc/job-root/specs/job-level-2.md",
              status: "pending",
              divided_jobs: [],
            },
          ],
        },
      ],
    };

    await ensureDncDirectory("job-root");
    await writeJobRelation("job-root", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetJobRelationsTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_id: "job-root" });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;

    expect(text).toContain("job-root");
    expect(text).toContain("job-level-1");
    expect(text).toContain("job-level-2");
    expect(text).toContain("Root Job");
    expect(text).toContain("Level 1");
    expect(text).toContain("Level 2");
  });

  it("should return error when job not found", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetJobRelationsTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_id: "non-existent" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("존재하지 않습니다");
  });

  it("should return error when job_id is missing", async () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetJobRelationsTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id?: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("job_id");
  });

  it("should handle corrupted JSON gracefully", async () => {
    await ensureDncDirectory("job-corrupted");
    await fs.writeFile(".dnc/job-corrupted/job_relation.json", "invalid json{", "utf-8");

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetJobRelationsTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_id: "job-corrupted" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("오류");
  });

  it("should return formatted JSON", async () => {
    const job: JobRelation = {
      id: "job-format",
      goal: "Format Test",
      spec: ".dnc/job-format/specs/job-format.md",
      status: "pending",
      divided_jobs: [],
    };

    await ensureDncDirectory("job-format");
    await writeJobRelation("job-format", job);

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool");
    registerDncGetJobRelationsTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2] as (args: {
      job_id: string;
    }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

    const result = await handler({ job_id: "job-format" });

    expect(result.isError).toBeUndefined();

    // JSON 파싱 가능 여부 확인
    const text = result.content[0].text;
    const jsonMatch = text.match(/```json\n([\s\S]+)\n```/);
    expect(jsonMatch).toBeTruthy();

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]) as JobRelation;
      expect(parsed.id).toBe("job-format");
      expect(parsed.goal).toBe("Format Test");
    }
  });
});
