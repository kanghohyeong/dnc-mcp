import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import * as fs from "fs/promises";
import {
  readTask,
  writeTask,
  deleteTaskInTree,
  taskExists,
  validateTaskId,
} from "../utils/dnc-utils.js";

export function registerDncDeleteJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_delete_job",
    {
      description:
        "task를 삭제합니다. Root task면 전체 디렉토리를, child task면 트리에서 제거합니다.",
      inputSchema: {
        root_task_id: z
          .string()
          .describe("Root task의 job title (필수, 영문 10단어 이하, kebab-case)"),
        task_id: z
          .string()
          .describe("삭제할 task의 job title (필수, 영문 10단어 이하, kebab-case)"),
      },
    },
    async (args) => {
      try {
        const { root_task_id, task_id } = args;

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

        // Root task 삭제 (root_task_id === task_id)
        if (root_task_id === task_id) {
          if (!(await taskExists(root_task_id))) {
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

          await fs.rm(`.dnc/${root_task_id}`, { recursive: true, force: true });

          return {
            content: [
              {
                type: "text" as const,
                text: `Root task가 성공적으로 삭제되었습니다!

📋 Deleted Task: ${task_id}
🗑️  전체 디렉토리가 삭제되었습니다: .dnc/${root_task_id}`,
              },
            ],
          };
        }

        // Child task 삭제 (root_task_id !== task_id)
        if (!(await taskExists(root_task_id))) {
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

        const rootTask = await readTask(root_task_id);
        const success = deleteTaskInTree(rootTask, task_id);

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

        await writeTask(root_task_id, rootTask);

        return {
          content: [
            {
              type: "text" as const,
              text: `Child task가 성공적으로 삭제되었습니다!

📋 Root Task: ${root_task_id}
📋 Deleted Task: ${task_id}
🗑️  트리에서 제거되었습니다.`,
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
