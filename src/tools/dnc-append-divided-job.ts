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
        root_task_id: z
          .string()
          .describe("Root task의 job title (필수, 영문 10단어 이하, kebab-case, 예: my-project)"),
        parent_task_id: z
          .string()
          .describe(
            "하위 작업을 추가할 부모 task의 job title (필수, 영문 10단어 이하, kebab-case, 예: setup-database)"
          ),
        child_job_title: z
          .string()
          .describe(
            "하위 작업의 고유 식별자 (필수, 영문 10단어 이하, kebab-case, 예: create-tables)"
          ),
        child_goal: z.string().describe("하위 작업의 목표 (필수)"),
        acceptance: z.string().describe("완료 기준 (필수)"),
      },
    },
    async (args) => {
      try {
        const { root_task_id, parent_task_id, child_job_title, child_goal, acceptance } = args;

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

        // parent_task_id 검증
        const parentValidation = validateTaskId(parent_task_id);
        if (!parentValidation.isValid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: parent_task_id가 유효하지 않습니다. ${parentValidation.error}`,
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

        // Root task 존재 확인
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

        // Root task 읽기
        const rootTask = await readTask(root_task_id);

        // 부모 task 찾기
        const parentTask = findTaskInTree(rootTask, parent_task_id);
        if (!parentTask) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: Parent task "${parent_task_id}"를 트리에서 찾을 수 없습니다.`,
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
          status: "init",
          tasks: [],
        };

        // 부모 task에 추가
        parentTask.tasks.push(childTask);

        // Root task 저장
        await writeTask(root_task_id, rootTask);

        return {
          content: [
            {
              type: "text" as const,
              text: `하위 작업이 성공적으로 추가되었습니다!

📋 Root Task: ${root_task_id}
📋 Parent Task: ${parent_task_id}
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
