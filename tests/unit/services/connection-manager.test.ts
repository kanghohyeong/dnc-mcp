import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Response } from "express";
import type { Socket } from "net";
import { EventEmitter } from "events";
import { ConnectionManager } from "../../../src/services/connection-manager.js";

describe("ConnectionManager", () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    vi.clearAllTimers();
  });

  afterEach(async () => {
    await connectionManager.closeAllSseConnections();
    connectionManager.closeAllHttpSockets();
    vi.restoreAllMocks();
  });

  describe("정상 케이스", () => {
    it("1. HTTP 소켓 추적 확인", () => {
      const socket = new EventEmitter() as Socket;
      socket.destroy = vi.fn();

      connectionManager.trackHttpSocket(socket);

      expect(connectionManager.getHttpConnectionCount()).toBe(1);
    });

    it("2. HTTP 소켓 close 이벤트로 제거 확인", () => {
      const socket = new EventEmitter() as Socket;
      socket.destroy = vi.fn();

      connectionManager.trackHttpSocket(socket);
      expect(connectionManager.getHttpConnectionCount()).toBe(1);

      socket.emit("close");

      expect(connectionManager.getHttpConnectionCount()).toBe(0);
    });

    it("3. 모든 HTTP 소켓 강제 종료 확인", () => {
      const socket1 = new EventEmitter() as Socket;
      const socket2 = new EventEmitter() as Socket;
      socket1.destroy = vi.fn();
      socket2.destroy = vi.fn();

      connectionManager.trackHttpSocket(socket1);
      connectionManager.trackHttpSocket(socket2);

      expect(connectionManager.getHttpConnectionCount()).toBe(2);

      connectionManager.closeAllHttpSockets();

      expect(socket1.destroy).toHaveBeenCalledTimes(1);
      expect(socket2.destroy).toHaveBeenCalledTimes(1);
      expect(connectionManager.getHttpConnectionCount()).toBe(0);
    });

    it("4. SSE 연결 및 리스너 추적 확인", () => {
      const response = new EventEmitter() as Response;
      response.end = vi.fn();
      response.write = vi.fn();

      const listener = vi.fn();
      connectionManager.trackSseConnection(response, listener);

      expect(connectionManager.getSseConnectionCount()).toBe(1);
    });

    it("5. Response end 시 SSE 연결 제거 확인", () => {
      const response = new EventEmitter() as Response;
      response.end = vi.fn();
      response.write = vi.fn();

      const listener = vi.fn();
      connectionManager.trackSseConnection(response, listener);
      expect(connectionManager.getSseConnectionCount()).toBe(1);

      response.emit("close");

      expect(connectionManager.getSseConnectionCount()).toBe(0);
    });

    it("6. SSE 클라이언트에게 shutdown 이벤트 전송 확인", async () => {
      const response = new EventEmitter() as Response;
      response.end = vi.fn((cb?: () => void) => {
        if (cb) {
          setImmediate(cb);
        }
      });
      response.write = vi.fn().mockReturnValue(true);

      const listener = vi.fn();
      connectionManager.trackSseConnection(response, listener);

      await connectionManager.closeAllSseConnections();

      expect(response.write).toHaveBeenCalledWith(
        'event: shutdown\ndata: {"reason":"server_stopping"}\n\n'
      );
      expect(response.end).toHaveBeenCalledTimes(1);
    });

    it("7. 연결 수 조회 메서드 정확성 확인", () => {
      const httpSocket1 = new EventEmitter() as Socket;
      const httpSocket2 = new EventEmitter() as Socket;
      httpSocket1.destroy = vi.fn();
      httpSocket2.destroy = vi.fn();

      const sseResponse1 = new EventEmitter() as Response;
      const sseResponse2 = new EventEmitter() as Response;
      const sseResponse3 = new EventEmitter() as Response;
      sseResponse1.end = vi.fn();
      sseResponse2.end = vi.fn();
      sseResponse3.end = vi.fn();
      sseResponse1.write = vi.fn();
      sseResponse2.write = vi.fn();
      sseResponse3.write = vi.fn();

      expect(connectionManager.getHttpConnectionCount()).toBe(0);
      expect(connectionManager.getSseConnectionCount()).toBe(0);

      connectionManager.trackHttpSocket(httpSocket1);
      connectionManager.trackHttpSocket(httpSocket2);

      expect(connectionManager.getHttpConnectionCount()).toBe(2);
      expect(connectionManager.getSseConnectionCount()).toBe(0);

      connectionManager.trackSseConnection(sseResponse1, vi.fn());
      connectionManager.trackSseConnection(sseResponse2, vi.fn());
      connectionManager.trackSseConnection(sseResponse3, vi.fn());

      expect(connectionManager.getHttpConnectionCount()).toBe(2);
      expect(connectionManager.getSseConnectionCount()).toBe(3);
    });
  });

  describe("에러 케이스", () => {
    it("9. response.end() 에러 graceful 처리 (이미 닫힌 경우)", async () => {
      const response = new EventEmitter() as Response;
      response.end = vi.fn().mockImplementation(() => {
        throw new Error("Response already closed");
      });
      response.write = vi.fn().mockReturnValue(true);

      const listener = vi.fn();
      connectionManager.trackSseConnection(response, listener);

      await expect(connectionManager.closeAllSseConnections()).resolves.toBeUndefined();
    });

    it("10. response.write() 에러 처리 (shutdown 메시지 전송 실패)", async () => {
      const response = new EventEmitter() as Response;
      response.end = vi.fn((cb?: () => void) => {
        if (cb) {
          setImmediate(cb);
        }
      });
      response.write = vi.fn().mockImplementation(() => {
        throw new Error("Write failed");
      });

      const listener = vi.fn();
      connectionManager.trackSseConnection(response, listener);

      await expect(connectionManager.closeAllSseConnections()).resolves.toBeUndefined();
      expect(response.end).toHaveBeenCalledTimes(1);
    });

    it("11. SSE 연결 종료 시 2초 타임아웃 적용", async () => {
      const response = new EventEmitter() as Response;
      // end 콜백을 호출하지 않아서 타임아웃이 발생하도록
      response.end = vi.fn();
      response.write = vi.fn().mockReturnValue(true);

      const listener = vi.fn();
      connectionManager.trackSseConnection(response, listener);

      const startTime = Date.now();
      await connectionManager.closeAllSseConnections();
      const elapsed = Date.now() - startTime;

      // 타임아웃이 발생했는지 확인 (2초 이상 대기)
      expect(elapsed).toBeGreaterThanOrEqual(1900); // 약간의 여유
      expect(response.end).toHaveBeenCalledTimes(1);
    }, 3000);

    it("12. 전체 SSE 연결 종료 5초 타임아웃 적용", async () => {
      const response1 = new EventEmitter() as Response;
      const response2 = new EventEmitter() as Response;
      // end 콜백을 호출하지 않아서 타임아웃이 발생하도록
      response1.end = vi.fn();
      response2.end = vi.fn();
      response1.write = vi.fn().mockReturnValue(true);
      response2.write = vi.fn().mockReturnValue(true);

      connectionManager.trackSseConnection(response1, vi.fn());
      connectionManager.trackSseConnection(response2, vi.fn());

      const startTime = Date.now();
      await connectionManager.closeAllSseConnections();
      const elapsed = Date.now() - startTime;

      // 개별 연결의 2초 타임아웃이 먼저 작동하므로 약 2초 소요
      // (전체 5초 타임아웃은 개별 타임아웃보다 느리므로 작동하지 않음)
      expect(elapsed).toBeGreaterThanOrEqual(1900); // 약간의 여유
      expect(elapsed).toBeLessThan(3000); // 3초 미만
    }, 4000);
  });

  describe("경계값 케이스", () => {
    it("13. 빈 연결 Set 처리 (no-op)", async () => {
      expect(connectionManager.getHttpConnectionCount()).toBe(0);
      expect(connectionManager.getSseConnectionCount()).toBe(0);

      connectionManager.closeAllHttpSockets();
      await connectionManager.closeAllSseConnections();

      expect(connectionManager.getHttpConnectionCount()).toBe(0);
      expect(connectionManager.getSseConnectionCount()).toBe(0);
    });

    it("14. 다중 SSE 연결 동시 처리", async () => {
      const responses: Response[] = [];
      for (let i = 0; i < 10; i++) {
        const response = new EventEmitter() as Response;
        response.end = vi.fn((cb?: () => void) => {
          if (cb) {
            setImmediate(cb);
          }
        });
        response.write = vi.fn().mockReturnValue(true);
        responses.push(response);
        connectionManager.trackSseConnection(response, vi.fn());
      }

      expect(connectionManager.getSseConnectionCount()).toBe(10);

      await connectionManager.closeAllSseConnections();

      responses.forEach((response) => {
        expect(response.write).toHaveBeenCalled();
        expect(response.end).toHaveBeenCalled();
      });

      expect(connectionManager.getSseConnectionCount()).toBe(0);
    });

    it("15. 이미 닫힌 연결 재종료 시도 (idempotent)", async () => {
      const response = new EventEmitter() as Response;
      response.end = vi.fn((cb?: () => void) => {
        if (cb) {
          setImmediate(cb);
        }
      });
      response.write = vi.fn().mockReturnValue(true);

      const listener = vi.fn();
      connectionManager.trackSseConnection(response, listener);

      await connectionManager.closeAllSseConnections();

      expect(connectionManager.getSseConnectionCount()).toBe(0);

      // 두 번째 호출은 즉시 반환되어야 함
      await connectionManager.closeAllSseConnections();

      expect(connectionManager.getSseConnectionCount()).toBe(0);
    });
  });
});
