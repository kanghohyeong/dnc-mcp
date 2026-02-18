import type { Express, Request, Response } from "express";
import { DncTaskService } from "./dnc-task-service.js";
import { updateTaskInTree, validateTaskStatus } from "../utils/dnc-utils.js";
import type { IDncTaskRepository, TaskStatus } from "../repositories/index.js";

/**
 * Batch update request 타입
 */
interface BatchUpdateRequest {
  updates: Array<{
    taskId: string;
    rootTaskId: string;
    status?: string;
    additionalInstructions?: string;
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
  private dncTaskService: DncTaskService;
  private repository: IDncTaskRepository;

  constructor(repository: IDncTaskRepository) {
    this.repository = repository;
    this.dncTaskService = new DncTaskService(repository);
  }

  /**
   * 모든 라우트를 등록
   */
  registerRoutes(app: Express): void {
    this.registerMainRoute(app);
    this.registerHealthRoute(app);
    this.registerBatchUpdateRoute(app);
    this.registerDncTaskDetailRoute(app);
  }

  /**
   * GET / - 메인 페이지 (DnC Tasks 목록)
   */
  private registerMainRoute(app: Express): void {
    app.get("/", async (_req: Request, res: Response) => {
      const { doneTasks, activeTasks } = await this.dncTaskService.getAllRootTasksSplit();
      res.render("dnc-tasks", { doneTasks, activeTasks });
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
          if (!update.taskId || !update.rootTaskId) {
            res.status(400).json({
              error: "Each update must have taskId and rootTaskId",
            });
            return;
          }

          if (!update.status && update.additionalInstructions === undefined) {
            res.status(400).json({
              error: "Each update must have at least status or additionalInstructions",
            });
            return;
          }

          // 3. status 값 검증 (status가 제공된 경우에만)
          if (update.status && !validateTaskStatus(update.status)) {
            res.status(400).json({
              error: `Invalid status value: ${update.status}`,
            });
            return;
          }
        }

        // 4. rootTaskId별로 업데이트 그룹화 (race condition 방지)
        const updatesByRoot = new Map<
          string,
          Array<{ taskId: string; status?: string; additionalInstructions?: string }>
        >();
        for (const update of updates) {
          if (!updatesByRoot.has(update.rootTaskId)) {
            updatesByRoot.set(update.rootTaskId, []);
          }
          updatesByRoot.get(update.rootTaskId)!.push({
            taskId: update.taskId,
            status: update.status,
            additionalInstructions: update.additionalInstructions,
          });
        }

        // 5. 각 root task별로 순차 처리
        const results: BatchUpdateResult[] = [];
        for (const [rootTaskId, taskUpdates] of updatesByRoot.entries()) {
          try {
            // Root task 읽기
            const rootTask = await this.repository.findRootTask(rootTaskId);

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
            for (const { taskId, status, additionalInstructions } of taskUpdates) {
              const updated = updateTaskInTree(rootTask, taskId, {
                ...(status !== undefined && { status: status as TaskStatus }),
                ...(additionalInstructions !== undefined && { additionalInstructions }),
              });

              results.push({
                taskId,
                success: updated,
                error: updated ? undefined : `Task not found: ${taskId}`,
              });
            }

            // 변경사항을 한 번만 저장 (race condition 방지)
            await this.repository.saveRootTask(rootTaskId, rootTask);
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
   * GET /:taskTitle - DnC task 상세 페이지
   */
  private registerDncTaskDetailRoute(app: Express): void {
    app.get("/:taskTitle", async (req: Request, res: Response) => {
      const taskTitle = req.params.taskTitle as string;

      try {
        const task = await this.dncTaskService.getTaskById(taskTitle);

        if (!task) {
          res.status(404).render("error", {
            message: "Task not found",
            error: { status: 404, stack: "" },
          });
          return;
        }

        res.render("dnc-task-detail", {
          task: task,
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
