import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { findTaskInTree, validateTaskId } from "../utils/dnc-utils.js";
import type { IDncTaskRepository, Task } from "../repositories/index.js";

export function registerDncAppendDividedTaskTool(
  mcpServer: McpServer,
  repository: IDncTaskRepository
) {
  mcpServer.registerTool(
    "dnc_append_divided_task",
    {
      description: "부모 task의 tasks 목록에 하위 작업을 추가합니다.",
      inputSchema: {
        root_task_id: z
          .string()
          .describe("Root task의 task title (필수, 영문 10단어 이하, kebab-case, 예: my-project)"),
        parent_task_id: z
          .string()
          .describe(
            "하위 작업을 추가할 부모 task의 task title (필수, 영문 10단어 이하, kebab-case, 예: setup-database)"
          ),
        child_task_title: z
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
        const { root_task_id, parent_task_id, child_task_title, child_goal, acceptance } = args;

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

        // child_task_title 검증
        const childValidation = validateTaskId(child_task_title);
        if (!childValidation.isValid) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: child_task_title이 유효하지 않습니다. ${childValidation.error}`,
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
        if (!(await repository.rootTaskExists(root_task_id))) {
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
        const rootTask = await repository.findRootTask(root_task_id);

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
        const existingChild = findTaskInTree(parentTask, child_task_title);
        if (existingChild) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: child_task_title "${child_task_title}"이(가) 이미 존재합니다.`,
              },
            ],
            isError: true,
          };
        }

        // Child task 생성
        const childTask: Task = {
          id: child_task_title,
          goal: child_goal,
          acceptance: acceptance,
          status: "init",
          tasks: [],
        };

        // 부모 task에 추가
        parentTask.tasks.push(childTask);

        // Root task 저장
        await repository.saveRootTask(root_task_id, rootTask);

        return {
          content: [
            {
              type: "text" as const,
              text: `하위 작업이 성공적으로 추가되었습니다!\n\n📋 Root Task: ${root_task_id}\n📋 Parent Task: ${parent_task_id}\n  ↳ 📋 Child Task: ${child_task_title}\n  🎯 Goal: ${child_goal}\n  ✅ Acceptance: ${acceptance}\n\n다음 단계: 필요시 dnc_append_divided_task로 추가 하위 작업을 분할하거나, dnc_update_task로 상태를 업데이트하세요.`,
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
