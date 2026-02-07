import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerGetKstTimeTool } from "../../../src/tools/get-kst-time.js";
import { createTestMcpServer, mockKstTime } from "../../helpers/test-utils.js";
import { HistoryService, type HistoryEntry } from "../../../src/services/history-service.js";

describe("get-kst-time tool", () => {
  beforeEach(() => {
    // 고정된 시간으로 모킹: 2026-02-07T03:00:00Z (UTC) = 2026-02-07 12:00:00 (KST)
    mockKstTime("2026-02-07T03:00:00Z");
    // 히스토리 초기화
    HistoryService.getInstance().clearHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should register tool with correct name", () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool") as unknown as {
      mock: {
        calls: Array<
          [
            string,
            object,
            (args: object) => { content: Array<{ type: string; text: string }>; isError?: boolean },
          ]
        >;
      };
    };

    registerGetKstTimeTool(mcpServer);

    expect(registerToolSpy).toHaveBeenCalledTimes(1);
    const call = registerToolSpy.mock.calls[0];
    expect(call[0]).toBe("get_kst_time");
    const schema = call[1] as { description: string; inputSchema: object };
    expect(schema.description).toContain("한국 표준시");
    expect(schema.inputSchema).toEqual({});
    expect(typeof call[2]).toBe("function");
  });

  it("should return KST time in correct format", () => {
    const mcpServer = createTestMcpServer();

    // 등록된 핸들러 가져오기
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool") as unknown as {
      mock: {
        calls: Array<
          [
            string,
            object,
            (args: object) => { content: Array<{ type: string; text: string }>; isError?: boolean },
          ]
        >;
      };
    };
    registerGetKstTimeTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2];

    const result = handler({});

    expect(result).toHaveProperty("content");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("한국 표준시");
  });

  it("should include all required time formats", () => {
    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool") as unknown as {
      mock: {
        calls: Array<
          [
            string,
            object,
            (args: object) => { content: Array<{ type: string; text: string }>; isError?: boolean },
          ]
        >;
      };
    };
    registerGetKstTimeTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2];

    const result = handler({});
    const text = result.content[0].text;

    // KST 시간 포함
    expect(text).toMatch(/현재 한국 표준시/);

    // ISO 형식 포함
    expect(text).toMatch(/ISO 8601 형식:/);
    expect(text).toMatch(/2026-02-07/);

    // Unix timestamp 포함
    expect(text).toMatch(/Unix Timestamp:/);
    expect(text).toMatch(/1770433200000/);

    // UTC 시간 포함
    expect(text).toMatch(/UTC Time:/);
    expect(text).toMatch(/2026-02-07T03:00:00\.000Z/);
  });

  it("should handle Date object errors gracefully", () => {
    // Date 생성자를 모킹하여 Invalid Date 반환
    const OriginalDate = Date;
    // @ts-expect-error - Date 모킹
    global.Date = class extends OriginalDate {
      constructor(...args: unknown[]) {
        super(...args);
        if (args.length === 0) {
          // @ts-expect-error - Invalid Date 생성
          return new OriginalDate("invalid");
        }
      }
    };

    const mcpServer = createTestMcpServer();
    const registerToolSpy = vi.spyOn(mcpServer, "registerTool") as unknown as {
      mock: {
        calls: Array<
          [
            string,
            object,
            (args: object) => { content: Array<{ type: string; text: string }>; isError?: boolean },
          ]
        >;
      };
    };
    registerGetKstTimeTool(mcpServer);
    const handler = registerToolSpy.mock.calls[0][2];

    const result = handler({});

    expect(result).toHaveProperty("isError", true);
    expect((result.content[0] as { text: string }).text).toMatch(/오류가 발생했습니다/);

    // 원래 Date 복원
    global.Date = OriginalDate;
  });

  describe("History Service Integration", () => {
    it("should record tool call to history service", () => {
      const mcpServer = createTestMcpServer();
      const registerToolSpy = vi.spyOn(mcpServer, "registerTool") as unknown as {
        mock: {
          calls: Array<
            [
              string,
              object,
              (args: object) => {
                content: Array<{ type: string; text: string }>;
                isError?: boolean;
              },
            ]
          >;
        };
      };
      registerGetKstTimeTool(mcpServer);
      const handler = registerToolSpy.mock.calls[0][2];

      const historyService = HistoryService.getInstance();
      const eventSpy = vi.fn<[HistoryEntry]>();
      historyService.on("historyAdded", eventSpy);

      const result = handler({});

      // 히스토리 이벤트가 발생했는지 확인
      expect(eventSpy).toHaveBeenCalledTimes(1);
      const historyEntry = eventSpy.mock.calls[0][0];

      expect(historyEntry.toolName).toBe("get_kst_time");
      expect(historyEntry.request).toEqual({});
      expect(historyEntry.response).toEqual(result);
    });

    it("should add history entry with correct metadata", () => {
      const mcpServer = createTestMcpServer();
      const registerToolSpy = vi.spyOn(mcpServer, "registerTool") as unknown as {
        mock: {
          calls: Array<
            [
              string,
              object,
              (args: object) => {
                content: Array<{ type: string; text: string }>;
                isError?: boolean;
              },
            ]
          >;
        };
      };
      registerGetKstTimeTool(mcpServer);
      const handler = registerToolSpy.mock.calls[0][2];

      handler({});

      const historyService = HistoryService.getInstance();
      const history = historyService.getHistory("get_kst_time");

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        toolName: "get_kst_time",
        request: {},
      });
      expect(history[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(typeof history[0].timestamp).toBe("number");
      expect(typeof history[0].timestampKst).toBe("string");
    });
  });
});
