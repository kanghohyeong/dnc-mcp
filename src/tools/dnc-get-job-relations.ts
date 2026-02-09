import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { readJobRelation } from "../utils/dnc-utils.js";

export function registerDncGetJobRelationsTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "dnc_get_job_relations",
    {
      description: "job의 분할 관계(트리 구조)를 조회합니다.",
      inputSchema: {
        job_title: z.string().describe("조회할 job title (필수)"),
      },
    },
    async (args) => {
      try {
        const { job_title } = args;

        // 인자 검증
        if (!job_title) {
          return {
            content: [
              {
                type: "text" as const,
                text: "오류: job_title는 필수 입력 항목입니다.",
              },
            ],
            isError: true,
          };
        }

        // job relation 읽기
        let jobRelation;
        try {
          jobRelation = await readJobRelation(job_title);
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `오류: job "${job_title}"이(가) 존재하지 않습니다. ${error instanceof Error ? error.message : ""}`,
              },
            ],
            isError: true,
          };
        }

        // JSON 포맷팅
        const jsonString = JSON.stringify(jobRelation, null, 2);

        return {
          content: [
            {
              type: "text" as const,
              text: `Job 관계 정보:

\`\`\`json
${jsonString}
\`\`\`

📋 Job Title: ${jobRelation.job_title}
🎯 Goal: ${jobRelation.goal}
📊 Status: ${jobRelation.status}
👥 Divided Jobs: ${jobRelation.divided_jobs.length}개`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Job 관계 조회 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
