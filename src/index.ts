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
