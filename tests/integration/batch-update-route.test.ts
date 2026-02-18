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

interface BatchUpdateResponse {
  success: boolean;
  results: Array<{
    taskId: string;
    success: boolean;
    error?: string;
  }>;
}

interface ErrorResponse {
  error: string;
}

describe("Batch Update Route - POST /api/tasks/batch-update", () => {
  let app: Express;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // 임시 디렉토리 생성
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "batch-update-test-"));
    originalCwd = process.cwd();

    // 임시 디렉토리로 cwd 변경
    process.chdir(tempDir);

    // Express 앱 설정
    app = express();
    app.use(express.json()); // JSON 파싱 미들웨어

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

  describe("✅ 정상 동작 케이스", () => {
    it("should update single task status successfully", async () => {
      // Arrange: task 생성
      const dncDir = path.join(tempDir, ".dnc");
      const rootDir = path.join(dncDir, "root-task");
      await fs.mkdir(rootDir, { recursive: true });

      const rootTask: Task = {
        id: "root-task",
        goal: "Root task",
        acceptance: "Root acceptance",
        status: "init",
        tasks: [],
      };

      await fs.writeFile(path.join(rootDir, "task.json"), JSON.stringify(rootTask, null, 2));

      // Act: 단일 task 상태 업데이트
      const response = await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "root-task",
              rootTaskId: "root-task",
              status: "done",
            },
          ],
        });

      // Assert
      expect(response.status).toBe(200);
      const body = response.body as BatchUpdateResponse;
      expect(body).toEqual({
        success: true,
        results: [
          {
            taskId: "root-task",
            success: true,
          },
        ],
      });

      // 파일 시스템 검증
      const updatedTask = JSON.parse(
        await fs.readFile(path.join(rootDir, "task.json"), "utf-8")
      ) as Task;
      expect(updatedTask.status).toBe("done");
    });

    it("should update multiple tasks simultaneously", async () => {
      // Arrange: 여러 task 생성
      const dncDir = path.join(tempDir, ".dnc");
      const rootDir = path.join(dncDir, "root-task");
      await fs.mkdir(rootDir, { recursive: true });

      const rootTask: Task = {
        id: "root-task",
        goal: "Root task",
        acceptance: "Root acceptance",
        status: "init",
        tasks: [
          {
            id: "child-1",
            goal: "Child 1",
            acceptance: "Child 1 acceptance",
            status: "init",
            tasks: [],
          },
          {
            id: "child-2",
            goal: "Child 2",
            acceptance: "Child 2 acceptance",
            status: "init",
            tasks: [],
          },
        ],
      };

      await fs.writeFile(path.join(rootDir, "task.json"), JSON.stringify(rootTask, null, 2));

      // Act: 여러 task 동시 업데이트
      const response = await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "root-task",
              rootTaskId: "root-task",
              status: "in-progress",
            },
            {
              taskId: "child-1",
              rootTaskId: "root-task",
              status: "done",
            },
            {
              taskId: "child-2",
              rootTaskId: "root-task",
              status: "accept",
            },
          ],
        });

      // Assert
      expect(response.status).toBe(200);
      const body = response.body as BatchUpdateResponse;
      expect(body.success).toBe(true);
      expect(body.results).toHaveLength(3);
      expect(body.results.every((r) => r.success)).toBe(true);
    });
  });

  describe("❌ 에러 처리 케이스", () => {
    it("should return 400 when updates array is empty", async () => {
      const response = await request(app).post("/api/tasks/batch-update").send({
        updates: [],
      });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.error).toBe("Updates array cannot be empty");
    });

    it("should handle non-existent task gracefully", async () => {
      // Arrange: root task만 생성
      const dncDir = path.join(tempDir, ".dnc");
      const rootDir = path.join(dncDir, "root-task");
      await fs.mkdir(rootDir, { recursive: true });

      const rootTask: Task = {
        id: "root-task",
        goal: "Root task",
        acceptance: "Root acceptance",
        status: "init",
        tasks: [],
      };

      await fs.writeFile(path.join(rootDir, "task.json"), JSON.stringify(rootTask, null, 2));

      // Act: 존재하지 않는 task 업데이트 시도
      const response = await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "non-existent",
              rootTaskId: "root-task",
              status: "done",
            },
          ],
        });

      // Assert
      expect(response.status).toBe(200);
      const body = response.body as BatchUpdateResponse;
      expect(body.results[0]).toEqual({
        taskId: "non-existent",
        success: false,
        error: expect.stringContaining("Task not found") as string,
      });
    });

    it("should return 400 for invalid status value", async () => {
      const response = await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "test-task",
              rootTaskId: "root-task",
              status: "invalid-status",
            },
          ],
        });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.error).toContain("Invalid status");
    });

    it("should return 400 when required fields are missing", async () => {
      const response = await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "test-task",
              // rootTaskId 누락
              status: "done",
            },
          ],
        });

      expect(response.status).toBe(400);
      const body = response.body as ErrorResponse;
      expect(body.error).toBeDefined();
    });
  });

  describe("🔄 부분 성공 케이스", () => {
    it("should return mixed results when some tasks succeed and some fail", async () => {
      // Arrange
      const dncDir = path.join(tempDir, ".dnc");
      const rootDir = path.join(dncDir, "root-task");
      await fs.mkdir(rootDir, { recursive: true });

      const rootTask: Task = {
        id: "root-task",
        goal: "Root task",
        acceptance: "Root acceptance",
        status: "init",
        tasks: [
          {
            id: "child-1",
            goal: "Child 1",
            acceptance: "Child 1 acceptance",
            status: "init",
            tasks: [],
          },
        ],
      };

      await fs.writeFile(path.join(rootDir, "task.json"), JSON.stringify(rootTask, null, 2));

      // Act: 일부는 성공, 일부는 실패
      const response = await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "child-1",
              rootTaskId: "root-task",
              status: "done",
            },
            {
              taskId: "non-existent",
              rootTaskId: "root-task",
              status: "done",
            },
            {
              taskId: "root-task",
              rootTaskId: "root-task",
              status: "in-progress",
            },
          ],
        });

      // Assert
      expect(response.status).toBe(200);
      const body = response.body as BatchUpdateResponse;
      expect(body.success).toBe(true);
      expect(body.results).toHaveLength(3);

      const successCount = body.results.filter((r) => r.success).length;
      const failCount = body.results.filter((r) => !r.success).length;

      expect(successCount).toBe(2);
      expect(failCount).toBe(1);
    });
  });

  describe("📏 경계값 테스트", () => {
    it("should handle batch update of 10 tasks", async () => {
      // Arrange
      const dncDir = path.join(tempDir, ".dnc");
      const rootDir = path.join(dncDir, "root-task");
      await fs.mkdir(rootDir, { recursive: true });

      const children: Task[] = Array.from({ length: 10 }, (_, i) => ({
        id: `child-${i}`,
        goal: `Child ${i}`,
        acceptance: `Child ${i} acceptance`,
        status: "init" as const,
        tasks: [],
      }));

      const rootTask: Task = {
        id: "root-task",
        goal: "Root task",
        acceptance: "Root acceptance",
        status: "init",
        tasks: children,
      };

      await fs.writeFile(path.join(rootDir, "task.json"), JSON.stringify(rootTask, null, 2));

      // Act: 10개 task 동시 업데이트
      const updates = children.map((child) => ({
        taskId: child.id,
        rootTaskId: "root-task",
        status: "done",
      }));

      const response = await request(app).post("/api/tasks/batch-update").send({ updates });

      // Assert
      expect(response.status).toBe(200);
      const body = response.body as BatchUpdateResponse;
      expect(body.results).toHaveLength(10);
      expect(body.results.every((r) => r.success)).toBe(true);
    });
  });

  describe("additionalInstructions 저장", () => {
    it("should save additionalInstructions only", async () => {
      const dncDir = path.join(tempDir, ".dnc");
      const rootDir = path.join(dncDir, "root-task");
      await fs.mkdir(rootDir, { recursive: true });

      const rootTask: Task = {
        id: "root-task",
        goal: "Root task",
        acceptance: "Root acceptance",
        status: "init",
        tasks: [],
      };
      await fs.writeFile(path.join(rootDir, "task.json"), JSON.stringify(rootTask, null, 2));

      const response = await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "root-task",
              rootTaskId: "root-task",
              additionalInstructions: "추가 지침 내용",
            },
          ],
        });

      expect(response.status).toBe(200);
      const body = response.body as BatchUpdateResponse;
      expect(body.results[0].success).toBe(true);

      const updatedTask = JSON.parse(
        await fs.readFile(path.join(rootDir, "task.json"), "utf-8")
      ) as Task;
      expect(updatedTask.additionalInstructions).toBe("추가 지침 내용");
      expect(updatedTask.status).toBe("init");
    });

    it("should save status and additionalInstructions together", async () => {
      const dncDir = path.join(tempDir, ".dnc");
      const rootDir = path.join(dncDir, "root-task");
      await fs.mkdir(rootDir, { recursive: true });

      const rootTask: Task = {
        id: "root-task",
        goal: "Root task",
        acceptance: "Root acceptance",
        status: "init",
        tasks: [],
      };
      await fs.writeFile(path.join(rootDir, "task.json"), JSON.stringify(rootTask, null, 2));

      const response = await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "root-task",
              rootTaskId: "root-task",
              status: "in-progress",
              additionalInstructions: "동시 업데이트 지침",
            },
          ],
        });

      expect(response.status).toBe(200);
      const updatedTask = JSON.parse(
        await fs.readFile(path.join(rootDir, "task.json"), "utf-8")
      ) as Task;
      expect(updatedTask.status).toBe("in-progress");
      expect(updatedTask.additionalInstructions).toBe("동시 업데이트 지침");
    });

    it("should persist additionalInstructions after reload", async () => {
      const dncDir = path.join(tempDir, ".dnc");
      const rootDir = path.join(dncDir, "root-task");
      await fs.mkdir(rootDir, { recursive: true });

      const rootTask: Task = {
        id: "root-task",
        goal: "Root task",
        acceptance: "Root acceptance",
        status: "init",
        tasks: [],
      };
      await fs.writeFile(path.join(rootDir, "task.json"), JSON.stringify(rootTask, null, 2));

      await request(app)
        .post("/api/tasks/batch-update")
        .send({
          updates: [
            {
              taskId: "root-task",
              rootTaskId: "root-task",
              additionalInstructions: "저장 후 유지 확인",
            },
          ],
        });

      const repository = new FileSystemDncTaskRepository(dncDir);
      const reloadedTask = await repository.findRootTask("root-task");
      expect(reloadedTask.additionalInstructions).toBe("저장 후 유지 확인");
    });
  });
});
