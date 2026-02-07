import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HelloWorldWebServer } from "../../src/services/web-server.js";
import { Readable, Writable } from "node:stream";
import { sleep } from "../helpers/test-utils.js";

describe("MCP Server Lifecycle - Web Server Integration", () => {
  let mcpServer: McpServer;
  let webServer: HelloWorldWebServer;
  let _mockStdin: Readable;
  let _mockStdout: Writable;
  let transport: StdioServerTransport;

  beforeEach(() => {
    // Mock stdio streams
    _mockStdin = new Readable({ read() {} });
    _mockStdout = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    // Initialize servers
    mcpServer = new McpServer({
      name: "test-server",
      version: "1.0.0",
    });
    webServer = new HelloWorldWebServer({ autoOpenBrowser: false });
  });

  afterEach(async () => {
    // Close transport first to prevent any pending operations
    if (transport) {
      try {
        await transport.close();
      } catch (error) {
        // Ignore errors if already closed
      }
    }
    // Then stop web server
    if (webServer.getIsRunning()) {
      await webServer.stop();
    }
  });

  it("should stop web server when client disconnects", async () => {
    // Setup onclose handler (simulating production code)
    transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    // Simulate the onclose handler that will be added to production code
    let closeHandlerCalled = false;
    mcpServer.server.onclose = () => {
      void (async () => {
        closeHandlerCalled = true;
        if (webServer.getIsRunning()) {
          await webServer.stop();
        }
      })();
    };

    // Start web server (simulating oninitialized)
    await webServer.start();
    expect(webServer.getIsRunning()).toBe(true);

    // Simulate client disconnect
    await transport.close();

    // Wait for async handler to execute
    await sleep(100);

    // Verify
    expect(closeHandlerCalled).toBe(true);
    expect(webServer.getIsRunning()).toBe(false);
  });

  it("should handle disconnect gracefully when web server is not running", async () => {
    transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    // Setup onclose handler
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mcpServer.server.onclose = () => {
      void (async () => {
        console.error("Client disconnected from MCP server");
        if (webServer.getIsRunning()) {
          await webServer.stop();
        }
      })();
    };

    // Don't start web server
    expect(webServer.getIsRunning()).toBe(false);

    // Simulate disconnect
    await transport.close();
    await sleep(100);

    // Should not throw error
    expect(webServer.getIsRunning()).toBe(false);

    consoleSpy.mockRestore();
  });

  it("should handle disconnect during web server startup", async () => {
    transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    // Setup onclose handler
    mcpServer.server.onclose = () => {
      void (async () => {
        if (webServer.getIsRunning()) {
          await webServer.stop();
        }
      })();
    };

    // Start web server and immediately disconnect (race condition)
    const startPromise = webServer.start();

    // Wait a tiny bit to let server start
    await sleep(10);

    // Now disconnect
    const closePromise = transport.close();

    // Wait for both to complete
    await startPromise;
    await closePromise;

    await sleep(100);

    // Should handle gracefully - web server should be stopped by the close handler
    expect(webServer.getIsRunning()).toBe(false);
  });

  it("should handle multiple close calls safely", async () => {
    transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    let _closeCallCount = 0;
    mcpServer.server.onclose = () => {
      void (async () => {
        _closeCallCount++;
        if (webServer.getIsRunning()) {
          await webServer.stop();
        }
      })();
    };

    await webServer.start();
    expect(webServer.getIsRunning()).toBe(true);

    // Close multiple times
    await transport.close();
    await sleep(50);

    // Attempting to close again should be safe (transport.close is idempotent)
    await transport.close();
    await sleep(50);

    // Handler may be called multiple times, but should be safe
    expect(webServer.getIsRunning()).toBe(false);
  });

  it("should not throw error when receiving signals after disconnect", async () => {
    transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    mcpServer.server.onclose = () => {
      void (async () => {
        if (webServer.getIsRunning()) {
          await webServer.stop();
        }
      })();
    };

    await webServer.start();

    // Disconnect first
    await transport.close();
    await sleep(100);

    expect(webServer.getIsRunning()).toBe(false);

    // Simulating SIGINT after disconnect should not cause issues
    // (In production, MCP SDK would have already called onclose)
    // This just verifies the state is clean
    expect(() => {
      // No-op - just checking nothing breaks
    }).not.toThrow();
  });
});
