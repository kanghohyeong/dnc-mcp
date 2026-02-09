import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  generateJobId,
  ensureDncDirectory,
  writeJobRelation,
  writeSpecFile,
  jobExists,
  type JobRelation,
} from "../utils/dnc-utils.js";

export function registerDncInitJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_init_job",
    {
      description: "DnC 워크플로우의 최상위 작업(root job)을 생성합니다.",
      inputSchema: {
        goal: z.string().describe("작업의 목표 (필수)"),
        requirements: z.string().optional().describe("요구사항 (선택)"),
        constraints: z.string().optional().describe("제약조건 (선택)"),
        acceptance_criteria: z.string().optional().describe("완료 기준 (선택)"),
      },
    },
    async (args) => {
      try {
        const { goal, requirements, constraints, acceptance_criteria } = args;

        // goal 검증
        if (!goal || goal.trim() === "") {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: goal은 필수 입력 항목입니다.",
              },
            ],
            isError: true,
          };
        }

        // job ID 생성
        const jobId = generateJobId(goal);

        // 중복 확인
        if (await jobExists(jobId)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job ID "${jobId}"가 이미 존재합니다.`,
              },
            ],
            isError: true,
          };
        }

        // 디렉토리 생성
        await ensureDncDirectory(jobId);

        // job relation 데이터 생성
        const specPath = `.dnc/${jobId}/specs/${jobId}.md`;
        const jobRelation: JobRelation = {
          id: jobId,
          goal: goal,
          spec: specPath,
          status: "pending",
          divided_jobs: [],
        };

        // job relation 파일 저장
        await writeJobRelation(jobId, jobRelation);

        // spec 파일 생성
        await writeSpecFile(jobId, jobId, goal, requirements, constraints, acceptance_criteria);

        return {
          content: [
            {
              type: "text" as const,
              text: `Root job이 성공적으로 생성되었습니다!

📋 Job ID: ${jobId}
🎯 Goal: ${goal}
📄 Job Relation: .dnc/${jobId}/job_relation.json
📝 Spec: ${specPath}

다음 단계: /dnc-divide 명령으로 하위 작업을 분할하세요.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Root job 생성 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
