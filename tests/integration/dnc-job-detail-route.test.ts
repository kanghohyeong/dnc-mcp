import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type { Express } from "express";
import express from "express";
import { RouteRegistrar } from "../../src/services/route-registrar.js";
import { HistoryService } from "../../src/services/history-service.js";
import { ConnectionManager } from "../../src/services/connection-manager.js";
import type { DncJob, DncJobWithDetails } from "../../src/services/dnc-job-service.js";

describe("DnC Job Detail Route", () => {
  let app: Express;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // 임시 디렉토리 생성
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnc-route-test-"));
    originalCwd = process.cwd();

    // 임시 디렉토리로 cwd 변경
    process.chdir(tempDir);

    // Express 앱 설정
    app = express();
    app.set("view engine", "ejs");
    app.set("views", path.join(originalCwd, "views"));

    const historyService = HistoryService.getInstance();
    const connectionManager = new ConnectionManager(historyService);
    const routeRegistrar = new RouteRegistrar(historyService, connectionManager);
    routeRegistrar.registerRoutes(app);
  });

  afterEach(async () => {
    // 원래 cwd로 복원
    process.chdir(originalCwd);

    // 임시 디렉토리 정리
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("GET /dnc/jobs/:jobId", () => {
    it("should return 200 and job details with spec content for existing job", async () => {
      // Arrange: job 생성
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "job-test-123");
      await fs.mkdir(jobDir, { recursive: true });

      const job: DncJob = {
        id: "job-test-123",
        goal: "Test job",
        spec: ".dnc/job-test-123/spec.md",
        status: "pending",
        divided_jobs: [],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job));
      await fs.writeFile(path.join(jobDir, "spec.md"), "# Test Spec\n\nThis is a test spec.");

      // Act
      const response = await request(app).get("/dnc/jobs/job-test-123");

      // Assert
      expect(response.status).toBe(200);
      const jobData = response.body as DncJobWithDetails;
      expect(jobData).toMatchObject({
        id: "job-test-123",
        goal: "Test job",
        spec: ".dnc/job-test-123/spec.md",
        status: "pending",
        specContent: "# Test Spec\n\nThis is a test spec.",
        divided_jobs: [],
      });
    });

    it("should return 404 for non-existent job", async () => {
      // Act
      const response = await request(app).get("/dnc/jobs/non-existent-job");

      // Assert
      expect(response.status).toBe(404);
      const errorData = response.body as { error: string; jobId: string };
      expect(errorData).toMatchObject({
        error: "Job not found",
        jobId: "non-existent-job",
      });
    });

    it("should handle job with divided_jobs recursively", async () => {
      // Arrange
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "job-parent");
      await fs.mkdir(jobDir, { recursive: true });

      const childJob: DncJob = {
        id: "job-child",
        goal: "Child job",
        spec: ".dnc/job-parent/child-spec.md",
        status: "pending",
        divided_jobs: [],
      };

      const parentJob: DncJob = {
        id: "job-parent",
        goal: "Parent job",
        spec: ".dnc/job-parent/parent-spec.md",
        status: "in-progress",
        divided_jobs: [childJob],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(parentJob));
      await fs.writeFile(path.join(jobDir, "parent-spec.md"), "# Parent Spec");
      await fs.writeFile(path.join(jobDir, "child-spec.md"), "# Child Spec");

      // Act
      const response = await request(app).get("/dnc/jobs/job-parent");

      // Assert
      expect(response.status).toBe(200);
      const jobData = response.body as DncJobWithDetails;
      expect(jobData.id).toBe("job-parent");
      expect(jobData.goal).toBe("Parent job");
      expect(jobData.specContent).toBe("# Parent Spec");
      expect(jobData.divided_jobs).toHaveLength(1);
      expect(jobData.divided_jobs[0].specContent).toBe("# Child Spec");
    });

    it("should handle nested job in divided_jobs", async () => {
      // Arrange
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "job-root");
      await fs.mkdir(jobDir, { recursive: true });

      const childJob: DncJob = {
        id: "job-nested-child",
        goal: "Nested child",
        spec: ".dnc/job-root/child.md",
        status: "pending",
        divided_jobs: [],
      };

      const rootJob: DncJob = {
        id: "job-root",
        goal: "Root job",
        spec: ".dnc/job-root/root.md",
        status: "in-progress",
        divided_jobs: [childJob],
      };

      await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(rootJob));
      await fs.writeFile(path.join(jobDir, "root.md"), "# Root");
      await fs.writeFile(path.join(jobDir, "child.md"), "# Child");

      // Act: nested child에 직접 접근
      const response = await request(app).get("/dnc/jobs/job-nested-child");

      // Assert
      expect(response.status).toBe(200);
      const jobData = response.body as DncJobWithDetails;
      expect(jobData.id).toBe("job-nested-child");
      expect(jobData.goal).toBe("Nested child");
      expect(jobData.specContent).toBe("# Child");
    });
  });
});
