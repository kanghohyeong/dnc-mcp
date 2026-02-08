import type { Page } from "@playwright/test";

// 브라우저 컨텍스트의 window 타입 확장
declare global {
  interface Window {
    sseReady?: boolean;
  }
}

/**
 * SSE 연결이 수립될 때까지 대기
 * history.ejs 페이지의 window.sseReady 플래그를 폴링
 *
 * @param page - Playwright Page 객체
 * @param timeout - 최대 대기 시간 (ms, 기본값: 5000)
 * @throws SSE 연결이 timeout 내에 수립되지 않으면 에러
 */
export async function waitForSseConnection(
  page: Page,
  timeout = 5000
): Promise<void> {
  try {
    // 스크립트가 로드되고 window.sseReady가 true가 될 때까지 대기
    // 문자열로 전달하여 ESLint 타입 체크 우회
    await page.waitForFunction(
      'typeof window.sseReady !== "undefined" && window.sseReady === true',
      { timeout, polling: 100 } // 100ms 간격으로 폴링
    );
  } catch (error) {
    // 디버깅을 위해 현재 window.sseReady 값을 확인
    const sseReadyValue = await page.evaluate(
      '({ sseReady: window.sseReady, hasProp: "sseReady" in window })'
    );
    throw new Error(
      `SSE connection not established within ${timeout}ms. ` +
      `window.sseReady = ${JSON.stringify(sseReadyValue)}`
    );
  }
}
