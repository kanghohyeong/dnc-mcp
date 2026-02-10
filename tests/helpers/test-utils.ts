import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vi } from "vitest";
import { UIWebServer } from "../../src/services/web-server.js";
import { DncJobService } from "../../src/services/dnc-job-service.js";

/**
 * MCP 서버 테스트 인스턴스 생성
 */
export function createTestMcpServer() {
  return new McpServer({
    name: "test-server",
    version: "1.0.0",
  });
}

export interface TestWebServerOptions {
  dncJobService?: DncJobService;
}

/**
 * 웹 서버 테스트 인스턴스 생성 및 시작
 */
export async function createTestWebServer(options?: TestWebServerOptions) {
  const server = new UIWebServer({
    autoOpenBrowser: false,
    dncJobService: options?.dncJobService,
  });
  await server.start();
  return server;
}

/**
 * Date 모킹 헬퍼 - KST 시간 설정
 * @param isoString - UTC ISO 문자열 (예: '2026-02-07T03:00:00Z')
 */
export function mockKstTime(isoString: string) {
  vi.setSystemTime(new Date(isoString));
}

/**
 * open 패키지 모킹 헬퍼
 */
export function mockOpenPackage() {
  return vi.fn().mockResolvedValue(undefined);
}

/**
 * 비동기 함수 타임아웃 헬퍼
 * @param ms - 대기 시간 (밀리초)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 서버가 준비될 때까지 대기
 * @param server - 웹 서버 인스턴스
 * @param maxAttempts - 최대 재시도 횟수
 */
export async function waitForServer(server: UIWebServer, maxAttempts = 10): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (server.getIsRunning()) {
      return;
    }
    await sleep(100);
  }
  throw new Error("Server did not start in time");
}
