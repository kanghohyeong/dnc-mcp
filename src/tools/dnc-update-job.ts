import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  readTask,
  writeTask,
  updateTaskInTree,
  validateTaskStatus,
  taskExists,
  type TaskStatus,
} from "../utils/dnc-utils.js";

export function registerDncUpdateJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_update_job",
    {
      description: "task의 goal, status, acceptance를 업데이트합니다.",
      inputSchema: {
        job_title: z.string().describe("업데이트할 job title (필수, 영문 10단어 이하, kebab-case)"),
        parent_job_title: z
          .string()
          .optional()
          .describe("부모 job title (child task 업데이트 시 지정)"),
        goal: z.string().optional().describe("새로운 목표 (선택)"),
        status: z
          .enum(["pending", "in-progress", "done"])
          .optional()
          .describe('새로운 상태 (선택, "pending" | "in-progress" | "done")'),
        acceptance: z.string().optional().describe("새로운 완료 기준 (선택)"),
      },
    },
    async (args) => {
      try {
        const { job_title, parent_job_title, goal, status, acceptance } = args;

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
                text: '오류: 유효하지 않은 status입니다. "pending", "in-progress", "done" 중 하나여야 합니다.',
              },
            ],
            isError: true,
          };
        }

        // Root task title 결정
        const rootJobTitle = parent_job_title || job_title;

        // Root task 존재 확인
        if (!(await taskExists(rootJobTitle))) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job_title "${rootJobTitle}"이(가) 존재하지 않습니다.`,
              },
            ],
            isError: true,
          };
        }

        // Root task 읽기
        const rootTask = await readTask(rootJobTitle);

        // Task 업데이트
        const updates: { goal?: string; status?: TaskStatus; acceptance?: string } = {};
        if (goal) updates.goal = goal;
        if (status) updates.status = status;
        if (acceptance) updates.acceptance = acceptance;

        const success = updateTaskInTree(rootTask, job_title, updates);

        if (!success) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job_title "${job_title}"을(를) 찾을 수 없습니다.`,
              },
            ],
            isError: true,
          };
        }

        // Root task 저장
        await writeTask(rootJobTitle, rootTask);

        return {
          content: [
            {
              type: "text" as const,
              text: `Task가 성공적으로 업데이트되었습니다!

📋 Task: ${job_title}
${goal ? `🎯 New Goal: ${goal}\n` : ""}${status ? `📊 New Status: ${status}\n` : ""}${acceptance ? `✅ New Acceptance: ${acceptance}\n` : ""}
Task 파일이 업데이트되었습니다.`,
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
