import type { Express, Request, Response } from "express";
import { DncJobService, type DncJobWithDetails } from "./dnc-job-service.js";
import { DncJobDetailLoader } from "./dnc-job-detail-loader.js";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Express 라우트를 등록하는 클래스
 */
export class RouteRegistrar {
  private dncJobService: DncJobService;
  private dncJobDetailLoader: DncJobDetailLoader;

  constructor(dncJobService?: DncJobService, dncJobDetailLoader?: DncJobDetailLoader) {
    this.dncJobService = dncJobService || new DncJobService();
    this.dncJobDetailLoader = dncJobDetailLoader || new DncJobDetailLoader();
  }

  /**
   * 모든 라우트를 등록
   */
  registerRoutes(app: Express): void {
    this.registerMainRoute(app);
    this.registerHealthRoute(app);
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
    app.get("/dnc/jobs/:jobTitle", async (req: Request, res: Response) => {
      const jobTitle = req.params.jobTitle as string;

      try {
        const job = await this.dncJobDetailLoader.loadJobByTitleWithDetails(jobTitle);

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
