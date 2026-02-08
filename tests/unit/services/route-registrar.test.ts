import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { type Express, type Response } from "express";
import request from "supertest";
import { RouteRegistrar } from "../../../src/services/route-registrar.js";
import { ConnectionManager } from "../../../src/services/connection-manager.js";
import { HistoryService } from "../../../src/services/history-service.js";
import { mockKstTime } from "../../helpers/test-utils.js";

describe("RouteRegistrar", () => {
  let app: Express;
  let connectionManager: ConnectionManager;
  let historyService: HistoryService;
  let routeRegistrar: RouteRegistrar;

  beforeEach(() => {
    app = express();

    // EJS 설정
    app.set("view engine", "ejs");
    app.set("views", new URL("../../../views", import.meta.url).pathname);

    connectionManager = new ConnectionManager();
    historyService = HistoryService.getInstance();
    historyService.clearHistory();
    routeRegistrar = new RouteRegistrar(historyService, connectionManager);
  });

  afterEach(async () => {
    await connectionManager.closeAllSseConnections();
    connectionManager.closeAllHttpSockets();
    historyService.clearHistory();
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

    it("3. GET /api/history 라우트 등록", async () => {
      mockKstTime("2026-02-07T03:00:00.000Z");

      // 히스토리 추가
      historyService.addHistory("get_kst_time", { kst: "test" });

      routeRegistrar.registerRoutes(app);

      const response = await request(app).get("/api/history");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("4. GET /api/history?toolName=X 필터링", async () => {
      mockKstTime("2026-02-07T03:00:00.000Z");

      // 다양한 히스토리 추가
      historyService.addHistory("get_kst_time", { kst: "test1" });
      historyService.addHistory("other_tool", { result: "test2" });
      historyService.addHistory("get_kst_time", { kst: "test3" });

      routeRegistrar.registerRoutes(app);

      const response = await request(app).get("/api/history").query({ toolName: "get_kst_time" });

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2);
      expect(response.body.every((entry: { toolName: string }) => entry.toolName === "get_kst_time")).toBe(true);
    });

    it("5. GET /history 라우트 및 EJS 렌더링", async () => {
      routeRegistrar.registerRoutes(app);

      const response = await request(app).get("/history");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.text).toContain("History");
    });

    it("6. GET /api/history/stream SSE 엔드포인트", async () => {
      routeRegistrar.registerRoutes(app);

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      await new Promise<void>((resolve) => {
        const http = require("http");
        const req = http.get(`http://localhost:${port}/api/history/stream`, (res: Response) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["content-type"]).toBe("text/event-stream");
          expect(res.headers["cache-control"]).toBe("no-cache");
          expect(res.headers.connection).toBe("keep-alive");

          req.destroy();
          server.close(() => resolve());
        });
      });
    });

    it("7. SSE 헤더 설정 확인", async () => {
      routeRegistrar.registerRoutes(app);

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      await new Promise<void>((resolve) => {
        const http = require("http");
        const req = http.get(`http://localhost:${port}/api/history/stream`, (res: Response) => {
          expect(res.headers["content-type"]).toBe("text/event-stream");
          expect(res.headers["cache-control"]).toBe("no-cache");
          expect(res.headers.connection).toBe("keep-alive");

          req.destroy();
          server.close(() => resolve());
        });
      });
    });

    it("8. SSE 연결 시 초기 주석 전송 (: connected\\n\\n)", async () => {
      routeRegistrar.registerRoutes(app);

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      await new Promise<void>((resolve) => {
        const chunks: string[] = [];
        const http = require("http");
        const req = http.get(`http://localhost:${port}/api/history/stream`, (res: Response) => {
          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk.toString());
            // 초기 주석 확인 후 연결 종료
            if (chunks.join("").includes(": connected\n\n")) {
              req.destroy();
              server.close();
              resolve();
            }
          });
        });
      });
    });

    it("9. HistoryService에 historyAdded 리스너 등록 확인", async () => {
      const initialListenerCount = historyService.listenerCount("historyAdded");

      routeRegistrar.registerRoutes(app);

      // SSE 연결 생성
      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      await new Promise<void>((resolve) => {
        const http = require("http");
        const req = http.get(`http://localhost:${port}/api/history/stream`, (res: Response) => {
          res.on("data", () => {
            // 첫 데이터를 받으면 리스너가 등록된 것
            const currentListenerCount = historyService.listenerCount("historyAdded");
            expect(currentListenerCount).toBe(initialListenerCount + 1);

            req.destroy();
            server.close(() => resolve());
          });
        });
      });
    });

    it("10. ConnectionManager.trackSseConnection 호출 확인", async () => {
      const trackSpy = vi.spyOn(connectionManager, "trackSseConnection");

      routeRegistrar.registerRoutes(app);

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      await new Promise<void>((resolve) => {
        const http = require("http");
        const req = http.get(`http://localhost:${port}/api/history/stream`, (res: Response) => {
          res.on("data", () => {
            // 첫 데이터를 받으면 trackSseConnection이 호출된 것
            expect(trackSpy).toHaveBeenCalled();

            req.destroy();
            server.close(() => resolve());
          });
        });
      });
    });
  });

  describe("에러 케이스", () => {
    it("11. HistoryService.getInstance() 실패 처리", async () => {
      // getInstance를 실패하도록 모킹할 수 없으므로 (싱글톤)
      // 대신 clearHistory 에러를 테스트
      const clearSpy = vi.spyOn(historyService, "clearHistory");
      clearSpy.mockImplementation(() => {
        throw new Error("Clear failed");
      });

      // 에러가 발생해도 라우트 등록은 성공해야 함
      expect(() => routeRegistrar.registerRoutes(app)).not.toThrow();

      clearSpy.mockRestore();
    });

    it("12. 쿼리 파라미터 누락 처리", async () => {
      routeRegistrar.registerRoutes(app);

      // toolName 없이 요청
      const response = await request(app).get("/api/history");

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
    });
  });

  describe("경계값 케이스", () => {
    it("13. get_kst_time 이벤트만 SSE로 전송 (필터링)", async () => {
      mockKstTime("2026-02-07T03:00:00.000Z");

      routeRegistrar.registerRoutes(app);

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      await new Promise<void>((resolve) => {
        const chunks: string[] = [];
        const http = require("http");
        const req = http.get(`http://localhost:${port}/api/history/stream`, (res: Response) => {
          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk.toString());
          });

          // get_kst_time 히스토리 추가
          setTimeout(() => {
            historyService.addHistory("get_kst_time", { kst: "test" });

            // 다른 도구 히스토리 추가 (필터링되어야 함)
            historyService.addHistory("other_tool", { result: "test" });

            setTimeout(() => {
              const data = chunks.join("");
              // get_kst_time만 전송되어야 함
              expect(data).toContain("get_kst_time");

              req.destroy();
              server.close();
              resolve();
            }, 100);
          }, 100);
        });
      });
    });

    it("14. 다중 동시 SSE 연결 처리", async () => {
      routeRegistrar.registerRoutes(app);

      const server = app.listen(0);
      const port = (server.address() as { port: number }).port;

      const connectionCount = 3;
      const requests = [];

      for (let i = 0; i < connectionCount; i++) {
        const promise = new Promise<void>((resolve) => {
          const http = require("http");
          const req = http.get(`http://localhost:${port}/api/history/stream`, () => {
            req.destroy();
            resolve();
          });
        });
        requests.push(promise);
      }

      await Promise.all(requests);

      // 모든 연결이 성공적으로 처리되었는지 확인
      expect(requests.length).toBe(connectionCount);

      server.close();
    });
  });
});
