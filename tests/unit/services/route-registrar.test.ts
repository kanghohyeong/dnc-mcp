import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import express, { type Express } from "express";
import request from "supertest";
import { RouteRegistrar } from "../../../src/services/route-registrar.js";
import { FileSystemDncTaskRepository } from "../../../src/repositories/index.js";

describe("RouteRegistrar", () => {
  const testRoot = path.join(process.cwd(), ".dnc-test-route-registrar");
  let app: Express;
  let routeRegistrar: RouteRegistrar;
  let repository: FileSystemDncTaskRepository;

  beforeEach(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    repository = new FileSystemDncTaskRepository(testRoot);

    app = express();

    // EJS 설정
    app.set("view engine", "ejs");
    app.set("views", new URL("../../../views", import.meta.url).pathname);

    routeRegistrar = new RouteRegistrar(repository);
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
  });

  describe("정상 케이스", () => {
    it("1. GET / 라우트 등록", async () => {
      routeRegistrar.registerRoutes(app);

      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Task Management");
    });

    it("2. GET /health 라우트 등록 및 JSON 응답", async () => {
      routeRegistrar.registerRoutes(app);

      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toEqual({
        status: "ok",
        message: "MCP server is running",
      });
    });
  });
});
