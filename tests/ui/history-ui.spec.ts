import { test, expect } from "@playwright/test";
import { UIWebServer } from "../../src/services/web-server.js";
import { HistoryService } from "../../src/services/history-service.js";
import { waitForSseConnection } from "../helpers/playwright-utils.js";

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

test.beforeEach(() => {
  // 각 테스트 전 히스토리 초기화
  HistoryService.getInstance().clearHistory();
});

test.describe("History UI", () => {
  test("히스토리가 없을 때 안내 메시지를 표시해야 함", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    // 빈 상태 메시지 확인
    const emptyRow = page.locator(".empty-row");
    await expect(emptyRow).toBeVisible();
    await expect(emptyRow).toHaveText("아직 호출 히스토리가 없습니다.");
  });

  test("초기 히스토리 데이터를 렌더링해야 함", async ({ page }) => {
    // 히스토리 추가
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "현재 한국 표준시 (KST, UTC+9):\n2026. 02. 07. 12:00:00" }],
      }
    );

    await page.goto(`${baseURL}/history`);

    // SSE 연결 대기 (방어적 체크)
    await waitForSseConnection(page);

    // 빈 상태 메시지가 없어야 함
    await expect(page.locator(".empty-row")).not.toBeVisible();

    // 데이터 행이 있어야 함
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);

    // 타임스탬프가 표시되어야 함
    await expect(rows.first()).toContainText("2026. 02. 07.");
  });

  test("실시간으로 새 히스토리가 추가되어야 함", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    // SSE 연결 대기
    await waitForSseConnection(page);

    // 초기 상태: 빈 상태
    await expect(page.locator(".empty-row")).toBeVisible();

    // 새 히스토리 추가
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Test KST Time" }],
      }
    );

    // SSE로 실시간 업데이트되어야 함
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 1000 });
    await expect(page.locator(".empty-row")).not.toBeVisible();

    // 내용 확인
    await expect(page.locator("tbody tr").first()).toContainText("Test KST Time");
  });

  test("여러 히스토리를 순서대로 표시해야 함 (최신순)", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    // SSE 연결 대기
    await waitForSseConnection(page);

    // 첫 번째 히스토리 추가
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "First Entry" }],
      }
    );

    // SSE 이벤트 전달 대기
    await expect(page.locator("tbody tr")).toHaveCount(1, { timeout: 1000 });

    // 두 번째 히스토리 추가
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Second Entry" }],
      }
    );

    // SSE 이벤트 전달 대기
    await expect(page.locator("tbody tr")).toHaveCount(2, { timeout: 1000 });

    // 최신 항목이 맨 위에 있어야 함
    await expect(page.locator("tbody tr").first()).toContainText("Second Entry");
    await expect(page.locator("tbody tr").nth(1)).toContainText("First Entry");
  });
});
