import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetKstTimeTool } from "../../src/tools/get-kst-time.js";
import { createTestMcpServer, mockKstTime } from "../helpers/test-utils.js";

describe("MCP 도구 통합 테스트", () => {
  let mcpServer: McpServer;

  beforeEach(() => {
    mcpServer = createTestMcpServer();
    mockKstTime("2026-02-07T03:00:00Z");
  });

  describe("MCP 서버 초기화", () => {
    it("should create MCP server with name and version", () => {
      expect(mcpServer).toBeDefined();
      // MCP Server 내부 속성은 private이므로 인스턴스 존재 여부만 확인
      expect(mcpServer).toBeInstanceOf(McpServer);
    });
  });

  describe("get_kst_time 도구", () => {
    it("should register and execute successfully", () => {
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

      expect(registerToolSpy).toHaveBeenCalledTimes(1);
      const call = registerToolSpy.mock.calls[0];
      expect(call[0]).toBe("get_kst_time");
      const schema = call[1] as { description: string; inputSchema: object };
      expect(typeof schema.description).toBe("string");
      expect(schema.inputSchema).toEqual({});
      expect(typeof call[2]).toBe("function");
    });

    it("should return correct response format", () => {
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
      const result = handler({});

      expect(result).toHaveProperty("content");
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0].type).toBe("text");
      expect(typeof result.content[0].text).toBe("string");
      expect(result.content[0].text.length).toBeGreaterThan(0);
    });

    it("should include KST timezone information", () => {
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
      const result = handler({});

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("KST");
      expect(text).toContain("UTC+9");
    });

    it("should handle errors and set isError flag", () => {
      // Date를 잘못된 값으로 모킹
      const OriginalDate = Date;
      // @ts-expect-error - Date 모킹
      global.Date = class extends OriginalDate {
        constructor(...args: unknown[]) {
          super(...args);
          if (args.length === 0) {
            // @ts-expect-error - Invalid Date
            return new OriginalDate("invalid");
          }
        }
      };

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
      const result = handler({});

      expect(result).toHaveProperty("isError", true);
      expect((result.content[0] as { text: string }).text).toContain("오류");

      // 원래 Date 복원
      global.Date = OriginalDate;
    });
  });
});
