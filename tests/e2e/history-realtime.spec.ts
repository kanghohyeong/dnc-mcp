import { test, expect } from "@playwright/test";
import { HelloWorldWebServer } from "../../src/services/web-server.js";
import { HistoryService } from "../../src/services/history-service.js";

let webServer: HelloWorldWebServer;
let baseURL: string;

test.beforeAll(async () => {
  // 웹 서버 시작
  webServer = new HelloWorldWebServer({ autoOpenBrowser: false });
  await webServer.start();
  baseURL = `http://localhost:${webServer.getPort()}`;
});

test.afterAll(async () => {
  await webServer.stop();
});

test.beforeEach(() => {
  // 히스토리 초기화
  HistoryService.getInstance().clearHistory();
});

test.describe("E2E: HistoryService → SSE → UI 실시간 업데이트", () => {
  test("히스토리 추가 시 즉시 UI에 반영되어야 함", async ({ page }) => {
    // 1. 히스토리 페이지 열기
    await page.goto(`${baseURL}/history`);

    // 2. 초기 상태: 빈 상태 확인
    await expect(page.locator(".empty-row")).toBeVisible();

    // 3. 히스토리 추가
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [
          {
            type: "text",
            text: "현재 한국 표준시 (KST, UTC+9):\n2026. 02. 07. 12:00:00",
          },
        ],
      }
    );

    // 4. SSE를 통해 UI가 실시간으로 업데이트되어야 함
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".empty-row")).not.toBeVisible();

    // 5. 데이터 내용 검증
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toContainText("2026. 02. 07. 12:00:00");
    await expect(firstRow.locator("pre")).toBeVisible();
  });

  test("여러 번 히스토리 추가 시 모두 UI에 반영되어야 함", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    // SSE 연결이 완전히 설정될 때까지 대기
    await page.waitForTimeout(500);

    // 첫 번째 추가
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "First call" }],
      }
    );

    await expect(page.locator("tbody tr")).toHaveCount(1, { timeout: 5000 });

    // 두 번째 추가
    await page.waitForTimeout(100);
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Second call" }],
      }
    );

    await expect(page.locator("tbody tr")).toHaveCount(2, { timeout: 5000 });

    // 세 번째 추가
    await page.waitForTimeout(100);
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Third call" }],
      }
    );

    await expect(page.locator("tbody tr")).toHaveCount(3, { timeout: 5000 });
  });

  test("페이지 새로고침 후에도 기존 히스토리가 표시되어야 함", async ({ page }) => {
    // 1. 먼저 히스토리 생성
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "First entry" }],
      }
    );

    // 2. 페이지 열기 (초기 로드)
    await page.goto(`${baseURL}/history`);

    // 3. 서버에서 렌더링된 히스토리 확인
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator(".empty-row")).not.toBeVisible();

    // 4. 새 히스토리 추가 (SSE로 업데이트)
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Second entry" }],
      }
    );

    await expect(page.locator("tbody tr")).toHaveCount(2, { timeout: 3000 });

    // 5. 페이지 새로고침
    await page.reload();

    // 6. 새로고침 후에도 모든 히스토리가 표시되어야 함
    await expect(page.locator("tbody tr")).toHaveCount(2);
  });

  test("SSE 연결이 끊겼다가 재연결되어도 정상 작동해야 함", async ({ page }) => {
    // 1. 페이지 열기
    await page.goto(`${baseURL}/history`);

    // 2. 첫 번째 히스토리 추가 (SSE 정상)
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Before reload" }],
      }
    );

    await expect(page.locator("tbody tr")).toHaveCount(1, { timeout: 3000 });

    // 3. 페이지 새로고침 (SSE 재연결)
    await page.reload();

    // 4. 재연결 후에도 새 히스토리가 실시간으로 추가되어야 함
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "After reload" }],
      }
    );

    await expect(page.locator("tbody tr")).toHaveCount(2, { timeout: 3000 });
  });

  test("UUID 일부가 ID 컬럼에 표시되어야 함", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Test entry" }],
      }
    );

    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 3000 });

    const firstRow = page.locator("tbody tr").first();
    const idCell = firstRow.locator("td").first();
    const idText = await idCell.textContent();

    // UUID의 첫 8자만 표시되어야 함
    expect(idText).toHaveLength(8);
    expect(idText).toMatch(/^[0-9a-f]{8}$/i);
  });

  test("타임스탬프가 KST 형식으로 표시되어야 함", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Test entry" }],
      }
    );

    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 3000 });

    const firstRow = page.locator("tbody tr").first();
    const timestampCell = firstRow.locator("td").nth(1);
    const timestampText = await timestampCell.textContent();

    // "YYYY. MM. DD. HH:MM:SS" 형식 검증
    expect(timestampText).toMatch(/^\d{4}\. \d{2}\. \d{2}\. \d{2}:\d{2}:\d{2}$/);
  });
});
