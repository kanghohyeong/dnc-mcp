import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { HelloWorldWebServer } from "../../src/services/web-server.js";
import { HistoryService } from "../../src/services/history-service.js";

describe("History API Integration", () => {
  let webServer: HelloWorldWebServer;
  let historyService: HistoryService;
  let baseURL: string;

  beforeEach(async () => {
    // 히스토리 서비스 초기화
    historyService = HistoryService.getInstance();
    historyService.clearHistory();

    // 웹 서버 시작
    webServer = new HelloWorldWebServer();
    await webServer.start();
    baseURL = `http://localhost:${webServer.getPort()}`;
  });

  afterEach(async () => {
    await webServer.stop();
  });

  describe("GET /api/history", () => {
    it("히스토리가 없을 때 빈 배열을 반환해야 함", async () => {
      const response = await request(baseURL).get("/api/history");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("전체 히스토리를 JSON으로 반환해야 함", async () => {
      historyService.addHistory("get_kst_time", {}, { kst: "time1" });
      historyService.addHistory("other_tool", {}, { result: "other1" });

      const response = await request(baseURL).get("/api/history");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].toolName).toBe("get_kst_time");
      expect(response.body[1].toolName).toBe("other_tool");
    });

    it("toolName으로 필터링할 수 있어야 함", async () => {
      historyService.addHistory("get_kst_time", {}, { kst: "time1" });
      historyService.addHistory("other_tool", {}, { result: "other1" });
      historyService.addHistory("get_kst_time", {}, { kst: "time2" });

      const response = await request(baseURL).get("/api/history?toolName=get_kst_time");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(
        response.body.every((entry: { toolName: string }) => entry.toolName === "get_kst_time")
      ).toBe(true);
    });

    it("각 히스토리 엔트리는 필수 필드를 포함해야 함", async () => {
      historyService.addHistory("get_kst_time", { input: "test" }, { output: "result" });

      const response = await request(baseURL).get("/api/history");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      const entry = response.body[0];
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("toolName", "get_kst_time");
      expect(entry).toHaveProperty("timestamp");
      expect(entry).toHaveProperty("timestampKst");
      expect(entry).toHaveProperty("request", { input: "test" });
      expect(entry).toHaveProperty("response", { output: "result" });
    });
  });

  describe("GET /history", () => {
    it("EJS 템플릿이 렌더링된 HTML 페이지를 반환해야 함", async () => {
      const response = await request(baseURL).get("/history");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.text).toContain("get-kst-time 호출 히스토리");
      expect(response.text).toContain('<table id="history-table">');
    });

    it("히스토리가 없을 때 안내 메시지를 표시해야 함", async () => {
      const response = await request(baseURL).get("/history");

      expect(response.status).toBe(200);
      expect(response.text).toContain("아직 호출 히스토리가 없습니다");
    });

    it("히스토리 데이터를 테이블로 렌더링해야 함", async () => {
      historyService.addHistory("get_kst_time", {}, { kst: "2026. 02. 07. 12:00:00" });

      const response = await request(baseURL).get("/history");

      expect(response.status).toBe(200);
      expect(response.text).toContain("2026. 02. 07. 12:00:00");
      expect(response.text).toContain("kst");
    });

    it("EventSource 스크립트가 포함되어야 함", async () => {
      const response = await request(baseURL).get("/history");

      expect(response.status).toBe(200);
      expect(response.text).toContain("EventSource");
      expect(response.text).toContain("/api/history/stream");
    });
  });

  describe("GET /api/history/stream (SSE)", () => {
    it("SSE 스트림을 생성해야 함", (done) => {
      const agent = request(baseURL);
      const req = agent.get("/api/history/stream").buffer(false);

      req.on("response", (res) => {
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toBe("text/event-stream");
        expect(res.headers["cache-control"]).toBe("no-cache");
        expect(res.headers["connection"]).toBe("keep-alive");

        // 헤더 검증 후 연결 종료
        req.abort();
        done();
      });

      req.on("error", (err) => {
        // abort로 인한 에러는 무시
        if ((err as { code?: string }).code !== "ECONNRESET") {
          done(err);
        }
      });
    });

    it("새 히스토리 추가 시 SSE 이벤트를 발송해야 함", (done) => {
      const agent = request.agent(baseURL);

      agent
        .get("/api/history/stream")
        .buffer(false)
        .parse((res, callback) => {
          let buffer = "";

          res.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();

            if (buffer.includes("data:")) {
              try {
                const dataMatch = buffer.match(/data: (.+)\n\n/);
                if (dataMatch) {
                  const entry = JSON.parse(dataMatch[1]);

                  expect(entry.toolName).toBe("get_kst_time");
                  expect(entry.response).toEqual({ kst: "test_time" });

                  res.destroy();
                  done();
                }
              } catch {
                // JSON 파싱 실패 시 계속 대기
              }
            }
          });

          res.on("end", () => callback(null, buffer));
        })
        .end(() => {
          // 연결이 성립된 후 히스토리 추가
          setTimeout(() => {
            historyService.addHistory("get_kst_time", {}, { kst: "test_time" });
          }, 50);
        });
    });

    it("get_kst_time 도구의 히스토리만 전송해야 함", (done) => {
      const agent = request.agent(baseURL);
      let eventCount = 0;

      agent
        .get("/api/history/stream")
        .buffer(false)
        .parse((res, callback) => {
          let buffer = "";

          res.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();

            const dataMatches = buffer.match(/data: (.+)\n\n/g);
            if (dataMatches) {
              eventCount = dataMatches.length;
            }
          });

          res.on("end", () => callback(null, buffer));
        })
        .end(() => {
          setTimeout(() => {
            historyService.addHistory("get_kst_time", {}, { kst: "time1" });
            historyService.addHistory("other_tool", {}, { result: "other1" });
            historyService.addHistory("get_kst_time", {}, { kst: "time2" });

            setTimeout(() => {
              expect(eventCount).toBe(2);
              done();
            }, 100);
          }, 50);
        });
    });
  });
});
