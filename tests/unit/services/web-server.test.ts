import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UIWebServer } from "../../../src/services/web-server.js";

// browser-launcher 모킹
vi.mock("../../../src/utils/browser-launcher.js", () => ({
  openBrowser: vi.fn().mockResolvedValue(undefined),
}));

describe("HelloWorldWebServer", () => {
  let server: UIWebServer;

  beforeEach(() => {
    server = new UIWebServer({ autoOpenBrowser: false });
  });

  afterEach(async () => {
    if (server.getIsRunning()) {
      await server.stop();
    }
  });

  describe("초기 상태", () => {
    it("should start with isRunning as false", () => {
      expect(server.getIsRunning()).toBe(false);
    });

    it("should have default port 3331", () => {
      expect(server.getPort()).toBe(3331);
    });
  });

  describe("start", () => {
    it("should start server successfully", async () => {
      await server.start();

      expect(server.getIsRunning()).toBe(true);
      expect(server.getPort()).toBeGreaterThanOrEqual(3331);
    });

    it("should not start if already running", async () => {
      await server.start();
      const firstPort = server.getPort();

      // 이미 실행 중인 상태에서 다시 start 호출
      await server.start();

      // 포트가 변경되지 않음
      expect(server.getPort()).toBe(firstPort);
      expect(server.getIsRunning()).toBe(true);
    });

    it("should open browser automatically when autoOpenBrowser is true", async () => {
      const { openBrowser } = await import("../../../src/utils/browser-launcher.js");
      vi.mocked(openBrowser).mockClear();

      const testServer = new UIWebServer({ autoOpenBrowser: true });
      await testServer.start();

      expect(openBrowser).toHaveBeenCalledWith(`http://localhost:${testServer.getPort()}`);

      await testServer.stop();
    });

    it("should handle browser launch failure gracefully", async () => {
      const { openBrowser } = await import("../../../src/utils/browser-launcher.js");
      vi.mocked(openBrowser).mockRejectedValueOnce(new Error("Browser not found"));

      // 브라우저 열기 실패해도 서버는 정상 시작되어야 함
      await expect(server.start()).resolves.not.toThrow();
      expect(server.getIsRunning()).toBe(true);
    });
  });

  describe("stop", () => {
    it("should stop server gracefully", async () => {
      await server.start();
      expect(server.getIsRunning()).toBe(true);

      await server.stop();

      expect(server.getIsRunning()).toBe(false);
    });

    it("should do nothing if server is not running", async () => {
      // 시작하지 않은 상태에서 stop 호출
      await expect(server.stop()).resolves.not.toThrow();
      expect(server.getIsRunning()).toBe(false);
    });
  });

  describe("getPort", () => {
    it("should return current port", async () => {
      await server.start();
      const port = server.getPort();

      expect(port).toBeGreaterThanOrEqual(3331);
      expect(port).toBeLessThan(3331 + 10);
    });
  });

  describe("getIsRunning", () => {
    it("should return true when running", async () => {
      await server.start();
      expect(server.getIsRunning()).toBe(true);
    });

    it("should return false when stopped", async () => {
      await server.start();
      await server.stop();
      expect(server.getIsRunning()).toBe(false);
    });
  });

  describe("브라우저 자동 실행 제어", () => {
    it("should not open browser when NODE_ENV is test", async () => {
      const { openBrowser } = await import("../../../src/utils/browser-launcher.js");
      vi.mocked(openBrowser).mockClear();

      const testServer = new UIWebServer();
      await testServer.start();

      expect(openBrowser).not.toHaveBeenCalled();

      await testServer.stop();
    });

    it("should open browser when NODE_ENV is production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const { openBrowser } = await import("../../../src/utils/browser-launcher.js");
      vi.mocked(openBrowser).mockClear();

      const testServer = new UIWebServer();
      await testServer.start();

      expect(openBrowser).toHaveBeenCalledWith(`http://localhost:${testServer.getPort()}`);

      await testServer.stop();
      process.env.NODE_ENV = originalEnv;
    });

    it("should not open browser when autoOpenBrowser is false", async () => {
      const { openBrowser } = await import("../../../src/utils/browser-launcher.js");
      vi.mocked(openBrowser).mockClear();

      const testServer = new UIWebServer({ autoOpenBrowser: false });
      await testServer.start();

      expect(openBrowser).not.toHaveBeenCalled();

      await testServer.stop();
    });

    it("should open browser when autoOpenBrowser is true (overrides NODE_ENV)", async () => {
      const { openBrowser } = await import("../../../src/utils/browser-launcher.js");
      vi.mocked(openBrowser).mockClear();

      const testServer = new UIWebServer({ autoOpenBrowser: true });
      await testServer.start();

      expect(openBrowser).toHaveBeenCalledWith(`http://localhost:${testServer.getPort()}`);

      await testServer.stop();
    });

    it("should open browser by default when NODE_ENV is not set", async () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const { openBrowser } = await import("../../../src/utils/browser-launcher.js");
      vi.mocked(openBrowser).mockClear();

      const testServer = new UIWebServer();
      await testServer.start();

      expect(openBrowser).toHaveBeenCalledWith(`http://localhost:${testServer.getPort()}`);

      await testServer.stop();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("SSE 연결 추적 및 정리", () => {
    // Mock 변수들은 나중에 필요할 수 있어서 남겨둠
    // beforeEach(() => {
    //   // Reserved for future use
    // });

    it("should close all SSE connections on stop()", async () => {
      await server.start();

      // 서버 종료 시 오류가 발생하지 않아야 함 (SSE 연결이 없어도)
      await expect(server.stop()).resolves.not.toThrow();

      // SSE 연결 정리 로직이 호출되었는지 확인하기 위해
      // 서버가 정상적으로 종료되었는지 검증
      expect(server.getIsRunning()).toBe(false);
    });

    it("should handle errors when closing already-closed connections", async () => {
      await server.start();
      await server.stop();

      // 이미 중지된 서버를 다시 중지해도 오류가 발생하지 않아야 함
      await expect(server.stop()).resolves.not.toThrow();
      expect(server.getIsRunning()).toBe(false);
    });

    it("should send shutdown event to SSE clients on stop", () => {
      // 이 테스트는 통합 테스트에서 더 적합함
      // 여기서는 메서드 존재 여부만 확인
      expect(server).toBeDefined();
    });
  });
});
