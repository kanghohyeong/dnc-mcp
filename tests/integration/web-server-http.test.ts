import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { UIWebServer } from "../../src/services/web-server.js";
import express from "express";

describe("웹 서버 HTTP 엔드포인트", () => {
  let server: UIWebServer;
  let app: express.Express;

  beforeAll(async () => {
    server = new UIWebServer({ autoOpenBrowser: false });
    await server.start();

    // Express 앱 인스턴스 가져오기
    app = (server as never)["app"] as express.Express;
  });

  afterAll(async () => {
    await server.stop();
  });

  describe("GET /", () => {
    it('should return HTML with "Task Management"', async () => {
      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
      expect(response.text).toContain("Task Management");
      expect(response.text).toContain("<!DOCTYPE html>");
      expect(response.text).toContain("DnC (Divide and Conquer)");
    });

    it("should have correct HTML structure", async () => {
      const response = await request(app).get("/");

      expect(response.text).toMatch(/<html lang="ko">/);
      expect(response.text).toMatch(/<meta charset="UTF-8">/);
      expect(response.text).toMatch(/<h1[^>]*>Task Management<\/h1>/);
    });

    it("should include Jira style CSS", async () => {
      const response = await request(app).get("/");

      expect(response.text).toContain("jira-style.css");
      expect(response.text).toContain("fade-in");
    });
  });

  describe("GET /health", () => {
    it("should return health status as JSON", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.type).toBe("application/json");
      expect(response.body).toEqual({
        status: "ok",
        message: "MCP server is running",
      });
    });
  });

  describe("404 처리", () => {
    it("should return 404 for non-existent routes", async () => {
      const response = await request(app).get("/non-existent");

      expect(response.status).toBe(404);
    });
  });
});
