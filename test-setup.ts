import { afterEach, beforeAll, vi } from 'vitest';

// MCP 서버가 STDIO를 사용하므로 console.error 억제
beforeAll(() => {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    // MCP 관련 에러 메시지는 억제
    const message = String(args[0]);
    if (
      message.includes('MCP') ||
      message.includes('STDIO') ||
      message.includes('stderr')
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});

// 각 테스트 후 mock 자동 정리
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
