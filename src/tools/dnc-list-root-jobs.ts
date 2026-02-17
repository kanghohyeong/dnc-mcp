import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IDncTaskRepository } from "../repositories/index.js";

/**
 * DNC 루트 task 목록 조회 도구를 등록합니다.
 * @param mcpServer - MCP 서버 인스턴스
 */
export function registerDncListRootJobsTool(
  mcpServer: McpServer,
  repository: IDncTaskRepository
): void {
  mcpServer.registerTool(
    "dnc_list_root_jobs",
    {
      description: "루트 Task 목록 조회 DNC MCP Tool 구현 계획",
      inputSchema: {},
    },
    async () => {
      try {
        // 모든 루트 task ID 조회
        const taskIds = await repository.listRootTaskIds();

        // 루트 task가 없는 경우
        if (taskIds.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No root tasks found. Create a root task using dnc_init_job.",
              },
            ],
          };
        }

        // 각 루트 task의 요약 정보 수집
        const summaries = await Promise.all(
          taskIds.map(async (taskId) => {
            try {
              const task = await repository.findRootTask(taskId);
              return { id: task.id, goal: task.goal, status: task.status };
            } catch {
              console.error(`Warning: Failed to read task ${taskId}`);
              return null;
            }
          })
        );

        // null 값 필터링 (손상된 파일)
        const validSummaries = summaries.filter((s) => s !== null);

        // 결과 포맷팅
        const lines: string[] = ["Root Tasks:", ""];

        for (const summary of validSummaries) {
          lines.push(`- ${summary.id}`);
          lines.push(`  Goal: ${summary.goal}`);
          lines.push(`  Status: ${summary.status}`);
          lines.push("");
        }

        lines.push("---");
        const count = validSummaries.length;
        lines.push(`Total: ${count} root ${count === 1 ? "task" : "tasks"}`);

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list root tasks: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
