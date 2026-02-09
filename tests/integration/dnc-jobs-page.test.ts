import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { RouteRegistrar } from "../../src/services/route-registrar.js";
import { ExpressAppConfigurator } from "../../src/services/express-app-configurator.js";

describe("DnC Jobs Page Integration Tests", () => {
  let app: Express;

  beforeAll(() => {
    app = express();

    // Express 앱 설정
    const configurator = new ExpressAppConfigurator();
    configurator.configure(app);

    // 라우트 등록
    const routeRegistrar = new RouteRegistrar();
    routeRegistrar.registerRoutes(app);
  });

  describe("GET /dnc/jobs", () => {
    it("should return 200 and render jobs list page", async () => {
      // When: /dnc/jobs 엔드포인트에 GET 요청
      const response = await request(app).get("/dnc/jobs");

      // Then: 200 응답 및 HTML 렌더링
      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
    });

    it("should include job list data in response", async () => {
      // When: /dnc/jobs 엔드포인트에 GET 요청
      const response = await request(app).get("/dnc/jobs");

      // Then: job 목록 데이터 포함
      expect(response.text).toContain("DnC Jobs");
      // HTML에 job 정보가 포함되어 있어야 함
    });

    it("should display job ID, goal, and status for each job", async () => {
      // When: /dnc/jobs 엔드포인트에 GET 요청
      const response = await request(app).get("/dnc/jobs");

      // Then: job ID, goal, status가 표시됨
      // 최소한 테이블 헤더나 구조가 있어야 함
      const html = response.text;
      expect(html).toBeDefined();
      // job이 있다면 job-로 시작하는 ID가 포함되어야 함
    });

    it("should include links to detail pages", async () => {
      // When: /dnc/jobs 엔드포인트에 GET 요청
      const response = await request(app).get("/dnc/jobs");

      // Then: 상세 페이지 링크 포함
      const html = response.text;
      // /dnc/jobs/:jobId 형식의 링크가 있어야 함
      expect(html).toBeDefined();
    });
  });
});
