import express, { Express, Request, Response } from "express";
import { Server } from "http";
import { Socket } from "net";
import path from "path";
import { fileURLToPath } from "url";
import { openBrowser } from "../utils/browser-launcher.js";
import { HistoryService, type HistoryEntry } from "./history-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SSE 연결과 연관된 EventEmitter 리스너를 묶어서 관리
 */
interface SseConnection {
  response: Response;
  listener: (entry: HistoryEntry) => void;
}

/**
 * HelloWorldWebServer 생성자 옵션
 */
export interface HelloWorldWebServerOptions {
  autoOpenBrowser?: boolean;
}

/**
 * "Hello World" 웹 서버 클래스
 *
 * MCP 클라이언트 연결 시 자동으로 시작되어 localhost에서
 * 간단한 웹 페이지를 제공합니다.
 */
export class HelloWorldWebServer {
  private app: Express;
  private server: Server | null = null;
  private port: number = 3331;
  private readonly startPort: number = 3331;
  private readonly maxPortAttempts: number = 100;
  private isRunning: boolean = false;
  // SSE 연결 추적을 위한 Set (O(1) 추가/삭제)
  private sseConnections: Set<SseConnection> = new Set();
  // HTTP 소켓 연결 추적 (정상 종료를 위한 강제 close용)
  private httpConnections: Set<Socket> = new Set();
  private autoOpenBrowser: boolean;

  constructor(options?: HelloWorldWebServerOptions) {
    this.autoOpenBrowser = options?.autoOpenBrowser ?? process.env.NODE_ENV !== "test";
    this.app = express();

    // EJS 뷰 엔진 설정
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(__dirname, "../../views"));

    // 정적 파일 제공 설정 (선택사항)
    this.app.use(express.static(path.join(__dirname, "../../public")));

