import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type { Express } from "express";
import express from "express";
import { RouteRegistrar } from "../../src/services/route-registrar.js";
import { FileSystemDncTaskRepository } from "../../src/repositories/index.js";
import type { Task } from "../../src/repositories/index.js";

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
    app.set("views", path.join(originalCwd, "src", "views"));

    const repository = new FileSystemDncTaskRepository(path.join(tempDir, ".dnc"));
    const routeRegistrar = new RouteRegistrar(repository);
    routeRegistrar.registerRoutes(app);
  });

  afterEach(async () => {
    // 원래 cwd로 복원
    process.chdir(originalCwd);

    // 임시 디렉토리 정리
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("GET /:jobTitle", () => {
    it("should return 200 and render job detail page for existing job", async () => {
      // Arrange: task 생성
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "job-test-123");
      await fs.mkdir(jobDir, { recursive: true });

      const task: Task = {
        id: "job-test-123",
        goal: "Test job",
        acceptance: "All tests pass",
        status: "init",
        tasks: [],
      };

      await fs.writeFile(path.join(jobDir, "task.json"), JSON.stringify(task));

      // Act
      const response = await request(app).get("/job-test-123");

      // Assert
      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
      expect(response.text).toContain("job-test-123");
      expect(response.text).toContain("Test job");
      expect(response.text).toContain("init");
    });

    it("should return 404 for non-existent job", async () => {
      // Act
      const response = await request(app).get("/non-existent-job");

      // Assert
      expect(response.status).toBe(404);
      expect(response.type).toBe("text/html");
    });

    it("should display different status styles", async () => {
      // Arrange: pending, in-progress, done 상태의 task 생성
      const dncDir = path.join(tempDir, ".dnc");

      const statuses: Array<"init" | "in-progress" | "done"> = ["init", "in-progress", "done"];

      for (const status of statuses) {
        const jobDir = path.join(dncDir, `job-${status}`);
        await fs.mkdir(jobDir, { recursive: true });

        const task: Task = {
          id: `job-${status}`,
          goal: `Job with ${status} status`,
          acceptance: `${status} acceptance criteria`,
          status,
          tasks: [],
        };

        await fs.writeFile(path.join(jobDir, "task.json"), JSON.stringify(task));

        // Act
        const response = await request(app).get(`/job-${status}`);

        // Assert
        expect(response.status).toBe(200);
        // JavaScript가 클라이언트 사이드에서 렌더링하므로, jobData에 status가 포함되어 있는지 확인
        expect(response.text).toContain(`"status":"${status}"`);
      }
    });

    it("should display job ID from task.id field", async () => {
      // Arrange: task 생성
      const dncDir = path.join(tempDir, ".dnc");
      const jobDir = path.join(dncDir, "test-job-id");
      await fs.mkdir(jobDir, { recursive: true });

      const task: Task = {
        id: "test-job-id",
        goal: "Test job ID display",
        acceptance: "Job ID should be displayed correctly",
        status: "pending",
        tasks: [],
      };

      await fs.writeFile(path.join(jobDir, "task.json"), JSON.stringify(task));

      // Act
      const response = await request(app).get("/test-job-id");

      // Assert
      expect(response.status).toBe(200);
      // JavaScript가 클라이언트 사이드에서 렌더링하므로, jobData에 id가 포함되어 있는지 확인
      expect(response.text).toContain('"id":"test-job-id"');
      // renderTaskItem 함수가 포함되어 있는지 확인
      expect(response.text).toContain("renderTaskItem");
    });
  });
});
