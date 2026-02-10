import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { readTask, taskExists } from "../utils/dnc-utils.js";

export function registerDncGetJobRelationsTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_get_job_relations",
    {
      description: "task의 분할 관계(트리 구조)를 조회합니다.",
      inputSchema: {
        job_title: z.string().describe("조회할 job title (필수, 영문 10단어 이하, kebab-case)"),
      },
    },
    async (args) => {
      try {
        const { job_title } = args;

        // Task 존재 확인
        if (!(await taskExists(job_title))) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job_title "${job_title}"이(가) 존재하지 않습니다.`,
              },
            ],
            isError: true,
          };
        }

        // Task 읽기
        const task = await readTask(job_title);

        // JSON 포맷팅
        const formattedJson = JSON.stringify(task, null, 2);

        return {
          content: [
            {
              type: "text" as const,
              text: `Task 구조:

\`\`\`json
${formattedJson}
\`\`\`

📋 Task ID: ${task.id}
🎯 Goal: ${task.goal}
✅ Acceptance: ${task.acceptance}
📊 Status: ${task.status}
🔢 Subtasks: ${task.tasks.length}`,
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
