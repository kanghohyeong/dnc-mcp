#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGetKstTimeTool } from "./tools/get-kst-time.js";
import { registerDncInitJobTool } from "./tools/dnc-init-job.js";
import { registerDncAppendDividedJobTool } from "./tools/dnc-append-divided-job.js";
import { registerDncDeleteJobTool } from "./tools/dnc-delete-job.js";
import { registerDncUpdateJobTool } from "./tools/dnc-update-job.js";
import { registerDncGetJobRelationsTool } from "./tools/dnc-get-job-relations.js";
import { UIWebServer } from "./services/web-server.js";

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

// Initialize the web server
const webServer = new UIWebServer();

/**
 * Register all tools
 *
 * 새로운 도구를 추가하려면:
 * 1. src/tools/ 디렉토리에 도구 파일 생성 (예시: src/tools/example-tool.ts 참고)
 * 2. 여기에 import 및 등록 함수 호출 추가
 */
registerGetKstTimeTool(mcpServer);

// DnC (Divide and Conquer) job 관리 도구들
registerDncInitJobTool(mcpServer);
registerDncAppendDividedJobTool(mcpServer);
registerDncDeleteJobTool(mcpServer);
registerDncUpdateJobTool(mcpServer);
registerDncGetJobRelationsTool(mcpServer);

/**
 * Setup client connection handler
 *
 * 클라이언트가 MCP 서버에 연결되면 웹 서버를 시작하고 브라우저를 엽니다.
 */
mcpServer.server.oninitialized = () => {
  console.error("Client connected to MCP server");
  if (!webServer.getIsRunning()) {
    void (async () => {
      try {
        await webServer.start();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to start web server:", errorMessage);
      }
    })();
  }
};

/**
 * Setup client disconnection handler
 *
 * 클라이언트가 MCP 서버에서 연결 해제되면 웹 서버를 종료합니다.
 */
mcpServer.server.onclose = () => {
  void (async () => {
    console.error("Client disconnected from MCP server");
    if (webServer.getIsRunning()) {
      try {
        await webServer.stop();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to stop web server:", errorMessage);
      }
    }
  })();
};

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
