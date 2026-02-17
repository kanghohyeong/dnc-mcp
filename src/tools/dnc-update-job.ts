import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { updateTaskInTree, validateTaskStatus, validateTaskId } from "../utils/dnc-utils.js";
import type { IDncTaskRepository, TaskStatus } from "../repositories/index.js";

export function registerDncUpdateJobTool(mcpServer: McpServer, repository: IDncTaskRepository) {
  mcpServer.registerTool(
    "dnc_update_job",
    {
      description: "task의 goal, status, acceptance를 업데이트합니다.",
      inputSchema: {
        root_task_id: z
          .string()
          .describe("Root task의 job title (필수, 영문 10단어 이하, kebab-case)"),
        task_id: z
          .string()
          .describe("업데이트할 task의 job title (필수, 영문 10단어 이하, kebab-case)"),
        goal: z.string().optional().describe("새로운 목표 (선택)"),
        status: z
          .enum(["init", "accept", "in-progress", "done", "delete", "hold", "split"])
          .optional()
          .describe(
            '새로운 상태 (선택, "init" | "accept" | "in-progress" | "done" | "delete" | "hold" | "split")'
          ),
        acceptance: z.string().optional().describe("새로운 완료 기준 (선택)"),
      },
    },
    async (args) => {
      try {
        const { root_task_id, task_id, goal, status, acceptance } = args;

        // 최소 하나의 업데이트 필드 검증
        if (!goal && !status && !acceptance) {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: goal, status, acceptance 중 최소 하나는 제공되어야 합니다.",
              },
            ],
            isError: true,
          };
        }

        // status 검증
        if (status && !validateTaskStatus(status)) {
          return {
            content: [
              {
                type: "text" as const,
                text: '오류: 유효하지 않은 status입니다. "init", "accept", "in-progress", "done", "delete", "hold", "split" 중 하나여야 합니다.',
              },
            ],
            isError: true,
          };
        }

        // root_task_id 검증
        const rootValidation = validateTaskId(root_task_id);
        if (!rootValidation.isValid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: root_task_id이 유효하지 않습니다. ${rootValidation.error}`,
              },
            ],
            isError: true,
          };
        }

        // task_id 검증
        const taskValidation = validateTaskId(task_id);
        if (!taskValidation.isValid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: task_id가 유효하지 않습니다. ${taskValidation.error}`,
              },
            ],
            isError: true,
          };
        }

        // Root task 존재 확인
        if (!(await repository.rootTaskExists(root_task_id))) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: Root task "${root_task_id}"이(가) 존재하지 않습니다.`,
              },
            ],
            isError: true,
          };
        }

        // Root task 읽기
        const rootTask = await repository.findRootTask(root_task_id);

        // Task 업데이트
        const updates: { goal?: string; status?: TaskStatus; acceptance?: string } = {};
        if (goal) updates.goal = goal;
        if (status) updates.status = status;
        if (acceptance) updates.acceptance = acceptance;

        const success = updateTaskInTree(rootTask, task_id, updates);

        if (!success) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: Task "${task_id}"를 트리에서 찾을 수 없습니다.`,
              },
            ],
            isError: true,
          };
        }

        // Root task 저장
        await repository.saveRootTask(root_task_id, rootTask);

        return {
          content: [
            {
              type: "text" as const,
              text: `Task가 성공적으로 업데이트되었습니다!\n\n📋 Root Task: ${root_task_id}\n📋 Updated Task: ${task_id}\n${goal ? `🎯 New Goal: ${goal}\n` : ""}${status ? `📊 New Status: ${status}\n` : ""}${acceptance ? `✅ New Acceptance: ${acceptance}\n` : ""}\nTask 파일이 업데이트되었습니다.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Task 업데이트 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
