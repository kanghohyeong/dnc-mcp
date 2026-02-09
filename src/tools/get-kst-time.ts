import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * KST 시간 조회 도구 등록
 *
 * 현재 시간을 한국 표준시(KST, UTC+9)로 반환합니다.
 * 디버깅 및 MCP 서버 동작 확인 용도로 사용됩니다.
 */
export function registerGetKstTimeTool(mcpServer: McpServer) {
  mcpServer.registerTool(
    "get_kst_time",
    {
      description: "현재 시간을 한국 표준시(KST, UTC+9)로 반환하는 디버깅 도구입니다.",
      inputSchema: {}, // 파라미터 없음
    },
    () => {
      try {
        // 현재 시간 가져오기
        const now = new Date();

        // Date 객체 유효성 검증
        if (isNaN(now.getTime())) {
          throw new Error("시스템 시계에서 유효한 시간을 가져올 수 없습니다.");
        }

        // 사람이 읽기 쉬운 KST 형식
        const kstTimeString = now.toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        // ISO 8601 형식 (프로그래밍 용도)
        const kstISOString = now.toLocaleString("sv-SE", {
          timeZone: "Asia/Seoul",
        });

        const result = {
          content: [
            {
              type: "text" as const,
              text: `현재 한국 표준시 (KST, UTC+9):
${kstTimeString}

ISO 8601 형식: ${kstISOString}
Unix Timestamp: ${now.getTime()}
UTC Time: ${now.toISOString()}`,
            },
          ],
        };

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        const errorResult = {
          content: [
            {
              type: "text" as const,
              text: `KST 시간을 가져오는 중 오류가 발생했습니다: ${errorMessage}`,
            },
          ],
          isError: true,
        };

        return errorResult;
      }
    }
  );
}
