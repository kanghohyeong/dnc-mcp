import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  ensureDncDirectory,
  writeJobRelation,
  writeSpecFile,
  jobExists,
  validateJobTitle,
  type JobRelation,
} from "../utils/dnc-utils.js";

export function registerDncInitJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_init_job",
    {
      description: "DnC 워크플로우의 최상위 작업(root job)을 생성합니다.",
      inputSchema: {
        job_title: z
          .string()
          .describe(
            "작업의 고유 식별자 (필수, 영문 10단어 이하, kebab-case, 예: implement-user-auth)"
          ),
        goal: z.string().describe("작업의 목표 (필수)"),
        requirements: z.string().optional().describe("요구사항 (선택)"),
        constraints: z.string().optional().describe("제약조건 (선택)"),
        acceptance_criteria: z.string().optional().describe("완료 기준 (선택)"),
      },
    },
    async (args) => {
      try {
        const { job_title, goal, requirements, constraints, acceptance_criteria } = args;

        // job_title 검증
        const validation = validateJobTitle(job_title);
        if (!validation.isValid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: ${validation.error}`,
              },
            ],
            isError: true,
          };
        }

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

        // 중복 확인
        if (await jobExists(job_title)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job_title "${job_title}"이(가) 이미 존재합니다.`,
              },
            ],
            isError: true,
          };
        }

        // 디렉토리 생성
        await ensureDncDirectory(job_title);

        // job relation 데이터 생성
        const specPath = `.dnc/${job_title}/specs/${job_title}.md`;
        const jobRelation: JobRelation = {
          job_title: job_title,
          goal: goal,
          spec: specPath,
          status: "pending",
          divided_jobs: [],
        };

        // job relation 파일 저장
        await writeJobRelation(job_title, jobRelation);

        // spec 파일 생성
        await writeSpecFile(
          job_title,
          job_title,
          goal,
          requirements,
          constraints,
          acceptance_criteria
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Root job이 성공적으로 생성되었습니다!

📋 Job Title: ${job_title}
🎯 Goal: ${goal}
📄 Job Relation: .dnc/${job_title}/job_relation.json
📝 Spec: ${specPath}

다음 단계: dnc_append_divided_job 명령으로 하위 작업을 분할하세요.`,
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
