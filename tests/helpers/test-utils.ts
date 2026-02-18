import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { vi } from "vitest";
import { UIWebServer } from "../../src/services/web-server.js";
import { DncTaskService } from "../../src/services/dnc-task-service.js";

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
  dncJobService?: DncTaskService;
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

/**
 * 3-level 계층 구조를 가진 테스트 Task 생성
 * Root → 2 children → 1 grandchild 구조
 * @returns 계층 구조를 가진 Task
 */
export function createTestTaskWithHierarchy() {
  return {
    id: "root-task",
    goal: "Root task goal",
    acceptance: "# Root Acceptance\n\nThis is **root** acceptance criteria.",
    status: "in-progress" as const,
    tasks: [
      {
        id: "child-1",
        goal: "Child 1 goal",
        acceptance: "## Child 1 Acceptance\n\nFirst child task.",
        status: "done" as const,
        tasks: [
          {
            id: "grandchild-1",
            goal: "Grandchild goal",
            acceptance: "### Grandchild Acceptance\n\nNested task.",
            status: "pending" as const,
            tasks: [],
          },
        ],
      },
      {
        id: "child-2",
        goal: "Child 2 goal",
        acceptance: "## Child 2 Acceptance\n\nSecond child task.",
        status: "in-progress" as const,
        tasks: [],
      },
    ],
  };
}
