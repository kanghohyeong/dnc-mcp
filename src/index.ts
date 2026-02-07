#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGetKstTimeTool } from "./tools/get-kst-time.js";

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
 * Register all tools
 *
 * 새로운 도구를 추가하려면:
 * 1. src/tools/ 디렉토리에 도구 파일 생성 (예시: src/tools/example-tool.ts 참고)
 * 2. 여기에 import 및 등록 함수 호출 추가
 */
registerGetKstTimeTool(mcpServer);

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
