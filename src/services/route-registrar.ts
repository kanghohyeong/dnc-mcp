import type { Express, Request, Response } from "express";
import { ConnectionManager } from "./connection-manager.js";
import { HistoryService, type HistoryEntry } from "./history-service.js";

/**
 * Express 라우트를 등록하는 클래스
 */
export class RouteRegistrar {
  private historyService: HistoryService;
  private connectionManager: ConnectionManager;

  constructor(historyService: HistoryService, connectionManager: ConnectionManager) {
    this.historyService = historyService;
    this.connectionManager = connectionManager;
  }

  /**
   * 모든 라우트를 등록
   */
  registerRoutes(app: Express): void {
    this.registerMainRoute(app);
    this.registerHealthRoute(app);
    this.registerHistoryApiRoute(app);
    this.registerHistoryPageRoute(app);
    this.registerHistoryStreamRoute(app);
  }

  /**
   * GET / - 메인 페이지
   */
  private registerMainRoute(app: Express): void {
    app.get("/", (_req: Request, res: Response) => {
      res.render("index");
    });
  }

  /**
   * GET /health - 헬스 체크
   */
  private registerHealthRoute(app: Express): void {
    app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "ok",
        message: "MCP server is running",
      });
    });
  }

  /**
   * GET /api/history - 히스토리 JSON API
   */
  private registerHistoryApiRoute(app: Express): void {
    app.get("/api/history", (req: Request, res: Response) => {
      const toolName = req.query.toolName as string | undefined;
      const history = this.historyService.getHistory(toolName);
      res.json(history);
    });
  }

  /**
   * GET /history - 히스토리 페이지 (EJS)
   */
  private registerHistoryPageRoute(app: Express): void {
    app.get("/history", (_req: Request, res: Response) => {
      const history = this.historyService.getHistory("get_kst_time");
      res.render("history", { history });
    });
  }

  /**
   * GET /api/history/stream - SSE 엔드포인트
   */
  private registerHistoryStreamRoute(app: Express): void {
    app.get("/api/history/stream", (_req: Request, res: Response) => {
      // SSE 헤더 설정
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // 초기 주석 전송
      res.write(": connected\n\n");

      // historyAdded 이벤트 리스너 생성
      const listener = (entry: unknown) => {
        const historyEntry = entry as HistoryEntry;
        // get_kst_time만 필터링
        if (historyEntry.toolName === "get_kst_time") {
          res.write(`data: ${JSON.stringify(historyEntry)}\n\n`);
        }
      };

      // ConnectionManager를 통해 SSE 연결 추적
      this.connectionManager.trackSseConnection(res, listener);
    });
  }
}
