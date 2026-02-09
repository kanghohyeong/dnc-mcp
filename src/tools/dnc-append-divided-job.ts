import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  readJobRelation,
  writeJobRelation,
  writeSpecFile,
  findJobInTree,
  validateJobTitle,
  type JobRelation,
} from "../utils/dnc-utils.js";

export function registerDncAppendDividedJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_append_divided_job",
    {
      description: "부모 job의 divided_jobs 목록에 하위 작업을 추가합니다.",
      inputSchema: {
        parent_job_title: z
          .string()
          .describe("부모 job title (필수, 영문 10단어 이하, kebab-case, 예: implement-user-auth)"),
        child_job_title: z
          .string()
          .describe(
            "하위 작업의 고유 식별자 (필수, 영문 10단어 이하, kebab-case, 예: create-database-schema)"
          ),
        child_goal: z.string().describe("하위 작업의 목표 (필수)"),
        requirements: z.string().optional().describe("요구사항 (선택)"),
        constraints: z.string().optional().describe("제약조건 (선택)"),
        acceptance_criteria: z.string().optional().describe("완료 기준 (선택)"),
      },
    },
    async (args) => {
      try {
        const {
          parent_job_title,
          child_job_title,
          child_goal,
          requirements,
          constraints,
          acceptance_criteria,
        } = args;

        // parent_job_title 검증
        const parentValidation = validateJobTitle(parent_job_title);
        if (!parentValidation.isValid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: parent_job_title이 유효하지 않습니다. ${parentValidation.error}`,
              },
            ],
            isError: true,
          };
        }

        // child_job_title 검증
        const childValidation = validateJobTitle(child_job_title);
        if (!childValidation.isValid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: child_job_title이 유효하지 않습니다. ${childValidation.error}`,
              },
            ],
            isError: true,
          };
        }

        // child_goal 검증
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

        // root job title 추출 (parent_job_title이 root job title임)
        const rootJobTitle = parent_job_title;

        // 부모 job 읽기
        let parentJobRelation: JobRelation;
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

        // 부모 job 찾기 (트리에서)
        const targetParent = findJobInTree(parentJobRelation, parent_job_title);

        if (!targetParent) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: 부모 job "${parent_job_title}"을(를) 찾을 수 없습니다.`,
              },
            ],
            isError: true,
          };
        }

        // 중복 확인
        const duplicate = findJobInTree(parentJobRelation, child_job_title);
        if (duplicate) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: child job title "${child_job_title}"이(가) 이미 존재합니다.`,
              },
            ],
            isError: true,
          };
        }

        // child job 생성
        const specPath = `.dnc/${rootJobTitle}/specs/${child_job_title}.md`;
        const childJob: JobRelation = {
          job_title: child_job_title,
          goal: child_goal,
          spec: specPath,
          status: "pending",
          divided_jobs: [],
        };

        // 부모 job의 divided_jobs에 추가
        targetParent.divided_jobs.push(childJob);

        // 업데이트된 root job 저장
        await writeJobRelation(rootJobTitle, parentJobRelation);

        // spec 파일 생성
        await writeSpecFile(
          rootJobTitle,
          child_job_title,
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

📋 Child Job Title: ${child_job_title}
🎯 Goal: ${child_goal}
👨‍👩‍👧 Parent: ${parent_job_title}
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
