import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { RouteRegistrar } from "../../src/services/route-registrar.js";
import { ExpressAppConfigurator } from "../../src/services/express-app-configurator.js";
import { FileSystemDncTaskRepository } from "../../src/repositories/index.js";

describe("DnC Jobs Page Integration Tests", () => {
  let app: Express;

  beforeAll(async () => {
    app = express();

    // Express 앱 설정
    const configurator = new ExpressAppConfigurator();
    await configurator.configure(app);

    // 라우트 등록
    const repository = new FileSystemDncTaskRepository();
    const routeRegistrar = new RouteRegistrar(repository);
    routeRegistrar.registerRoutes(app);
  });

  describe("GET /", () => {
    it("should return 200 and render jobs list page", async () => {
      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
    });

    it("should include page title in response", async () => {
      const response = await request(app).get("/");

      expect(response.text).toContain("Task Management");
    });

    it("should render tab bar with In Progress and Done tabs", async () => {
      const response = await request(app).get("/");
      const html = response.text;

      expect(html).toContain("tab-bar");
      expect(html).toContain("In Progress");
      expect(html).toContain("Done");
    });

    it("should render two tab panels for active and done jobs", async () => {
      const response = await request(app).get("/");
      const html = response.text;

      expect(html).toContain("tab-panel-active");
      expect(html).toContain("tab-panel-done");
    });
  });
});
