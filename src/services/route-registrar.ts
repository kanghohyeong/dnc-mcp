import type { Express, Request, Response } from "express";
import { DncJobService } from "./dnc-job-service.js";
import type { Task } from "../utils/dnc-utils.js";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

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
   * Task 객체에 재귀적으로 acceptanceHtml 추가
   */
  private async addHtmlToTask(task: Task): Promise<Task & { acceptanceHtml: string }> {
    const acceptanceHtml = await this.convertMarkdownToHtml(task.acceptance);

    const tasksWithHtml = await Promise.all(
      task.tasks.map((childTask) => this.addHtmlToTask(childTask))
    );

    return {
      ...task,
      acceptanceHtml,
      tasks: tasksWithHtml,
    };
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

        // 재귀적으로 acceptance를 HTML로 변환
        const taskWithHtml = await this.addHtmlToTask(task);

        res.render("dnc-job-detail", {
          job: taskWithHtml,
          acceptanceHtml: taskWithHtml.acceptanceHtml,
          specContentHtml: "",
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
