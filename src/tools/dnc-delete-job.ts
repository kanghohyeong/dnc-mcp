import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs/promises";
import * as z from "zod";
import {
  readJobRelation,
  writeJobRelation,
  findJobInTree,
  deleteJobInTree,
  deleteAllSpecFiles,
  jobExists,
} from "../utils/dnc-utils.js";

export function registerDncDeleteJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_delete_job",
    {
      description:
        "job을 삭제합니다. root job이면 전체 디렉토리를, child job이면 트리에서 제거합니다.",
      inputSchema: {
        job_title: z.string().describe("삭제할 job title (필수)"),
        parent_job_title: z.string().optional().describe("부모 job title (child job 삭제 시 필수)"),
      },
    },
    async (args) => {
      try {
        const { job_title, parent_job_title } = args;

        // 인자 검증
        if (!job_title) {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: job_title는 필수 입력 항목입니다.",
              },
            ],
            isError: true,
          };
        }

        // root job 삭제 (parent_job_title가 없는 경우)
        if (!parent_job_title) {
          if (!(await jobExists(job_title))) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `오류: job "${job_title}"이(가) 존재하지 않습니다.`,
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
                text: `Root job "${job_title}"이(가) 삭제되었습니다.`,
              },
            ],
          };
        }

        // child job 삭제 (parent_job_title가 있는 경우)
        const rootJobTitle = parent_job_title.split("/")[0];

        let parentJobRelation;
        try {
          parentJobRelation = await readJobRelation(rootJobTitle);
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: 부모 job "${parent_job_title}"이(가) 존재하지 않습니다.`,
              },
            ],
            isError: true,
          };
        }

        // 삭제할 job 찾기
        const jobToDelete = findJobInTree(parentJobRelation, job_title);
        if (!jobToDelete) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job "${job_title}"을(를) 찾을 수 없습니다.`,
              },
            ],
            isError: true,
          };
        }

        // spec 파일들 재귀적으로 삭제
        await deleteAllSpecFiles(rootJobTitle, jobToDelete);

        // 트리에서 job 제거
        deleteJobInTree(parentJobRelation, job_title);

        // 업데이트된 root job 저장
        await writeJobRelation(rootJobTitle, parentJobRelation);

        return {
          content: [
            {
              type: "text" as const,
              text: `Job "${job_title}"이(가) 삭제되었습니다.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Job 삭제 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
