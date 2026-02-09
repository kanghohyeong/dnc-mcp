import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  readJobRelation,
  writeJobRelation,
  updateJobInTree,
  validateJobStatus,
  type JobStatus,
} from "../utils/dnc-utils.js";

export function registerDncUpdateJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_update_job",
    {
      description: "job의 goal 또는 status를 업데이트합니다.",
      inputSchema: {
        job_id: z.string().describe("업데이트할 job ID (필수)"),
        parent_job_id: z.string().optional().describe("부모 job ID (child job 업데이트 시 지정)"),
        goal: z.string().optional().describe("새로운 목표 (선택)"),
        status: z
          .enum(["pending", "in-progress", "done"])
          .optional()
          .describe("새로운 상태 (선택)"),
      },
    },
    async (args) => {
      try {
        const { job_id, parent_job_id, goal, status } = args;

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

        if (!goal && !status) {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: goal 또는 status 중 하나 이상 업데이트할 내용을 제공해야 합니다.",
              },
            ],
            isError: true,
          };
        }

        // status 검증
        if (status && !validateJobStatus(status)) {
          return {
            content: [
              {
                type: "text" as const,
                text: '오류: 유효하지 않은 상태값입니다. "pending", "in-progress", "done" 중 하나를 사용하세요.',
              },
            ],
            isError: true,
          };
        }

        // root job ID 결정
        const rootJobId = parent_job_id ? parent_job_id.split("/")[0] : job_id;

        // job relation 읽기
        let jobRelation;
        try {
          jobRelation = await readJobRelation(rootJobId);
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job "${rootJobId}"이(가) 존재하지 않습니다.`,
              },
            ],
            isError: true,
          };
        }

        // 업데이트 데이터 준비
        const updates: { goal?: string; status?: JobStatus } = {};
        if (goal) {
          updates.goal = goal;
        }
        if (status && validateJobStatus(status)) {
          updates.status = status;
        }

        // job 업데이트
        const updated = updateJobInTree(jobRelation, job_id, updates);

        if (!updated) {
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

        // 업데이트된 job relation 저장
        await writeJobRelation(rootJobId, jobRelation);

        const updatedFields = [];
        if (goal) updatedFields.push(`Goal: ${goal}`);
        if (status) updatedFields.push(`Status: ${status}`);

        return {
          content: [
            {
              type: "text" as const,
              text: `Job "${job_id}"이(가) 업데이트되었습니다!

${updatedFields.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Job 업데이트 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
