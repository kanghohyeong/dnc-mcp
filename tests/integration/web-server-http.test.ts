import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { UIWebServer } from "../../src/services/web-server.js";
import { HistoryService } from "../../src/services/history-service.js";
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
    it('should return HTML with "hello world"', async () => {
      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
      expect(response.text).toContain("hello world");
      expect(response.text).toContain("<!DOCTYPE html>");
      expect(response.text).toContain("Interlock MCP Server");
    });

    it("should have correct HTML structure", async () => {
      const response = await request(app).get("/");

      expect(response.text).toMatch(/<html lang="ko">/);
      expect(response.text).toMatch(/<meta charset="UTF-8">/);
      expect(response.text).toMatch(/<h1>hello world<\/h1>/);
    });

    it("should include CSS animations", async () => {
      const response = await request(app).get("/");

      expect(response.text).toContain("animation: fadeIn");
      expect(response.text).toContain("@keyframes fadeIn");
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

  describe("SSE 연결 정리", () => {
    let testServer: UIWebServer;
    let testApp: express.Express;
    let historyService: HistoryService;

    beforeEach(async () => {
      testServer = new UIWebServer({ autoOpenBrowser: false });
      await testServer.start();
      testApp = (testServer as never)["app"] as express.Express;
      historyService = HistoryService.getInstance();
    });

    afterAll(async () => {
      if (testServer && testServer.getIsRunning()) {
        await testServer.stop();
      }
    });

    it("should clean up EventEmitter listeners when server stops", async () => {
      const initialListenerCount = historyService.listenerCount("historyAdded");

      // SSE 연결 시뮬레이션 (실제 HTTP 요청으로)
      const ssePromise = new Promise<void>((resolve, reject) => {
        void request(testApp)
          .get("/api/history/stream")
          .set("Accept", "text/event-stream")
          .timeout(1000)
          .end((err: Error & { code?: string }) => {
            // 타임아웃이나 연결 종료는 예상된 동작
            if (err?.message?.includes("timeout")) {
              resolve();
            } else if (err?.code === "ECONNRESET") {
              resolve();
            } else if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
      });

      // 연결이 확립될 시간을 줌
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 리스너가 추가되었는지 확인
      const listenerCountAfterConnect = historyService.listenerCount("historyAdded");
      expect(listenerCountAfterConnect).toBeGreaterThan(initialListenerCount);

      // 서버 종료
      await testServer.stop();

      // SSE 요청 완료 대기
      await ssePromise;

      // 리스너가 정리되었는지 확인
      const finalListenerCount = historyService.listenerCount("historyAdded");
      expect(finalListenerCount).toBeLessThanOrEqual(initialListenerCount);
    });

    it("should handle multiple SSE connections simultaneously", async () => {
      const initialListenerCount = historyService.listenerCount("historyAdded");

      // 여러 SSE 연결 생성
      const connections = [1, 2, 3].map(() => {
        return new Promise<void>((resolve) => {
          void request(testApp)
            .get("/api/history/stream")
            .set("Accept", "text/event-stream")
            .timeout(500)
            .end(() => {
              resolve();
            });
        });
      });

      // 연결이 확립될 시간을 줌
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 리스너가 3개 추가되었는지 확인
      const listenerCountAfterConnect = historyService.listenerCount("historyAdded");
      expect(listenerCountAfterConnect).toBeGreaterThanOrEqual(initialListenerCount + 3);

      // 서버 종료
      await testServer.stop();

      // 모든 연결 완료 대기
      await Promise.all(connections);

      // 모든 리스너가 정리되었는지 확인
      const finalListenerCount = historyService.listenerCount("historyAdded");
      expect(finalListenerCount).toBeLessThanOrEqual(initialListenerCount);
    }, 10000);

    it("should send shutdown event to SSE clients", async () => {
      let receivedShutdownEvent = false;
      let eventData = "";

      // SSE 연결 생성 및 이벤트 수신
      const ssePromise = new Promise<void>((resolve) => {
        const req = request(testApp)
          .get("/api/history/stream")
          .set("Accept", "text/event-stream")
          .timeout(1000)
          .buffer(false)
          .parse((res, callback) => {
            res.on("data", (chunk: Buffer) => {
              const text = String(chunk);
              if (text.includes("event: shutdown")) {
                receivedShutdownEvent = true;
              }
              if (text.includes("data:")) {
                eventData += text;
              }
            });
            void res.on("end", () => callback(null, ""));
          });

        void req.end(() => {
          resolve();
        });
      });

      // 연결이 확립될 시간을 줌
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 서버 종료 (shutdown 이벤트 발생)
      await testServer.stop();

      // SSE 요청 완료 대기
      await ssePromise;

      // shutdown 이벤트를 받았는지 확인
      expect(receivedShutdownEvent).toBe(true);
      expect(eventData).toContain("server_stopping");
    }, 10000);
  });
});
