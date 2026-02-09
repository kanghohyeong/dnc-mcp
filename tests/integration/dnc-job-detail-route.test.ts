import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type { Express } from "express";
import express from "express";
import { RouteRegistrar } from "../../src/services/route-registrar.js";
import type { DncJob } from "../../src/services/dnc-job-service.js";

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

    const routeRegistrar = new RouteRegistrar();
    routeRegistrar.registerRoutes(app);
  });

  afterEach(async () => {
    // 원래 cwd로 복원
    process.chdir(originalCwd);

    // 임시 디렉토리 정리
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("GET /dnc/jobs/:jobId", () => {
    it("should return 200 and render job detail page for existing job", async () => {
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
      expect(response.type).toBe("text/html");
      expect(response.text).toContain("job-test-123");
      expect(response.text).toContain("Test job");
      expect(response.text).toContain("pending");
    });

    it("should return 404 for non-existent job", async () => {
      // Act
      const response = await request(app).get("/dnc/jobs/non-existent-job");

      // Assert
      expect(response.status).toBe(404);
      expect(response.type).toBe("text/html");
    });

    it("should display different status styles", async () => {
      // Arrange: pending, in-progress, done 상태의 job 생성
      const dncDir = path.join(tempDir, ".dnc");

      const statuses: Array<"pending" | "in-progress" | "done"> = [
        "pending",
        "in-progress",
        "done",
      ];

      for (const status of statuses) {
        const jobDir = path.join(dncDir, `job-${status}`);
        await fs.mkdir(jobDir, { recursive: true });

        const job: DncJob = {
          id: `job-${status}`,
          goal: `Job with ${status} status`,
          spec: `.dnc/job-${status}/spec.md`,
          status,
          divided_jobs: [],
        };

        await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job));
        await fs.writeFile(path.join(jobDir, "spec.md"), `# Spec for ${status}`);

        // Act
        const response = await request(app).get(`/dnc/jobs/job-${status}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.text).toContain(`status-${status}`);
        expect(response.text).toContain(status);
      }
    });
  });
});
