import type { Express, Request, Response } from "express";
import { DncJobService } from "./dnc-job-service.js";

/**
 * Express 라우트를 등록하는 클래스
 */
export class RouteRegistrar {
  private dncJobService: DncJobService;

  constructor(dncJobService?: DncJobService) {
    this.dncJobService = dncJobService || new DncJobService();
  }

  /**
   * 모든 라우트를 등록
   */
  registerRoutes(app: Express): void {
    this.registerMainRoute(app);
    this.registerHealthRoute(app);
    this.registerDncJobDetailRoute(app);
  }

  /**
   * GET / - 메인 페이지 (DnC Jobs 목록)
   */
  private registerMainRoute(app: Express): void {
    app.get("/", async (_req: Request, res: Response) => {
      const jobs = await this.dncJobService.getAllRootTasks();
      res.render("dnc-jobs", { jobs });
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
   * GET /:jobTitle - DnC job 상세 페이지
   */
  private registerDncJobDetailRoute(app: Express): void {
    app.get("/:jobTitle", async (req: Request, res: Response) => {
      const jobTitle = req.params.jobTitle as string;

      try {
        const task = await this.dncJobService.getTaskById(jobTitle);

        if (!task) {
          res.status(404).render("error", {
            message: "Task not found",
            error: { status: 404, stack: "" },
          });
          return;
        }

        res.render("dnc-job-detail", {
          job: task,
        });
      } catch (error) {
        res.status(500).render("error", {
          message: "Failed to load task details",
          error: {
            status: 500,
            stack: error instanceof Error ? error.stack : "",
          },
        });
      }
    });
  }
}
