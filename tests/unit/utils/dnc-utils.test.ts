import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import {
  readJobRelation,
  writeJobRelation,
  ensureDncDirectory,
  getJobPath,
  getSpecPath,
  validateJobStatus,
  validateJobTitle,
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

  describe("validateJobTitle", () => {
    it("should accept valid job title with 3 words", () => {
      const result = validateJobTitle("implement-user-auth");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid job title with numbers", () => {
      const result = validateJobTitle("fix-bug-123");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid job title with exactly 10 words", () => {
      const result = validateJobTitle("one-two-three-four-five-six-seven-eight-nine-ten");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject job title with more than 10 words", () => {
      const result = validateJobTitle("one-two-three-four-five-six-seven-eight-nine-ten-eleven");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("10 words");
    });

    it("should reject job title with uppercase letters", () => {
      const result = validateJobTitle("Implement-Auth");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("lowercase");
    });

    it("should reject job title with underscores", () => {
      const result = validateJobTitle("implement_auth");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("lowercase letters, numbers, and hyphens");
    });

    it("should reject job title with spaces", () => {
      const result = validateJobTitle("implement auth");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("lowercase letters, numbers, and hyphens");
    });

    it("should reject empty job title", () => {
      const result = validateJobTitle("");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    it("should reject job title with leading hyphen", () => {
      const result = validateJobTitle("-implement");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot start/end with hyphen");
    });

    it("should reject job title with trailing hyphen", () => {
      const result = validateJobTitle("implement-");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot start/end with hyphen");
    });

    it("should reject job title with consecutive hyphens", () => {
      const result = validateJobTitle("implement--auth");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("consecutive hyphens");
    });
  });

  describe("getJobPath", () => {
    it("should return correct job relation path", () => {
      const jobTitle = "test-job";
      const jobPath = getJobPath(jobTitle);
      expect(jobPath).toBe(".dnc/test-job/job_relation.json");
    });
  });

  describe("getSpecPath", () => {
    it("should return correct spec file path", () => {
      const rootJobTitle = "test-job";
      const jobTitle = "test-child-job";
      const specPath = getSpecPath(rootJobTitle, jobTitle);
      expect(specPath).toBe(".dnc/test-job/specs/test-child-job.md");
    });
  });

  describe("ensureDncDirectory", () => {
    it("should create .dnc directory structure", async () => {
      const jobTitle = "test-job";
      await ensureDncDirectory(jobTitle);

      const dncExists = await fs
        .access(".dnc")
        .then(() => true)
        .catch(() => false);
      const jobDirExists = await fs
        .access(`.dnc/${jobTitle}`)
        .then(() => true)
        .catch(() => false);
      const specsDirExists = await fs
        .access(`.dnc/${jobTitle}/specs`)
        .then(() => true)
        .catch(() => false);

      expect(dncExists).toBe(true);
      expect(jobDirExists).toBe(true);
      expect(specsDirExists).toBe(true);
    });

    it("should not throw if directories already exist", async () => {
      const jobTitle = "test-job";
      await ensureDncDirectory(jobTitle);
      await expect(ensureDncDirectory(jobTitle)).resolves.not.toThrow();
    });
  });

  describe("writeJobRelation and readJobRelation", () => {
    it("should write and read job relation correctly", async () => {
      const jobRelation: JobRelation = {
        job_title: "test-job",
        goal: "Test Goal",
        spec: ".dnc/test-job/specs/test-job.md",
        status: "pending",
        divided_jobs: [],
      };

      await ensureDncDirectory("test-job");
      await writeJobRelation("test-job", jobRelation);

      const readRelation = await readJobRelation("test-job");
      expect(readRelation).toEqual(jobRelation);
    });

    it("should throw error when reading non-existent job", async () => {
      await expect(readJobRelation("non-existent")).rejects.toThrow();
    });

    it("should handle job with divided_jobs", async () => {
      const jobRelation: JobRelation = {
        job_title: "parent-job",
        goal: "Parent Job",
        spec: ".dnc/parent-job/specs/parent-job.md",
        status: "in-progress",
        divided_jobs: [
          {
            job_title: "child-job",
            goal: "Child Job",
            spec: ".dnc/parent-job/specs/child-job.md",
            status: "pending",
            divided_jobs: [],
          },
        ],
      };

      await ensureDncDirectory("parent-job");
      await writeJobRelation("parent-job", jobRelation);

      const readRelation = await readJobRelation("parent-job");
      expect(readRelation.divided_jobs).toHaveLength(1);
      expect(readRelation.divided_jobs[0].job_title).toBe("child-job");
    });

    it("should throw error on invalid JSON", async () => {
      const jobTitle = "invalid-job";
      await ensureDncDirectory(jobTitle);
      await fs.writeFile(getJobPath(jobTitle), "invalid json", "utf-8");

      await expect(readJobRelation(jobTitle)).rejects.toThrow();
    });
  });
});
