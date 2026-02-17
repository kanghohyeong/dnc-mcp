import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { validateTaskId } from "../utils/dnc-utils.js";
import type { IDncTaskRepository, Task } from "../repositories/index.js";

export function registerDncInitJobTool(mcpServer: McpServer, repository: IDncTaskRepository) {
  mcpServer.registerTool(
    "dnc_init_job",
    {
      description: "DnC 워크플로우의 최상위 작업(root task)을 생성합니다.",
      inputSchema: {
        job_title: z
          .string()
          .describe(
            "작업의 고유 식별자 (필수, 영문 10단어 이하, kebab-case, 예: implement-user-auth)"
          ),
        goal: z.string().describe("작업의 목표 (필수)"),
        acceptance: z.string().describe("완료 기준 (필수)"),
      },
    },
    async (args) => {
      try {
        const { job_title, goal, acceptance } = args;

        // job_title 검증
        const validation = validateTaskId(job_title);
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

        // 중복 확인
        if (await repository.rootTaskExists(job_title)) {
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

        // task 데이터 생성
        const task: Task = {
          id: job_title,
          goal: goal,
          acceptance: acceptance,
          status: "init",
          tasks: [],
        };

        // task 파일 저장 (디렉토리 생성 포함)
        await repository.saveRootTask(job_title, task);

        return {
          content: [
            {
              type: "text" as const,
              text: `Root task가 성공적으로 생성되었습니다!\n\n📋 Task ID: ${job_title}\n🎯 Goal: ${goal}\n✅ Acceptance: ${acceptance}\n📄 Task File: .dnc/${job_title}/task.json\n\n다음 단계: dnc_append_divided_job 명령으로 하위 작업을 분할하세요.`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Root task 생성 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
