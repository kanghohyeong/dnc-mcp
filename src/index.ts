#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP Server for interlock_mcp
 *
 * This is a basic template for an MCP server using the STDIO transport.
 * IMPORTANT: When using STDIO transport, always log to stderr using console.error(),
 * never use console.log() as it will interfere with the protocol communication.
 */

// Initialize the MCP server
const server = new Server(
  {
    name: "interlock_mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handler for listing available tools
 */
// eslint-disable-next-line @typescript-eslint/require-await
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Example tool definition (uncomment and modify as needed):
      // {
      //   name: "example_tool",
      //   description: "An example tool that does something useful",
      //   inputSchema: {
      //     type: "object",
      //     properties: {
      //       argument: {
      //         type: "string",
      //         description: "An example argument",
      //       },
      //     },
      //     required: ["argument"],
      //   },
      // },
    ],
  };
});

/**
 * Handler for tool execution
 */
// eslint-disable-next-line @typescript-eslint/require-await
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  try {
    switch (name) {
      // Example tool implementation (uncomment and modify as needed):
      // case "example_tool": {
      //   const { argument } = args as { argument: string };
      //   // Your tool logic here
      //   return {
      //     content: [
      //       {
      //         type: "text",
      //         text: `Tool executed with argument: ${argument}`,
      //       },
      //     ],
      //   };
      // }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing tool ${name}:`, errorMessage);
    throw error;
  }
});

/**
 * Start the server using STDIO transport
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("interlock_mcp MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
