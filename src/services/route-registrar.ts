import type { Express, Request, Response } from "express";
import { ConnectionManager } from "./connection-manager.js";
import { HistoryService, type HistoryEntry } from "./history-service.js";
import { DncJobService, type DncJobWithDetails } from "./dnc-job-service.js";
import { DncJobDetailLoader } from "./dnc-job-detail-loader.js";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Express 라우트를 등록하는 클래스
 */
export class RouteRegistrar {
  private historyService: HistoryService;
  private connectionManager: ConnectionManager;
  private dncJobService: DncJobService;
  private dncJobDetailLoader: DncJobDetailLoader;

  constructor(historyService: HistoryService, connectionManager: ConnectionManager) {
    this.historyService = historyService;
    this.connectionManager = connectionManager;
    this.dncJobService = new DncJobService();
    this.dncJobDetailLoader = new DncJobDetailLoader();
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
    this.registerDncJobsRoute(app);
    this.registerDncJobDetailRoute(app);
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

  /**
   * GET /dnc/jobs - DnC jobs 목록 페이지
   */
  private registerDncJobsRoute(app: Express): void {
    app.get("/dnc/jobs", async (_req: Request, res: Response) => {
      const jobs = await this.dncJobService.getAllRootJobs();
      res.render("dnc-jobs", { jobs });
    });
  }

  /**
   * 마크다운을 HTML로 변환
   */
  private async convertMarkdownToHtml(markdown: string): Promise<string> {
    const rawHtml = await marked.parse(markdown, {
      breaks: true,
      gfm: true,
    });

    return sanitizeHtml(rawHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        code: ["class"],
      },
    });
  }

  /**
   * Job 객체에 재귀적으로 specContentHtml 추가
   */
  private async addHtmlToJob(
    job: DncJobWithDetails
  ): Promise<DncJobWithDetails & { specContentHtml: string }> {
    const specContentHtml = await this.convertMarkdownToHtml(job.specContent);

    const dividedJobsWithHtml = await Promise.all(
      job.divided_jobs.map((childJob) => this.addHtmlToJob(childJob))
    );

    return {
      ...job,
      specContentHtml,
      divided_jobs: dividedJobsWithHtml,
    };
  }

  /**
   * GET /dnc/jobs/:jobId - DnC job 상세 페이지
   */
  private registerDncJobDetailRoute(app: Express): void {
    app.get("/dnc/jobs/:jobId", async (req: Request, res: Response) => {
      const jobId = req.params.jobId as string;

      try {
        const job = await this.dncJobDetailLoader.loadJobByIdWithDetails(jobId);

        if (!job) {
          res.status(404).render("error", {
            message: "Job not found",
            error: { status: 404, stack: "" },
          });
          return;
        }

        // 재귀적으로 마크다운을 HTML로 변환
        const jobWithHtml = await this.addHtmlToJob(job);

        res.render("dnc-job-detail", {
          job: jobWithHtml,
          specContentHtml: jobWithHtml.specContentHtml,
        });
      } catch (error) {
        res.status(500).render("error", {
          message: "Failed to load job details",
          error: {
            status: 500,
            stack: error instanceof Error ? error.stack : "",
          },
        });
      }
    });
  }
}
