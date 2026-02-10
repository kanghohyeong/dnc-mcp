import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  readTask,
  writeTask,
  findTaskInTree,
  validateTaskId,
  taskExists,
  type Task,
} from "../utils/dnc-utils.js";

export function registerDncAppendDividedJobTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_append_divided_job",
    {
      description: "부모 task의 tasks 목록에 하위 작업을 추가합니다.",
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
        acceptance: z.string().describe("완료 기준 (필수)"),
      },
    },
    async (args) => {
      try {
        const { parent_job_title, child_job_title, child_goal, acceptance } = args;

        // parent_job_title 검증
        const parentValidation = validateTaskId(parent_job_title);
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
        const childValidation = validateTaskId(child_job_title);
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

        // acceptance 검증
        if (!acceptance || acceptance.trim() === "") {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: acceptance는 필수 입력 항목입니다.",
              },
            ],
            isError: true,
          };
        }

        // parent 존재 확인
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

        // 부모 task 찾기
        const parentTask = findTaskInTree(rootTask, parent_job_title);
        if (!parentTask) {
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

        // 중복 확인
        const existingChild = findTaskInTree(parentTask, child_job_title);
        if (existingChild) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: child_job_title "${child_job_title}"이(가) 이미 존재합니다.`,
              },
            ],
            isError: true,
          };
        }

        // Child task 생성
        const childTask: Task = {
          id: child_job_title,
          goal: child_goal,
          acceptance: acceptance,
          status: "pending",
          tasks: [],
        };

        // 부모 task에 추가
        parentTask.tasks.push(childTask);

        // Root task 저장
        await writeTask(parent_job_title, rootTask);

        return {
          content: [
            {
              type: "text" as const,
              text: `하위 작업이 성공적으로 추가되었습니다!

📋 Parent Task: ${parent_job_title}
  ↳ 📋 Child Task: ${child_job_title}
  🎯 Goal: ${child_goal}
  ✅ Acceptance: ${acceptance}

다음 단계: 필요시 dnc_append_divided_job로 추가 하위 작업을 분할하거나, dnc_update_job로 상태를 업데이트하세요.`,
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
