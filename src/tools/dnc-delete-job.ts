import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import * as fs from "fs/promises";
import { readTask, writeTask, deleteTaskInTree, taskExists } from "../utils/dnc-utils.js";

export function registerDncDeleteJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_delete_job",
    {
      description:
        "task를 삭제합니다. Root task면 전체 디렉토리를, child task면 트리에서 제거합니다.",
      inputSchema: {
        job_title: z.string().describe("삭제할 job title (필수, 영문 10단어 이하, kebab-case)"),
        parent_job_title: z
          .string()
          .optional()
          .describe("부모 job title (child task 삭제 시 지정)"),
      },
    },
    async (args) => {
      try {
        const { job_title, parent_job_title } = args;

        // Child task 삭제
        if (parent_job_title) {
          // 부모 task 존재 확인
          if (!(await taskExists(parent_job_title))) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `오류: parent_job_title "${parent_job_title}"이(가) 존재하지 않습니다.`,
                },
              ],
              isError: true,
            };
          }

          // Root task 읽기
          const rootTask = await readTask(parent_job_title);

          // Child task 삭제
          const success = deleteTaskInTree(rootTask, job_title);

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
          await writeTask(parent_job_title, rootTask);

          return {
            content: [
              {
                type: "text" as const,
                text: `Child task가 성공적으로 삭제되었습니다!

📋 Deleted Task: ${job_title}
🗑️  Parent에서 제거되었습니다.`,
              },
            ],
          };
        }

        // Root task 삭제
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

        // 전체 디렉토리 삭제
        await fs.rm(`.dnc/${job_title}`, { recursive: true, force: true });

        return {
          content: [
            {
              type: "text" as const,
              text: `Root task가 성공적으로 삭제되었습니다!

📋 Deleted Task: ${job_title}
🗑️  전체 디렉토리가 삭제되었습니다: .dnc/${job_title}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Task 삭제 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
