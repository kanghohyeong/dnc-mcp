import type { Express } from "express";
import type { Server } from "http";
import type { Socket } from "net";

/**
 * 사용 가능한 포트를 찾아 서버를 시작하는 클래스
 */
export class PortFinder {
  private startPort: number;
  private maxAttempts: number;

  constructor(startPort: number = 3331, maxAttempts: number = 100) {
    this.startPort = startPort;
    this.maxAttempts = maxAttempts;
  }

  /**
   * 사용 가능한 포트를 찾아 서버 시작
   */
  async findAndStart(
    app: Express,
    onConnection: (socket: Socket) => void
  ): Promise<{ server: Server; port: number }> {
    let currentPort = this.startPort;
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      try {
        const { server, port } = await this.tryListen(app, currentPort, onConnection);
        return { server, port };
      } catch (error) {
        const err = error as NodeJS.ErrnoException;

        // EADDRINUSE가 아닌 에러는 즉시 throw
        if (err.code !== "EADDRINUSE") {
          throw error;
        }

        // 다음 포트 시도
        currentPort++;
        attempts++;
      }
    }

    throw new Error(`Could not find available port after ${this.maxAttempts} attempts`);
  }

  /**
   * 특정 포트로 서버 시작 시도
   */
  private tryListen(
    app: Express,
    port: number,
    onConnection: (socket: Socket) => void
  ): Promise<{ server: Server; port: number }> {
    return new Promise((resolve, reject) => {
      const server = app.listen(port, (err?: Error) => {
        if (err) {
          return reject(err);
        }
        resolve({ server, port });
      });

      // HTTP 연결 추적
      server.on("connection", onConnection);
    });
  }
}
