import open from "open";

/**
 * 시스템 기본 브라우저로 주어진 URL을 엽니다.
 *
 * @param url - 열고자 하는 URL
 * @throws URL이 유효하지 않거나 브라우저 열기에 실패한 경우 에러를 throw합니다.
 */
export async function openBrowser(url: string): Promise<void> {
  // URL 유효성 검증
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`);
  }

  try {
    await open(url);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to open browser: ${errorMessage}`);
  }
}
