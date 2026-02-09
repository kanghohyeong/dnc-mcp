import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Express } from "express";
import type { Server } from "http";
import { Socket } from "net";
import express from "express";
import { PortFinder } from "../../../src/services/port-finder.js";

describe("PortFinder", () => {
  let app: Express;
  let servers: Server[] = [];

  beforeEach(() => {
    app = express();
  });

  afterEach(async () => {
    // 모든 테스트 서버 정리
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          })
      )
    );
    servers = [];
  });

  describe("정상 케이스", () => {
    it("1. 첫 시도에 포트 사용 가능", async () => {
      const portFinder = new PortFinder(4000);
      const onConnection = vi.fn();

      const result = await portFinder.findAndStart(app, onConnection);

      servers.push(result.server);

      expect(result.server).toBeDefined();
      expect(result.port).toBe(4000);
      expect(result.server.listening).toBe(true);
    });

    it("2. server와 port 반환 확인", async () => {
      const portFinder = new PortFinder(4001);
      const onConnection = vi.fn();

      const result = await portFinder.findAndStart(app, onConnection);

      servers.push(result.server);

      expect(result).toHaveProperty("server");
      expect(result).toHaveProperty("port");
      expect(typeof result.port).toBe("number");
      expect(result.server).toBeInstanceOf(Object);
    });

    it("3. onConnection 콜백 호출 확인", async () => {
      const portFinder = new PortFinder(4002);
      const onConnection = vi.fn();

      const result = await portFinder.findAndStart(app, onConnection);

      servers.push(result.server);

      // 실제 연결 테스트 및 콜백 대기
      await new Promise<void>((resolve) => {
        const client = new Socket();

        // onConnection이 호출될 때까지 대기
        const checkInterval = setInterval(() => {
          if (onConnection.mock.calls.length > 0) {
            clearInterval(checkInterval);
            client.destroy();
            resolve();
          }
        }, 10);

        client.connect(result.port, "localhost");
      });

      // 콜백이 호출되었는지 확인
      expect(onConnection).toHaveBeenCalled();
      expect(onConnection.mock.calls[0][0]).toBeInstanceOf(Object); // Socket 객체
    });

    it("4. ConnectionManager와 통합 확인", async () => {
      const portFinder = new PortFinder(4003);
      const sockets: Socket[] = [];
      const onConnection = (socket: Socket) => {
        sockets.push(socket);
      };

      const result = await portFinder.findAndStart(app, onConnection);

      servers.push(result.server);

      // 연결 생성 및 소켓 추가 대기
      await new Promise<void>((resolve) => {
        const client = new Socket();

        // 소켓이 추가될 때까지 대기
        const checkInterval = setInterval(() => {
          if (sockets.length > 0) {
            clearInterval(checkInterval);
            client.destroy();
            resolve();
          }
        }, 10);

        client.connect(result.port, "localhost");
      });

      expect(sockets.length).toBeGreaterThan(0);
    });
  });

  describe("에러 케이스", () => {
    it("5. EADDRINUSE 발생 시 다음 포트 시도", async () => {
      const portFinder1 = new PortFinder(4100);
      const onConnection = vi.fn();

      // 첫 번째 서버로 포트 점유
      const result1 = await portFinder1.findAndStart(app, onConnection);
      servers.push(result1.server);
      expect(result1.port).toBe(4100);

      // 두 번째 PortFinder는 같은 시작 포트로 시작하지만 다음 포트를 찾아야 함
      const app2 = express();
      const portFinder2 = new PortFinder(4100);
      const result2 = await portFinder2.findAndStart(app2, onConnection);
      servers.push(result2.server);

      expect(result2.port).toBe(4101); // 다음 포트로 이동
    });

    it("6. maxAttempts까지 재시도", async () => {
      const startPort = 4200;
      const maxAttempts = 3;

      // 3개 포트를 미리 점유
      const blocker1 = await new PortFinder(startPort).findAndStart(express(), vi.fn());
      const blocker2 = await new PortFinder(startPort + 1).findAndStart(express(), vi.fn());
      const blocker3 = await new PortFinder(startPort + 2).findAndStart(express(), vi.fn());
      servers.push(blocker1.server, blocker2.server, blocker3.server);

      // 4번째 포트를 찾아야 하지만 maxAttempts=3이므로 실패해야 함
      const portFinder = new PortFinder(startPort, maxAttempts);

      await expect(portFinder.findAndStart(express(), vi.fn())).rejects.toThrow(
        `Could not find available port after ${maxAttempts} attempts`
      );
    });

    it("7. maxAttempts 초과 시 에러 throw", async () => {
      const startPort = 4300;
      const maxAttempts = 1;

      // 포트 점유
      const blocker = await new PortFinder(startPort).findAndStart(express(), vi.fn());
      servers.push(blocker.server);

      // maxAttempts=1이므로 첫 시도만 하고 실패
      const portFinder = new PortFinder(startPort, maxAttempts);

      await expect(portFinder.findAndStart(express(), vi.fn())).rejects.toThrow(
        `Could not find available port after ${maxAttempts} attempts`
      );
    });

    it("8. EADDRINUSE 외 에러는 즉시 throw", async () => {
      const portFinder = new PortFinder(4400);

      // listen을 모킹하여 다른 에러 발생시키기
      const mockApp = {
        listen: vi.fn((port: number, callback: (error?: NodeJS.ErrnoException) => void) => {
          const error = new Error("Some other error") as NodeJS.ErrnoException;
          error.code = "EACCES"; // EADDRINUSE가 아닌 다른 에러
          callback(error);
          return { on: vi.fn(), close: vi.fn() };
        }),
      } as unknown as Express;

      await expect(portFinder.findAndStart(mockApp, vi.fn())).rejects.toThrow("Some other error");
    });
  });

  describe("경계값 케이스", () => {
    it("9. maxAttempts = 1 처리", async () => {
      const portFinder = new PortFinder(4500, 1);
      const onConnection = vi.fn();

      const result = await portFinder.findAndStart(app, onConnection);

      servers.push(result.server);

      expect(result.port).toBe(4500);
      expect(result.server.listening).toBe(true);
    });

    it("10. 여러 번 재시도 후 성공", async () => {
      const startPort = 4600;

      // 처음 5개 포트 점유
      for (let i = 0; i < 5; i++) {
        const blocker = await new PortFinder(startPort + i).findAndStart(express(), vi.fn());
        servers.push(blocker.server);
      }

      // 6번째 시도에서 성공
      const portFinder = new PortFinder(startPort, 10);
      const result = await portFinder.findAndStart(express(), vi.fn());

      servers.push(result.server);

      expect(result.port).toBe(startPort + 5);
    });

    it("11. 커스텀 startPort 및 maxAttempts", async () => {
      const customStartPort = 5000;
      const customMaxAttempts = 50;

      const portFinder = new PortFinder(customStartPort, customMaxAttempts);
      const result = await portFinder.findAndStart(app, vi.fn());

      servers.push(result.server);

      expect(result.port).toBeGreaterThanOrEqual(customStartPort);
      expect(result.port).toBeLessThan(customStartPort + customMaxAttempts);
    });
  });
});
