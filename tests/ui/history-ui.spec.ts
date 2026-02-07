import { test, expect } from "@playwright/test";
import { HelloWorldWebServer } from "../../src/services/web-server.js";
import { HistoryService } from "../../src/services/history-service.js";

let webServer: HelloWorldWebServer;
let baseURL: string;

test.beforeAll(async () => {
  // 모든 테스트 시작 전 서버 시작
  webServer = new HelloWorldWebServer();
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
  test("페이지 제목과 기본 UI가 표시되어야 함", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    // 페이지 제목 확인
    await expect(page).toHaveTitle("get-kst-time 호출 히스토리");

    // 헤더 확인
    await expect(page.locator("h1")).toHaveText("get-kst-time 호출 히스토리");

    // 테이블 헤더 확인
    await expect(page.locator("thead th").nth(0)).toHaveText("ID");
    await expect(page.locator("thead th").nth(1)).toHaveText("호출 시각 (KST)");
    await expect(page.locator("thead th").nth(2)).toHaveText("응답 결과");
  });

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
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 2000 });
    await expect(page.locator(".empty-row")).not.toBeVisible();

    // 내용 확인
    await expect(page.locator("tbody tr").first()).toContainText("Test KST Time");
  });

  test("여러 히스토리를 순서대로 표시해야 함 (최신순)", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    // 첫 번째 히스토리 추가
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "First Entry" }],
      }
    );

    // SSE 이벤트 전달 대기
    await expect(page.locator("tbody tr")).toHaveCount(1, { timeout: 3000 });

    // 두 번째 히스토리 추가
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "Second Entry" }],
      }
    );

    // SSE 이벤트 전달 대기
    await expect(page.locator("tbody tr")).toHaveCount(2, { timeout: 3000 });

    // 최신 항목이 맨 위에 있어야 함
    await expect(page.locator("tbody tr").first()).toContainText("Second Entry");
    await expect(page.locator("tbody tr").nth(1)).toContainText("First Entry");
  });

  test("다른 도구의 히스토리는 표시하지 않아야 함", async ({ page }) => {
    // 먼저 히스토리를 추가한 후 페이지 로드
    HistoryService.getInstance().addHistory(
      "get_kst_time",
      {},
      {
        content: [{ type: "text", text: "KST Time" }],
      }
    );

    await page.goto(`${baseURL}/history`);
    await expect(page.locator("tbody tr")).toHaveCount(1);

    // 다른 도구 히스토리 추가 (SSE로 전송되지만 UI에는 표시되지 않아야 함)
    HistoryService.getInstance().addHistory(
      "other_tool",
      {},
      {
        content: [{ type: "text", text: "Other Tool Result" }],
      }
    );

    // 여전히 1개만 표시되어야 함 (SSE 필터링 확인)
    await page.waitForTimeout(1000);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText("KST Time");
  });

  test("CSS 스타일이 올바르게 적용되어야 함", async ({ page }) => {
    await page.goto(`${baseURL}/history`);

    // 그라디언트 배경 확인
    const body = page.locator("body");
    const backgroundColor = await body.evaluate((el) => {
      return window.getComputedStyle(el).background;
    });
    expect(backgroundColor).toContain("linear-gradient");

    // 테이블 스타일 확인
    const table = page.locator("#history-table");
    await expect(table).toBeVisible();

    // 흰색 배경 확인
    const tableBackground = await table.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(tableBackground).toContain("rgb(255, 255, 255)");
  });

  test("JSON 응답이 pre 태그로 포맷되어야 함", async ({ page }) => {
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

    await page.goto(`${baseURL}/history`);

    // pre 태그 확인
    const preTag = page.locator("tbody tr td pre").first();
    await expect(preTag).toBeVisible();

    // JSON 포맷 확인
    const preText = await preTag.textContent();
    expect(preText).toContain('"content"');
    expect(preText).toContain('"type"');
  });
});
