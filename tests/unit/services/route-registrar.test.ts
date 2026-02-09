import { describe, it, expect, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { RouteRegistrar } from "../../../src/services/route-registrar.js";

describe("RouteRegistrar", () => {
  let app: Express;
  let routeRegistrar: RouteRegistrar;

  beforeEach(() => {
    app = express();

    // EJS 설정
    app.set("view engine", "ejs");
    app.set("views", new URL("../../../views", import.meta.url).pathname);

    routeRegistrar = new RouteRegistrar();
  });

  describe("정상 케이스", () => {
    it("1. GET / 라우트 등록", async () => {
      routeRegistrar.registerRoutes(app);

      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Interlock MCP Server");
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
