import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import type { IDncTaskRepository } from "../repositories/index.js";

export function registerDncGetTaskRelationsTool(
  mcpServer: McpServer,
  repository: IDncTaskRepository
) {
  mcpServer.registerTool(
    "dnc_get_task_relations",
    {
      description: "task의 분할 관계(트리 구조)를 조회합니다.",
      inputSchema: {
        task_title: z.string().describe("조회할 job title (필수, 영문 10단어 이하, kebab-case)"),
      },
    },
    async (args) => {
      try {
        const { task_title } = args;

        // Task 존재 확인
        if (!(await repository.rootTaskExists(task_title))) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: task_title "${task_title}"이(가) 존재하지 않습니다.`,
              },
            ],
            isError: true,
          };
        }

        // Task 읽기
        const task = await repository.findRootTask(task_title);

        // JSON 포맷팅
        const formattedJson = JSON.stringify(task, null, 2);

        return {
          content: [
            {
              type: "text" as const,
              text: `Task 구조:\n\n\`\`\`json\n${formattedJson}\n\`\`\`\n\n📋 Task ID: ${task.id}\n🎯 Goal: ${task.goal}\n✅ Acceptance: ${task.acceptance}\n📊 Status: ${task.status}\n🔢 Subtasks: ${task.tasks.length}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Task 조회 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
