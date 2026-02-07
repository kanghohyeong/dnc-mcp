import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";

/**
 * 예제 도구 (참고용)
 *
 * 이 파일은 새로운 MCP 도구를 작성할 때 참고할 수 있는 예제입니다.
 * 실제로 등록되지 않으며, 도구 작성 패턴을 보여주기 위한 용도입니다.
 *
 * 새 도구를 만들 때:
 * 1. 이 파일을 복사하여 새 파일 생성
 * 2. 함수명, 도구명, 로직 수정
 * 3. src/index.ts에서 import 및 등록
 */
export function registerExampleTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "example_tool",
    {
      description: "An example tool that demonstrates MCP tool structure",
      inputSchema: {
        // Zod 스키마를 사용한 입력 검증
        message: z.string().describe("A message to process"),
        count: z.number().optional().describe("Optional count parameter"),
      },
    },
    (args) => {
      // 도구 로직 구현
      // args는 자동으로 타입 검증되고 타입 안전성이 보장됩니다

      const message = args.message;
      const count = args.count ?? 1;

      const result = Array(count).fill(message).join(", ");

      return {
        content: [
          {
            type: "text",
            text: `Tool executed with message: "${message}" (repeated ${count} time(s))\nResult: ${result}`,
          },
        ],
      };
    }
  );
}

/**
 * 에러 처리가 필요한 경우의 예제
 */
export function registerExampleToolWithErrorHandling(mcpServer: McpServer) {
  mcpServer.registerTool(
    "example_tool_with_error",
    {
      description: "An example tool with error handling",
      inputSchema: {
        value: z.number().describe("A number to process"),
      },
    },
    (args) => {
      try {
        // 도구 로직
        if (args.value < 0) {
          throw new Error("Value must be non-negative");
        }

        const result = Math.sqrt(args.value);

        return {
          content: [
            {
              type: "text",
              text: `Square root of ${args.value} is ${result}`,
            },
          ],
        };
      } catch (error) {
        // 에러 처리
        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
