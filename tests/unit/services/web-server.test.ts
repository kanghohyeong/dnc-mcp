import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HelloWorldWebServer } from '../../../src/services/web-server.js';

// browser-launcher 모킹
vi.mock('../../../src/utils/browser-launcher.js', () => ({
  openBrowser: vi.fn().mockResolvedValue(undefined),
}));

describe('HelloWorldWebServer', () => {
  let server: HelloWorldWebServer;

  beforeEach(() => {
    server = new HelloWorldWebServer();
  });

  afterEach(async () => {
    if (server.getIsRunning()) {
      await server.stop();
    }
  });

  describe('초기 상태', () => {
    it('should start with isRunning as false', () => {
      expect(server.getIsRunning()).toBe(false);
    });

    it('should have default port 3331', () => {
      expect(server.getPort()).toBe(3331);
    });
  });

  describe('start', () => {
    it('should start server successfully', async () => {
      await server.start();

      expect(server.getIsRunning()).toBe(true);
      expect(server.getPort()).toBeGreaterThanOrEqual(3331);
    });

    it('should not start if already running', async () => {
      await server.start();
      const firstPort = server.getPort();

      // 이미 실행 중인 상태에서 다시 start 호출
      await server.start();

      // 포트가 변경되지 않음
      expect(server.getPort()).toBe(firstPort);
      expect(server.getIsRunning()).toBe(true);
    });

    it('should open browser automatically', async () => {
      const { openBrowser } = await import(
        '../../../src/utils/browser-launcher.js'
      );

      await server.start();

      expect(openBrowser).toHaveBeenCalledWith(
        `http://localhost:${server.getPort()}`,
      );
    });

    it('should handle browser launch failure gracefully', async () => {
      const { openBrowser } = await import(
        '../../../src/utils/browser-launcher.js'
      );
      vi.mocked(openBrowser).mockRejectedValueOnce(
        new Error('Browser not found'),
      );

      // 브라우저 열기 실패해도 서버는 정상 시작되어야 함
      await expect(server.start()).resolves.not.toThrow();
      expect(server.getIsRunning()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop server gracefully', async () => {
      await server.start();
      expect(server.getIsRunning()).toBe(true);

      await server.stop();

      expect(server.getIsRunning()).toBe(false);
    });

    it('should do nothing if server is not running', async () => {
      // 시작하지 않은 상태에서 stop 호출
      await expect(server.stop()).resolves.not.toThrow();
      expect(server.getIsRunning()).toBe(false);
    });
  });

  describe('getPort', () => {
    it('should return current port', async () => {
      await server.start();
      const port = server.getPort();

      expect(port).toBeGreaterThanOrEqual(3331);
      expect(port).toBeLessThan(3331 + 10);
    });
  });

  describe('getIsRunning', () => {
    it('should return true when running', async () => {
      await server.start();
      expect(server.getIsRunning()).toBe(true);
    });

    it('should return false when stopped', async () => {
      await server.start();
      await server.stop();
      expect(server.getIsRunning()).toBe(false);
    });
  });
});
