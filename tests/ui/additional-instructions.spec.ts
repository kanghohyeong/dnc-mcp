import { test, expect } from "@playwright/test";
import { UIWebServer } from "../../src/services/web-server.js";
import fs from "fs/promises";
import path from "path";

test.describe.serial("추가 지침 UI 렌더링", () => {
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

  test.beforeEach(async (_testInfo) => {
    testJobId = `test-additional-${Date.now()}`;
    testJobDir = path.join(dncDir, testJobId);
    await fs.mkdir(testJobDir, { recursive: true });
  });

  test.afterEach(async () => {
    await fs.rm(testJobDir, { recursive: true, force: true });
  });

  test("각 task 카드에 추가 지침 textarea가 렌더링된다", async ({ page }) => {
    const testTask = {
      id: testJobId,
      goal: "Test goal",
      acceptance: "Test acceptance",
      status: "init",
      tasks: [
        {
          id: "child-task",
          goal: "Child goal",
          acceptance: "Child acceptance",
          status: "init",
          tasks: [],
        },
      ],
    };
    await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(testTask, null, 2));

    await page.goto(`${baseUrl}/${testJobId}`);
    await page.waitForSelector(".task-item");

    // 루트 task textarea 확인
    const rootTextarea = page.locator(
      `.additional-instructions-textarea[data-task-id="${testJobId}"]`
    );
    await expect(rootTextarea).toBeVisible();

    // 서브태스크 textarea 확인
    const childTextarea = page.locator(
      '.additional-instructions-textarea[data-task-id="child-task"]'
    );
    await expect(childTextarea).toBeVisible();
  });

  test("'추가 지침' 레이블이 표시된다", async ({ page }) => {
    const testTask = {
      id: testJobId,
      goal: "Test goal",
      acceptance: "Test acceptance",
      status: "init",
      tasks: [],
    };
    await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(testTask, null, 2));

    await page.goto(`${baseUrl}/${testJobId}`);
    await page.waitForSelector(".task-item");

    const labels = page.locator(".section-label", { hasText: "추가 지침" });
    await expect(labels.first()).toBeVisible();
  });

  test("기존 additionalInstructions 값이 textarea에 표시된다", async ({ page }) => {
    const testTask = {
      id: testJobId,
      goal: "Test goal",
      acceptance: "Test acceptance",
      status: "init",
      additionalInstructions: "기존 지침 내용입니다",
      tasks: [],
    };
    await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(testTask, null, 2));

    await page.goto(`${baseUrl}/${testJobId}`);
    await page.waitForSelector(".task-item");

    const textarea = page.locator(`.additional-instructions-textarea[data-task-id="${testJobId}"]`);
    await expect(textarea).toHaveValue("기존 지침 내용입니다");
  });

  test("textarea에 data-task-id와 data-root-task-id가 올바르게 설정된다", async ({ page }) => {
    const testTask = {
      id: testJobId,
      goal: "Test goal",
      acceptance: "Test acceptance",
      status: "init",
      tasks: [
        {
          id: "child-task",
          goal: "Child goal",
          acceptance: "Child acceptance",
          status: "init",
          tasks: [],
        },
      ],
    };
    await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(testTask, null, 2));

    await page.goto(`${baseUrl}/${testJobId}`);
    await page.waitForSelector(".task-item");

    const childTextarea = page.locator(
      '.additional-instructions-textarea[data-task-id="child-task"]'
    );
    await expect(childTextarea).toHaveAttribute("data-root-task-id", testJobId);
  });
});
