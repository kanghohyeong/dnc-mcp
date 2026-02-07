#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// @ts-expect-error - z is used in commented example code below
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as z from "zod";

/**
 * MCP Server for interlock_mcp
 *
 * This is a basic template for an MCP server using the STDIO transport.
 * IMPORTANT: When using STDIO transport, always log to stderr using console.error(),
 * never use console.log() as it will interfere with the protocol communication.
 */

// Initialize the MCP server
const mcpServer = new McpServer({
  name: "interlock_mcp",
  version: "1.0.0",
});

/**
 * Register tools using the high-level McpServer API
 *
 * Example tool registration (uncomment and modify as needed):
 *
 * mcpServer.registerTool(
 *   "example_tool",
 *   {
 *     description: "An example tool that does something useful",
 *     inputSchema: {
 *       argument: z.string().describe("An example argument"),
 *     },
 *   },
 *   async (args) => {
 *     // Your tool logic here
 *     // Args are automatically validated and type-safe
 *     return {
 *       content: [
 *         {
 *           type: "text",
 *           text: `Tool executed with argument: ${args.argument}`,
 *         },
 *       ],
 *     };
 *   }
 * );
 */

/**
 * KST 시간 조회 도구
 *
 * 현재 시간을 한국 표준시(KST, UTC+9)로 반환합니다.
 * 디버깅 및 MCP 서버 동작 확인 용도로 사용됩니다.
 */
mcpServer.registerTool(
  "get_kst_time",
  {
    description: "현재 시간을 한국 표준시(KST, UTC+9)로 반환하는 디버깅 도구입니다.",
    inputSchema: {}, // 파라미터 없음
  },
  () => {
    try {
      // 현재 시간 가져오기
      const now = new Date();

      // Date 객체 유효성 검증
      if (isNaN(now.getTime())) {
        throw new Error("시스템 시계에서 유효한 시간을 가져올 수 없습니다.");
      }

      // 사람이 읽기 쉬운 KST 형식
      const kstTimeString = now.toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // ISO 8601 형식 (프로그래밍 용도)
      const kstISOString = now.toLocaleString("sv-SE", {
        timeZone: "Asia/Seoul",
      });

      return {
        content: [
          {
            type: "text",
            text: `현재 한국 표준시 (KST, UTC+9):
${kstTimeString}

ISO 8601 형식: ${kstISOString}
Unix Timestamp: ${now.getTime()}
UTC Time: ${now.toISOString()}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: `KST 시간을 가져오는 중 오류가 발생했습니다: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Start the server using STDIO transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("interlock_mcp MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
