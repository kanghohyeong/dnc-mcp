import { test, expect } from "@playwright/test";
import { UIWebServer } from "../../src/services/web-server.js";

let webServer: UIWebServer;
let baseURL: string;

test.beforeAll(async () => {
  // 모든 테스트 시작 전 서버 시작
  webServer = new UIWebServer({ autoOpenBrowser: false });
  await webServer.start();
  baseURL = `http://localhost:${webServer.getPort()}`;
});

test.afterAll(async () => {
  // 모든 테스트 후 서버 종료
  await webServer.stop();
});

test.describe("History Navigation", () => {
  test("메인 페이지에서 히스토리 버튼 클릭 시 히스토리 페이지로 이동하고 테이블이 렌더링되어야 함", async ({
    page,
  }) => {
    // 1. 메인 페이지 로드
    await page.goto(baseURL);

    // 2. 히스토리 버튼 존재 확인
    const historyButton = page.locator("#history-button");
    await expect(historyButton).toBeVisible();

    // 3. 버튼 클릭
    await historyButton.click();

    // 4. URL이 /history로 변경되었는지 확인
    await expect(page).toHaveURL(`${baseURL}/history`);

    // 5. 히스토리 페이지의 제목 확인
    await expect(page.locator("h1")).toHaveText("get-kst-time 호출 히스토리");

    // 6. 히스토리 테이블이 존재하는지 확인
    const historyTable = page.locator("#history-table");
    await expect(historyTable).toBeVisible();

    // 7. 테이블 헤더 확인
    const headers = page.locator("thead th");
    await expect(headers.nth(0)).toHaveText("ID");
    await expect(headers.nth(1)).toHaveText("호출 시각 (KST)");
    await expect(headers.nth(2)).toHaveText("응답 결과");
  });
});
