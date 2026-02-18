import { test, expect } from "@playwright/test";
import { UIWebServer } from "../../src/services/web-server.js";
import fs from "fs/promises";
import path from "path";
import type { Task } from "../../src/repositories/index.js";

test.describe.serial("추가 지침 저장 플로우", () => {
  const dncDir = path.join(process.cwd(), ".dnc");
  let testJobId: string;
  let testJobDir: string;
  let webServer: UIWebServer;
  let baseUrl: string;

  test.beforeAll(async () => {
    webServer = new UIWebServer({ autoOpenBrowser: false });
    await webServer.start();
    const port = webServer.getPort();
    baseUrl = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    await webServer.stop();
  });

  test.beforeEach(async () => {
    testJobId = `test-flow-${Date.now()}`;
    testJobDir = path.join(dncDir, testJobId);
    await fs.mkdir(testJobDir, { recursive: true });

    const testTask: Task = {
      id: testJobId,
      goal: "Test job for additional instructions",
      acceptance: "Test acceptance criteria",
      status: "init",
      tasks: [],
    };
    await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(testTask, null, 2));
  });

  test.afterEach(async () => {
    await fs.rm(testJobDir, { recursive: true, force: true });
  });

  test("textarea에 텍스트 입력 시 저장 버튼이 활성화된다", async ({ page }) => {
    await page.goto(`${baseUrl}/${testJobId}`);
    await page.waitForSelector(".task-item");

    const submitButton = page.locator("#submitStatusChanges");
    await expect(submitButton).toBeDisabled();

    const textarea = page.locator(`.additional-instructions-textarea[data-task-id="${testJobId}"]`);
    await textarea.fill("새로운 추가 지침");

    await expect(submitButton).toBeEnabled();
  });

  test("원본 값으로 되돌리면 저장 버튼이 비활성화된다", async ({ page }) => {
    await page.goto(`${baseUrl}/${testJobId}`);
    await page.waitForSelector(".task-item");

    const submitButton = page.locator("#submitStatusChanges");
    const textarea = page.locator(`.additional-instructions-textarea[data-task-id="${testJobId}"]`);

    await textarea.fill("임시 내용");
    await expect(submitButton).toBeEnabled();

    await textarea.fill("");
    await expect(submitButton).toBeDisabled();
  });

  test("저장 버튼 클릭 시 추가 지침이 서버에 저장되고 toast가 표시된다", async ({ page }) => {
    await page.goto(`${baseUrl}/${testJobId}`);
    await page.waitForSelector(".task-item");

    const textarea = page.locator(`.additional-instructions-textarea[data-task-id="${testJobId}"]`);
    await textarea.fill("저장 테스트 지침");

    const submitButton = page.locator("#submitStatusChanges");

    // API 응답을 기다리면서 저장 버튼 클릭
    const [response] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/tasks/batch-update")),
      submitButton.click(),
    ]);

    const responseBody = (await response.json()) as { success?: boolean; error?: string };
    expect(
      response.status(),
      `API error: ${responseBody.error ?? JSON.stringify(responseBody)}`
    ).toBe(200);
    expect(responseBody.success).toBe(true);

    // toast 메시지 확인
    await expect(page.locator(".toast-success")).toBeVisible({ timeout: 5000 });

    // 파일 시스템 검증
    const taskContent = JSON.parse(
      await fs.readFile(path.join(testJobDir, "task.json"), "utf-8")
    ) as Task;
    expect(taskContent.additionalInstructions).toBe("저장 테스트 지침");
  });

  test("저장 후 새로고침해도 추가 지침 값이 유지된다", async ({ page }) => {
    await page.goto(`${baseUrl}/${testJobId}`);
    await page.waitForSelector(".task-item");

    const textarea = page.locator(`.additional-instructions-textarea[data-task-id="${testJobId}"]`);
    await textarea.fill("새로고침 후 유지 확인");

    const submitButton = page.locator("#submitStatusChanges");

    const [response] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/tasks/batch-update")),
      submitButton.click(),
    ]);
    expect(response.status()).toBe(200);

    // 페이지 새로고침
    await page.reload();
    await page.waitForSelector(".task-item");

    const reloadedTextarea = page.locator(
      `.additional-instructions-textarea[data-task-id="${testJobId}"]`
    );
    await expect(reloadedTextarea).toHaveValue("새로고침 후 유지 확인");
  });
});
