import express, { Express, Request, Response } from "express";
import { Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { openBrowser } from "../utils/browser-launcher.js";
import { HistoryService, type HistoryEntry } from "./history-service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  private readonly maxPortAttempts: number = 10;
  private isRunning: boolean = false;

  constructor() {
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
      res.send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Interlock MCP Server</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            h1 {
              color: white;
              font-size: 4rem;
              text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
              animation: fadeIn 1s ease-in;
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          </style>
        </head>
        <body>
          <h1>hello world</h1>
        </body>
        </html>
      `);
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

      const listener = (entry: HistoryEntry) => {
        if (entry.toolName === "get_kst_time") {
          console.error(`Sending SSE for history entry: [${entry.toolName}] at ${entry.timestampKst}`);
          res.write(`data: ${JSON.stringify(entry)}\n\n`);
        }
      };

      HistoryService.getInstance().on("historyAdded", listener);

      req.on("close", () => {
        HistoryService.getInstance().off("historyAdded", listener);
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
        try {
          await openBrowser(url);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to open browser: ${errorMessage}`);
          console.error(`Please open ${url} manually in your browser`);
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
   * 웹 서버를 gracefully 종료합니다.
   */
  async stop(): Promise<void> {
    if (!this.server) {
      console.error("Web server is not running");
      return;
    }

    console.error("Stopping web server...");
    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
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
