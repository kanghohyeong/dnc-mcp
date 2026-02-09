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
        job_id: z.string().describe("삭제할 job ID (필수)"),
        parent_job_id: z.string().optional().describe("부모 job ID (child job 삭제 시 필수)"),
      },
    },
    async (args) => {
      try {
        const { job_id, parent_job_id } = args;

        // 인자 검증
        if (!job_id) {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: job_id는 필수 입력 항목입니다.",
              },
            ],
            isError: true,
          };
        }

        // root job 삭제 (parent_job_id가 없는 경우)
        if (!parent_job_id) {
          if (!(await jobExists(job_id))) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `오류: job "${job_id}"이(가) 존재하지 않습니다.`,
                },
              ],
              isError: true,
            };
          }

          // 전체 디렉토리 삭제
          await fs.rm(`.dnc/${job_id}`, { recursive: true, force: true });

          return {
            content: [
              {
                type: "text" as const,
                text: `Root job "${job_id}"이(가) 삭제되었습니다.`,
              },
            ],
          };
        }

        // child job 삭제 (parent_job_id가 있는 경우)
        const rootJobId = parent_job_id.split("/")[0];

        let parentJobRelation;
        try {
          parentJobRelation = await readJobRelation(rootJobId);
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: 부모 job "${parent_job_id}"이(가) 존재하지 않습니다.`,
              },
            ],
            isError: true,
          };
        }

        // 삭제할 job 찾기
        const jobToDelete = findJobInTree(parentJobRelation, job_id);
        if (!jobToDelete) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job "${job_id}"을(를) 찾을 수 없습니다.`,
              },
            ],
            isError: true,
          };
        }

        // spec 파일들 재귀적으로 삭제
        await deleteAllSpecFiles(rootJobId, jobToDelete);

        // 트리에서 job 제거
        deleteJobInTree(parentJobRelation, job_id);

        // 업데이트된 root job 저장
        await writeJobRelation(rootJobId, parentJobRelation);

        return {
          content: [
            {
              type: "text" as const,
              text: `Job "${job_id}"이(가) 삭제되었습니다.`,
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
