import type { Response } from "express";
import type { Socket } from "net";
import { HistoryService } from "./history-service.js";

/**
 * SSE 연결 및 HTTP 소켓을 추적하고 정리하는 클래스
 */
export class ConnectionManager {
  private sseConnections: Set<{ response: Response; listener: (entry: unknown) => void }>;
  private httpSockets: Set<Socket>;

  constructor() {
    this.sseConnections = new Set();
    this.httpSockets = new Set();
  }

  /**
   * HTTP 소켓 추적
   */
  trackHttpSocket(socket: Socket): void {
    this.httpSockets.add(socket);

    socket.once("close", () => {
      this.httpSockets.delete(socket);
    });
  }

  /**
   * 모든 HTTP 소켓 강제 종료
   */
  closeAllHttpSockets(): void {
    this.httpSockets.forEach((socket) => {
      socket.destroy();
    });
    this.httpSockets.clear();
  }

  /**
   * SSE 연결 추적
   */
  trackSseConnection(response: Response, listener: (entry: unknown) => void): void {
    const connection = { response, listener };
    this.sseConnections.add(connection);

    // historyAdded 이벤트 리스너 등록
    const historyService = HistoryService.getInstance();
    historyService.on("historyAdded", listener);

    response.once("close", () => {
      this.sseConnections.delete(connection);
      historyService.off("historyAdded", listener);
    });
  }

  /**
   * SSE 연결 리스너 생성
   */
  createSseListener(): (entry: unknown) => void {
    return (entry: unknown) => {
      // 리스너 로직은 RouteRegistrar에서 구현
    };
  }

  /**
   * 모든 SSE 연결 graceful 정리
   */
  async closeAllSseConnections(): Promise<void> {
    if (this.sseConnections.size === 0) {
      return;
    }

    const closePromises: Promise<void>[] = [];

    this.sseConnections.forEach(({ response, listener }) => {
      const closePromise = new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 2000);

        try {
          response.write("event: shutdown\ndata: Server is shutting down\n\n");
        } catch (error) {
          // Write 실패는 graceful하게 처리
        }

        try {
          response.end(() => {
            clearTimeout(timeout);
            resolve();
          });
        } catch (error) {
          // End 실패는 graceful하게 처리
          clearTimeout(timeout);
          resolve();
        }
      });

      closePromises.push(closePromise);

      const historyService = HistoryService.getInstance();
      historyService.off("historyAdded", listener);
    });

    this.sseConnections.clear();

    const globalTimeout = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 5000);
    });

    await Promise.race([Promise.all(closePromises), globalTimeout]);
  }

  /**
   * HTTP 연결 수 조회
   */
  getHttpConnectionCount(): number {
    return this.httpSockets.size;
  }

  /**
   * SSE 연결 수 조회
   */
  getSseConnectionCount(): number {
    return this.sseConnections.size;
  }
}