    this.setupRoutes();
  }

  /**
   * Express 라우트 설정
   */
  private setupRoutes(): void {
    // 메인 페이지: "hello world" 표시
    this.app.get("/", (_req: Request, res: Response) => {
      res.render("index");
    });

    // 헬스 체크 엔드포인트
    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "ok",
        message: "MCP server is running",
      });
    });

    // 히스토리 JSON API
    this.app.get("/api/history", (req: Request, res: Response) => {
      const toolName = req.query.toolName as string | undefined;
      const history = HistoryService.getInstance().getHistory(toolName);
      res.json(history);
    });

    // 히스토리 페이지 (EJS 렌더링)
    this.app.get("/history", (_req: Request, res: Response) => {
      const history = HistoryService.getInstance().getHistory("get_kst_time");
      res.render("history", { history });
    });

    // SSE 엔드포인트
    this.app.get("/api/history/stream", (req: Request, res: Response) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // 연결 수립을 위한 초기 주석 전송 (클라이언트가 연결 성공을 인식하도록 함)
      res.write(": connected\n\n");

      const listener = (entry: HistoryEntry) => {
        console.error(`Listener triggered for history(${entry.id}) entry: [${entry.toolName}] at ${entry.timestampKst} response: ${JSON.stringify(entry.response)}`);
        if (entry.toolName === "get_kst_time") {
          console.error(
            `Sending SSE for history(${entry.id}) entry: [${entry.toolName}] at ${entry.timestampKst}`
          );
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
        }
      };

      HistoryService.getInstance().on("historyAdded", listener);

      // 연결 추적 시작
      const connection: SseConnection = { response: res, listener };
      this.sseConnections.add(connection);
      console.error(`SSE connection established (total: ${this.sseConnections.size})`);

      // 클라이언트가 연결을 끊으면 정리
      req.on("close", () => {
        this.sseConnections.delete(connection);
        console.error(`SSE client disconnected (remaining: ${this.sseConnections.size})`);
      });
    });
  }

  /**
   * 포트를 자동으로 찾아 웹 서버를 시작하고 브라우저를 엽니다.
   *
   * @throws 모든 포트 시도가 실패한 경우 에러를 throw합니다.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.error("Web server is already running");
      return;
    }

    let currentPort = this.startPort;
    let attempts = 0;

    while (attempts < this.maxPortAttempts) {
      try {
        await this.startOnPort(currentPort);
        this.port = currentPort;
        this.isRunning = true;

        const url = `http://localhost:${this.port}`;
        console.error(`Web server started at ${url}`);

        // 브라우저 자동 열기
        if (this.autoOpenBrowser) {
          try {
            await openBrowser(url);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to open browser: ${errorMessage}`);
            console.error(`Please open ${url} manually in your browser`);
          }
        }

        return;
      } catch (error) {
        if (this.isPortInUseError(error)) {
          attempts++;
          if (attempts < this.maxPortAttempts) {
            console.error(`Port ${currentPort} is in use, trying ${currentPort + 1}...`);
            currentPort++;
          }
        } else {
          // 포트 점유 외 다른 에러는 즉시 throw
          throw error;
        }
      }
    }

    throw new Error(
      `Failed to start web server: all ports from ${this.startPort} to ${this.startPort + this.maxPortAttempts - 1} are in use`
    );
  }

  /**
   * 특정 포트에서 서버 시작 시도
   */
  private startOnPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(port);

      server.on("listening", () => {
        this.server = server;

        // HTTP 연결 추적 (정상 종료를 위해)
        server.on("connection", (socket: Socket) => {
          this.httpConnections.add(socket);
          socket.on("close", () => {
            this.httpConnections.delete(socket);
          });
        });

        resolve();
      });

      server.on("error", (error) => {
        server.close();
        reject(error);
      });
    });
  }

  /**
   * 에러가 포트 점유 에러인지 확인
   */
  private isPortInUseError(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "EADDRINUSE";
  }

  /**
   * 모든 활성 SSE 연결을 graceful하게 종료합니다.
   * - 클라이언트에게 종료 이벤트 전송
   * - EventEmitter 리스너 제거
   * - Response 스트림 닫기
   */
  private async closeAllSseConnections(): Promise<void> {
    console.error(`Closing ${this.sseConnections.size} active SSE connection(s)...`);

    if (this.sseConnections.size === 0) {
      return;
    }

    const closePromises: Promise<void>[] = [];

    for (const connection of this.sseConnections) {
      const closePromise = new Promise<void>((resolve) => {
        // 개별 연결에 대한 타임아웃 (2초)
        const timeout = setTimeout(() => {
          console.error("SSE connection close timeout, forcing close");
          resolve();
        }, 2000);

        try {
          // 클라이언트에게 종료 알림 (재연결 방지)
          connection.response.write('event: shutdown\ndata: {"reason":"server_stopping"}\n\n');

          // EventEmitter 리스너 제거
          HistoryService.getInstance().off("historyAdded", connection.listener);

          // Response 스트림 종료
          // Note: end() 콜백은 호출되지 않을 수 있으므로 즉시 resolve
          connection.response.end();

          // end()는 동기적으로 처리되므로 바로 resolve
          clearTimeout(timeout);
          resolve();
        } catch (error) {
          // Response가 이미 닫혔을 수 있음 (클라이언트가 먼저 연결 해제)
          console.error("Error closing SSE connection:", error);
          clearTimeout(timeout);
          resolve(); // 에러가 나도 계속 진행
        }
      });

      closePromises.push(closePromise);
    }

    // 모든 연결이 닫힐 때까지 대기 (최대 5초 타임아웃)
    await Promise.race([
      Promise.all(closePromises),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);

    // Set 비우기
    this.sseConnections.clear();
    console.error("All SSE connections closed");
  }

  /**
   * 웹 서버를 gracefully 종료합니다.
   */
  async stop(): Promise<void> {
    if (!this.server) {
      console.error("Web server is not running");
      return;
    }

    // Step 1: SSE 연결 먼저 정리
    console.error("Closing SSE connections before stopping web server...");
    await this.closeAllSseConnections();

    // Step 2: 모든 HTTP 소켓 연결 강제 종료
    console.error(`Closing ${this.httpConnections.size} HTTP connection(s)...`);
    for (const socket of this.httpConnections) {
      socket.destroy();
    }
    this.httpConnections.clear();

    console.error("Stopping web server...");
    // Step 3: HTTP 서버 종료 (모든 연결이 닫혔으므로 즉시 종료됨)
    return new Promise((resolve, reject) => {
      // 서버 종료에 타임아웃 추가 (5초로 단축 - 연결이 모두 닫혔으므로)
      const timeout = setTimeout(() => {
        console.error("Server close timeout, forcing shutdown");
        this.server = null;
        this.isRunning = false;
        resolve();
      }, 5000);

      this.server!.close((error) => {
        clearTimeout(timeout);

        if (error) {
          console.error("Error stopping web server:", error);
          reject(error);
        } else {
          this.server = null;
          this.isRunning = false;
          console.error("Web server stopped");
          resolve();
        }
      });
    });
  }

  /**
   * 실제로 할당된 포트 번호를 반환합니다.
   */
  getPort(): number {
    return this.port;
  }

  /**
   * 웹 서버가 실행 중인지 확인합니다.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}
