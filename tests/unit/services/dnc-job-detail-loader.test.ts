import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { DncJobDetailLoader } from "../../../src/services/dnc-job-detail-loader.js";
import type { DncJob } from "../../../src/services/dnc-job-service.js";

describe("DncJobDetailLoader", () => {
  let tempDir: string;
  let loader: DncJobDetailLoader;

  beforeEach(async () => {
    // 임시 디렉토리 생성
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnc-test-"));
    loader = new DncJobDetailLoader(tempDir);
  });

  afterEach(async () => {
    // 임시 디렉토리 정리
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("loadJobWithDetails", () => {
    it("should load job with spec content", async () => {
      // Arrange: job_relation.json과 spec 파일 생성
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "job-test-123");
      await fs.mkdir(jobDir, { recursive: true });

      const job: DncJob = {
        job_title: "job-test-123",
        goal: "Test job",
        spec: ".dnc/job-test-123/spec.md",
        status: "pending",
        divided_jobs: [],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job));
      await fs.writeFile(path.join(jobDir, "spec.md"), "# Test Spec\n\nThis is a test spec.");

      // Act
      const result = await loader.loadJobWithDetails(job);

      // Assert
      expect(result).toEqual({
        job_title: "job-test-123",
        goal: "Test job",
        spec: ".dnc/job-test-123/spec.md",
        status: "pending",
        specContent: "# Test Spec\n\nThis is a test spec.",
        divided_jobs: [],
      });
    });

    it("should load job with divided_jobs recursively", async () => {
      // Arrange: 계층 구조의 job 생성
      const dncDir = path.join(tempDir, ".dnc");
      const rootJobDir = path.join(dncDir, "job-root");
      await fs.mkdir(rootJobDir, { recursive: true });

      const childJob: DncJob = {
        job_title: "job-child",
        goal: "Child job",
        spec: ".dnc/job-root/child-spec.md",
        status: "pending",
        divided_jobs: [],
      };

      const rootJob: DncJob = {
        job_title: "job-root",
        goal: "Root job",
        spec: ".dnc/job-root/root-spec.md",
        status: "in-progress",
        divided_jobs: [childJob],
      };

      await fs.writeFile(path.join(rootJobDir, "job_relation.json"), JSON.stringify(rootJob));
      await fs.writeFile(path.join(rootJobDir, "root-spec.md"), "# Root Spec");
      await fs.writeFile(path.join(rootJobDir, "child-spec.md"), "# Child Spec");

      // Act
      const result = await loader.loadJobWithDetails(rootJob);

      // Assert
      expect(result.specContent).toBe("# Root Spec");
      expect(result.divided_jobs).toHaveLength(1);
      expect(result.divided_jobs[0].specContent).toBe("# Child Spec");
    });

    it("should load deeply nested divided_jobs", async () => {
      // Arrange: 깊은 계층 구조 (depth 3)
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "job-deep");
      await fs.mkdir(jobDir, { recursive: true });

      const grandchildJob: DncJob = {
        job_title: "job-grandchild",
        goal: "Grandchild job",
        spec: ".dnc/job-deep/grandchild-spec.md",
        status: "pending",
        divided_jobs: [],
      };

      const childJob: DncJob = {
        job_title: "job-child",
        goal: "Child job",
        spec: ".dnc/job-deep/child-spec.md",
        status: "in-progress",
        divided_jobs: [grandchildJob],
      };

      const rootJob: DncJob = {
        job_title: "job-deep",
        goal: "Root job",
        spec: ".dnc/job-deep/root-spec.md",
        status: "in-progress",
        divided_jobs: [childJob],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(rootJob));
      await fs.writeFile(path.join(jobDir, "root-spec.md"), "# Root");
      await fs.writeFile(path.join(jobDir, "child-spec.md"), "# Child");
      await fs.writeFile(path.join(jobDir, "grandchild-spec.md"), "# Grandchild");

      // Act
      const result = await loader.loadJobWithDetails(rootJob);

      // Assert
      expect(result.specContent).toBe("# Root");
      expect(result.divided_jobs[0].specContent).toBe("# Child");
      expect(result.divided_jobs[0].divided_jobs[0].specContent).toBe("# Grandchild");
    });

    it("should handle empty spec file", async () => {
      // Arrange
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "job-empty-spec");
      await fs.mkdir(jobDir, { recursive: true });

      const job: DncJob = {
        job_title: "job-empty-spec",
        goal: "Job with empty spec",
        spec: ".dnc/job-empty-spec/empty.md",
        status: "pending",
        divided_jobs: [],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job));
      await fs.writeFile(path.join(jobDir, "empty.md"), "");

      // Act
      const result = await loader.loadJobWithDetails(job);

      // Assert
      expect(result.specContent).toBe("");
    });

    it("should throw error when spec file does not exist", async () => {
      // Arrange
      const job: DncJob = {
        job_title: "job-no-spec",
        goal: "Job with missing spec",
        spec: ".dnc/job-no-spec/missing.md",
        status: "pending",
        divided_jobs: [],
      };

      // Act & Assert
      await expect(loader.loadJobWithDetails(job)).rejects.toThrow();
    });

    it("should throw error when spec path is absolute", async () => {
      // Arrange
      const job: DncJob = {
        job_title: "job-absolute-path",
        goal: "Job with absolute path",
        spec: "/absolute/path/spec.md",
        status: "pending",
        divided_jobs: [],
      };

      // Act & Assert
      await expect(loader.loadJobWithDetails(job)).rejects.toThrow();
    });

    it("should handle multiple divided_jobs at same level", async () => {
      // Arrange
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "job-multiple");
      await fs.mkdir(jobDir, { recursive: true });

      const child1: DncJob = {
        job_title: "job-child-1",
        goal: "Child 1",
        spec: ".dnc/job-multiple/child1.md",
        status: "done",
        divided_jobs: [],
      };

      const child2: DncJob = {
        job_title: "job-child-2",
        goal: "Child 2",
        spec: ".dnc/job-multiple/child2.md",
        status: "pending",
        divided_jobs: [],
      };

      const rootJob: DncJob = {
        job_title: "job-multiple",
        goal: "Root with multiple children",
        spec: ".dnc/job-multiple/root.md",
        status: "in-progress",
        divided_jobs: [child1, child2],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(rootJob));
      await fs.writeFile(path.join(jobDir, "root.md"), "# Root");
      await fs.writeFile(path.join(jobDir, "child1.md"), "# Child 1");
      await fs.writeFile(path.join(jobDir, "child2.md"), "# Child 2");

      // Act
      const result = await loader.loadJobWithDetails(rootJob);

      // Assert
      expect(result.divided_jobs).toHaveLength(2);
      expect(result.divided_jobs[0].specContent).toBe("# Child 1");
      expect(result.divided_jobs[1].specContent).toBe("# Child 2");
    });
  });

  describe("loadJobByTitleWithDetails", () => {
    it("should load job by title from root job directory", async () => {
      // Arrange
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "find-me-job");
      await fs.mkdir(jobDir, { recursive: true });

      const job: DncJob = {
        job_title: "find-me-job",
        goal: "Find this job",
        spec: ".dnc/find-me-job/spec.md",
        status: "pending",
        divided_jobs: [],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job));
      await fs.writeFile(path.join(jobDir, "spec.md"), "# Found Spec");

      // Act
      const result = await loader.loadJobByTitleWithDetails("find-me-job");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.job_title).toBe("find-me-job");
      expect(result?.specContent).toBe("# Found Spec");
    });

    it("should load job from nested divided_jobs", async () => {
      // Arrange
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "parent-job");
      await fs.mkdir(jobDir, { recursive: true });

      const childJob: DncJob = {
        job_title: "nested-child-job",
        goal: "Nested child",
        spec: ".dnc/parent-job/child.md",
        status: "pending",
        divided_jobs: [],
      };

      const parentJob: DncJob = {
        job_title: "parent-job",
        goal: "Parent job",
        spec: ".dnc/parent-job/parent.md",
        status: "in-progress",
        divided_jobs: [childJob],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(parentJob));
      await fs.writeFile(path.join(jobDir, "parent.md"), "# Parent");
      await fs.writeFile(path.join(jobDir, "child.md"), "# Child");

      // Act
      const result = await loader.loadJobByTitleWithDetails("nested-child-job");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.job_title).toBe("nested-child-job");
      expect(result?.specContent).toBe("# Child");
    });

    it("should return null when job not found", async () => {
      // Act
      const result = await loader.loadJobByTitleWithDetails("non-existent-job");

      // Assert
      expect(result).toBeNull();
    });
  });
});
