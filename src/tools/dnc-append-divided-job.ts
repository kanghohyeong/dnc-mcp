import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  generateJobId,
  readJobRelation,
  writeJobRelation,
  writeSpecFile,
  findJobInTree,
  type JobRelation,
} from "../utils/dnc-utils.js";

export function registerDncAppendDividedJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_append_divided_job",
    {
      description: "부모 job의 divided_jobs 목록에 하위 작업을 추가합니다.",
      inputSchema: {
        parent_job_id: z.string().describe("부모 job ID (필수)"),
        child_goal: z.string().describe("하위 작업의 목표 (필수)"),
        requirements: z.string().optional().describe("요구사항 (선택)"),
        constraints: z.string().optional().describe("제약조건 (선택)"),
        acceptance_criteria: z.string().optional().describe("완료 기준 (선택)"),
      },
    },
    async (args) => {
      try {
        const { parent_job_id, child_goal, requirements, constraints, acceptance_criteria } = args;

        // 인자 검증
        if (!parent_job_id) {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: parent_job_id는 필수 입력 항목입니다.",
              },
            ],
            isError: true,
          };
        }

        if (!child_goal || child_goal.trim() === "") {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: child_goal은 필수 입력 항목입니다.",
              },
            ],
            isError: true,
          };
        }

        // root job ID 추출 (job-xxx 형식에서 root job ID는 첫 번째 job ID)
        const rootJobId = parent_job_id.split("/")[0];

        // 부모 job 읽기
        let parentJobRelation: JobRelation;
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

        // 부모 job 찾기 (트리에서)
        const targetParent =
          parent_job_id === rootJobId
            ? parentJobRelation
            : findJobInTree(parentJobRelation, parent_job_id);

        if (!targetParent) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: 부모 job "${parent_job_id}"을(를) 찾을 수 없습니다.`,
              },
            ],
            isError: true,
          };
        }

        // child job ID 생성
        const childJobId = generateJobId(child_goal);

        // 중복 확인
        const duplicate = findJobInTree(parentJobRelation, childJobId);
        if (duplicate) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: child job ID "${childJobId}"이(가) 이미 존재합니다.`,
              },
            ],
            isError: true,
          };
        }

        // child job 생성
        const specPath = `.dnc/${rootJobId}/specs/${childJobId}.md`;
        const childJob: JobRelation = {
          id: childJobId,
          goal: child_goal,
          spec: specPath,
          status: "pending",
          divided_jobs: [],
        };

        // 부모 job의 divided_jobs에 추가
        targetParent.divided_jobs.push(childJob);

        // 업데이트된 root job 저장
        await writeJobRelation(rootJobId, parentJobRelation);

        // spec 파일 생성
        await writeSpecFile(
          rootJobId,
          childJobId,
          child_goal,
          requirements,
          constraints,
          acceptance_criteria
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `하위 작업이 추가되었습니다!

📋 Child Job ID: ${childJobId}
🎯 Goal: ${child_goal}
👨‍👩‍👧 Parent: ${parent_job_id}
📝 Spec: ${specPath}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `하위 작업 추가 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
