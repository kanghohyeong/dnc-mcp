import type { Page } from "@playwright/test";
import fs from "fs/promises";

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
export async function waitForSseConnection(page: Page, timeout = 5000): Promise<void> {
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

/**
 * 파일이 실제로 파일 시스템에 존재하는지 확인하고 대기합니다.
 * Playwright UI 테스트에서 파일 생성 후 서버가 파일을 인식할 때까지 대기하는 용도로 사용합니다.
 *
 * @param filePaths - 확인할 파일 경로 배열 (절대 경로)
 * @param options - 대기 옵션
 * @param options.timeout - 최대 대기 시간 (ms, 기본값: 3000)
 * @param options.interval - 재시도 간격 (ms, 기본값: 50)
 * @throws 파일이 timeout 내에 존재하지 않으면 에러
 */
export async function waitForFilesExist(
  filePaths: string[],
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 3000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // 모든 파일이 존재하는지 병렬로 확인
      await Promise.all(filePaths.map((filePath) => fs.access(filePath, fs.constants.F_OK)));

      // 모든 파일이 존재하면 성공
      // 파일 시스템이 완전히 동기화되고 서버가 디렉토리를 다시 읽을 수 있도록 대기
      await new Promise((resolve) => setTimeout(resolve, 200));
      return;
    } catch (error) {
      // 파일이 아직 없으면 대기 후 재시도
      if (Date.now() + interval < startTime + timeout) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      } else {
        // 타임아웃 시 에러 throw
        const notFoundFiles: string[] = [];
        for (const filePath of filePaths) {
          try {
            await fs.access(filePath, fs.constants.F_OK);
          } catch {
            notFoundFiles.push(filePath);
          }
        }
        throw new Error(`Files not found within ${timeout}ms: ${notFoundFiles.join(", ")}`);
      }
    }
  }
}
