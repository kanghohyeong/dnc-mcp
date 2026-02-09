import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import {
  generateJobId,
  readJobRelation,
  writeJobRelation,
  ensureDncDirectory,
  getJobPath,
  getSpecPath,
  validateJobStatus,
  type JobRelation,
} from "../../../src/utils/dnc-utils.js";

describe("dnc-utils", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test");
  const originalCwd = process.cwd();

  beforeEach(async () => {
    // 테스트용 임시 디렉토리 생성
    await fs.mkdir(testRoot, { recursive: true });
    process.chdir(testRoot);
  });

  afterEach(async () => {
    // 테스트 디렉토리 정리
    process.chdir(originalCwd);
    await fs.rm(testRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("generateJobId", () => {
    it("should generate job ID from goal in kebab-case", () => {
      const goal = "인증 기능 구현";
      const jobId = generateJobId(goal);
      expect(jobId).toMatch(/^job-[a-z0-9-]+$/);
      expect(jobId).toContain("job-");
    });

    it("should handle English goal", () => {
      const goal = "Implement Authentication";
      const jobId = generateJobId(goal);
      expect(jobId).toBe("job-implement-authentication");
    });

    it("should handle special characters", () => {
      const goal = "Add User@Profile & Settings!";
      const jobId = generateJobId(goal);
      expect(jobId).toMatch(/^job-[a-z0-9-]+$/);
      expect(jobId).not.toContain("@");
      expect(jobId).not.toContain("&");
      expect(jobId).not.toContain("!");
    });

    it("should handle very long goal", () => {
      const goal = "a".repeat(200);
      const jobId = generateJobId(goal);
      expect(jobId.length).toBeLessThanOrEqual(100);
    });

    it("should handle empty string", () => {
      const goal = "";
      const jobId = generateJobId(goal);
      expect(jobId).toBe("job-untitled");
    });
  });

  describe("validateJobStatus", () => {
    it("should return true for valid statuses", () => {
      expect(validateJobStatus("pending")).toBe(true);
      expect(validateJobStatus("in-progress")).toBe(true);
      expect(validateJobStatus("done")).toBe(true);
    });

    it("should return false for invalid statuses", () => {
      expect(validateJobStatus("invalid")).toBe(false);
      expect(validateJobStatus("")).toBe(false);
      expect(validateJobStatus("PENDING")).toBe(false);
    });
  });

  describe("getJobPath", () => {
    it("should return correct job relation path", () => {
      const jobId = "job-test";
      const jobPath = getJobPath(jobId);
      expect(jobPath).toBe(".dnc/job-test/job_relation.json");
    });
  });

  describe("getSpecPath", () => {
    it("should return correct spec file path", () => {
      const rootJobId = "job-test";
      const jobId = "job-test-child";
      const specPath = getSpecPath(rootJobId, jobId);
      expect(specPath).toBe(".dnc/job-test/specs/job-test-child.md");
    });
  });

  describe("ensureDncDirectory", () => {
    it("should create .dnc directory structure", async () => {
      const jobId = "job-test";
      await ensureDncDirectory(jobId);

      const dncExists = await fs
        .access(".dnc")
        .then(() => true)
        .catch(() => false);
      const jobDirExists = await fs
        .access(`.dnc/${jobId}`)
        .then(() => true)
        .catch(() => false);
      const specsDirExists = await fs
        .access(`.dnc/${jobId}/specs`)
        .then(() => true)
        .catch(() => false);

      expect(dncExists).toBe(true);
      expect(jobDirExists).toBe(true);
      expect(specsDirExists).toBe(true);
    });

    it("should not throw if directories already exist", async () => {
      const jobId = "job-test";
      await ensureDncDirectory(jobId);
      await expect(ensureDncDirectory(jobId)).resolves.not.toThrow();
    });
  });

  describe("writeJobRelation and readJobRelation", () => {
    it("should write and read job relation correctly", async () => {
      const jobRelation: JobRelation = {
        id: "job-test",
        goal: "Test Goal",
        spec: ".dnc/job-test/specs/job-test.md",
        status: "pending",
        divided_jobs: [],
      };

      await ensureDncDirectory("job-test");
      await writeJobRelation("job-test", jobRelation);

      const readRelation = await readJobRelation("job-test");
      expect(readRelation).toEqual(jobRelation);
    });

    it("should throw error when reading non-existent job", async () => {
      await expect(readJobRelation("non-existent")).rejects.toThrow();
    });

    it("should handle job with divided_jobs", async () => {
      const jobRelation: JobRelation = {
        id: "job-parent",
        goal: "Parent Job",
        spec: ".dnc/job-parent/specs/job-parent.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "job-child",
            goal: "Child Job",
            spec: ".dnc/job-parent/specs/job-child.md",
            status: "pending",
            divided_jobs: [],
          },
        ],
      };

      await ensureDncDirectory("job-parent");
      await writeJobRelation("job-parent", jobRelation);

      const readRelation = await readJobRelation("job-parent");
      expect(readRelation.divided_jobs).toHaveLength(1);
      expect(readRelation.divided_jobs[0].id).toBe("job-child");
    });

    it("should throw error on invalid JSON", async () => {
      const jobId = "job-invalid";
      await ensureDncDirectory(jobId);
      await fs.writeFile(getJobPath(jobId), "invalid json", "utf-8");

      await expect(readJobRelation(jobId)).rejects.toThrow();
    });
  });
});
