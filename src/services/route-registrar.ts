import type { Express, Request, Response } from "express";
import { DncJobService } from "./dnc-job-service.js";
import {
  readTask,
  writeTask,
  updateTaskInTree,
  validateTaskStatus,
  type TaskStatus,
} from "../utils/dnc-utils.js";

/**
 * Batch update request 타입
 */
interface BatchUpdateRequest {
  updates: Array<{
    taskId: string;
    rootTaskId: string;
    status: string;
  }>;
}

/**
 * Batch update result 타입
 */
interface BatchUpdateResult {
  taskId: string;
  success: boolean;
  error?: string;
}

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
    this.registerBatchUpdateRoute(app);
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
   * POST /api/tasks/batch-update - 여러 task의 상태를 일괄 업데이트
   */
  private registerBatchUpdateRoute(app: Express): void {
    app.post("/api/tasks/batch-update", async (req: Request, res: Response) => {
      try {
        const body = req.body as BatchUpdateRequest;
        const { updates } = body;

        // 1. 빈 배열 검증
        if (!Array.isArray(updates) || updates.length === 0) {
          res.status(400).json({
            error: "Updates array cannot be empty",
          });
          return;
        }

        // 2. 각 update 항목 검증
        for (const update of updates) {
          if (!update.taskId || !update.rootTaskId || !update.status) {
            res.status(400).json({
              error: "Each update must have taskId, rootTaskId, and status",
            });
            return;
          }

          // 3. status 값 검증
          if (!validateTaskStatus(update.status)) {
            res.status(400).json({
              error: `Invalid status value: ${update.status}`,
            });
            return;
          }
        }

        // 4. rootTaskId별로 업데이트 그룹화 (race condition 방지)
        const updatesByRoot = new Map<string, Array<{ taskId: string; status: string }>>();
        for (const update of updates) {
          if (!updatesByRoot.has(update.rootTaskId)) {
            updatesByRoot.set(update.rootTaskId, []);
          }
          updatesByRoot.get(update.rootTaskId)!.push({
            taskId: update.taskId,
            status: update.status,
          });
        }

        // 5. 각 root task별로 순차 처리
        const results: BatchUpdateResult[] = [];
        for (const [rootTaskId, taskUpdates] of updatesByRoot.entries()) {
          try {
            // Root task 읽기
            const rootTask = await readTask(rootTaskId);

            if (!rootTask) {
              // Root task가 없으면 해당 그룹의 모든 업데이트 실패
              for (const { taskId } of taskUpdates) {
                results.push({
                  taskId,
                  success: false,
                  error: `Root task not found: ${rootTaskId}`,
                });
              }
              continue;
            }

            // 같은 root task의 모든 업데이트를 한 번에 적용
            for (const { taskId, status } of taskUpdates) {
              const updated = updateTaskInTree(rootTask, taskId, {
                status: status as TaskStatus,
              });

              results.push({
                taskId,
                success: updated,
                error: updated ? undefined : `Task not found: ${taskId}`,
              });
            }

            // 변경사항을 한 번만 저장 (race condition 방지)
            await writeTask(rootTaskId, rootTask);
          } catch (error) {
            // 에러 발생 시 해당 그룹의 모든 업데이트 실패
            for (const { taskId } of taskUpdates) {
              results.push({
                taskId,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        // 6. 결과 반환
        res.status(200).json({
          success: true,
          results,
        });
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
