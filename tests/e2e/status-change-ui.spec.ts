import { test, expect } from "@playwright/test";
import { UIWebServer } from "../../src/services/web-server.js";
import fs from "fs/promises";
import path from "path";

test.describe.serial("Status Change UI", () => {
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

  test.beforeEach(async ({ page: _page }, testInfo) => {
    testJobId = `test-job-${Date.now()}-${testInfo.testId}`;
    testJobDir = path.join(dncDir, testJobId);

    await fs.mkdir(testJobDir, { recursive: true });

    const testTask = {
      id: testJobId,
      goal: "Test job for status change",
      acceptance: "Test acceptance criteria",
      status: "init",
      tasks: [
        {
          id: "child-1",
          goal: "Child 1",
          acceptance: "Child 1 acceptance",
          status: "init",
          tasks: [],
        },
        {
          id: "child-2",
          goal: "Child 2",
          acceptance: "Child 2 acceptance",
          status: "accept",
          tasks: [],
        },
      ],
    };

    await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(testTask, null, 2));
  });

  test.afterEach(async () => {
    await fs.rm(testJobDir, { recursive: true, force: true });
  });

  test.describe("✅ UI 렌더링 테스트", () => {
    test("should display status radio group for each task", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      // Root task radio group
      const rootRadioGroup = page.locator(`[data-testid="status-radio-group-${testJobId}"]`);
      await expect(rootRadioGroup).toBeVisible();

      // Root task current status badge
      const rootBadge = page.locator(`[data-testid="current-status-${testJobId}"]`);
      await expect(rootBadge).toBeVisible();
      await expect(rootBadge).toHaveText("init");

      // Child 2 badge (accept 상태)
      const child2Badge = page.locator('[data-testid="current-status-child-2"]');
      await expect(child2Badge).toBeVisible();
      await expect(child2Badge).toHaveText("accept");
    });

    test("should display 4 selectable status radio buttons", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      const radioGroup = page.locator(`[data-testid="status-radio-group-${testJobId}"]`);
      await radioGroup.waitFor({ state: "visible" });

      // accept, delete, hold, split 4개 라디오 버튼 확인
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-accept"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-delete"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-hold"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-split"]`)).toBeVisible();
    });

    test("should check the matching radio when current status is selectable", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      // child-2는 accept 상태 → accept radio가 checked
      const child2AcceptRadio = page.locator('[data-testid="status-radio-child-2-accept"]');
      await expect(child2AcceptRadio).toBeChecked();
    });

    test("should display submit button at the bottom", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      await submitButton.waitFor({ state: "visible", timeout: 10000 });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toHaveText(/변경사항 저장|Save Changes/i);

      // 초기에는 비활성화
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe("🔄 상태 변경 및 추적 테스트", () => {
    test("should enable submit button when radio status changes", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      const acceptRadio = page.locator(`[data-testid="status-radio-${testJobId}-accept"]`);

      // 초기에는 비활성화
      await expect(submitButton).toBeDisabled();

      // 상태 변경
      await acceptRadio.click();

      // Submit 버튼 활성화
      await expect(submitButton).toBeEnabled();
    });

    test("should track multiple task changes", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      const rootHoldRadio = page.locator(`[data-testid="status-radio-${testJobId}-hold"]`);
      const child1DeleteRadio = page.locator('[data-testid="status-radio-child-1-delete"]');

      // 여러 task 상태 변경
      await rootHoldRadio.click();
      await child1DeleteRadio.click();

      // Submit 버튼 활성화
      await expect(submitButton).toBeEnabled();
    });

    test("should disable submit button when reverted to original state", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      // child-2는 accept 상태 → hold로 변경 후 다시 accept로
      const child2HoldRadio = page.locator('[data-testid="status-radio-child-2-hold"]');
      const child2AcceptRadio = page.locator('[data-testid="status-radio-child-2-accept"]');

      // 상태 변경
      await child2HoldRadio.click();
      await expect(submitButton).toBeEnabled();

      // 다시 원래 상태로
      await child2AcceptRadio.click();
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe("📡 API 호출 및 피드백 테스트", () => {
    test("should call API when submit button is clicked", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      const acceptRadio = page.locator(`[data-testid="status-radio-${testJobId}-accept"]`);
      const submitButton = page.locator('[data-testid="submit-status-changes"]');

      // 상태 변경
      await acceptRadio.click();

      // API 요청 감지
      const apiRequestPromise = page.waitForRequest(
        (request) =>
          request.url().includes("/api/tasks/batch-update") && request.method() === "POST"
      );

      // Submit 클릭
      await submitButton.click();

      // API 요청 확인
      const apiRequest = await apiRequestPromise;
      const postData = apiRequest.postDataJSON() as {
        updates: Array<{ taskId: string; rootTaskId: string; status: string }>;
      };

      expect(postData.updates).toHaveLength(1);
      expect(postData.updates[0]).toEqual({
        taskId: testJobId,
        rootTaskId: testJobId,
        status: "accept",
      });
    });

    test("should send multiple updates in batch", async ({ page }) => {
      await page.goto(`${baseUrl}/${testJobId}`);

      const rootHoldRadio = page.locator(`[data-testid="status-radio-${testJobId}-hold"]`);
      const child1DeleteRadio = page.locator('[data-testid="status-radio-child-1-delete"]');
      const child2SplitRadio = page.locator('[data-testid="status-radio-child-2-split"]');
      const submitButton = page.locator('[data-testid="submit-status-changes"]');

      // 여러 상태 변경
      await rootHoldRadio.click();
      await child1DeleteRadio.click();
      await child2SplitRadio.click();

      // API 요청 감지
      const apiRequestPromise = page.waitForRequest(
        (request) =>
          request.url().includes("/api/tasks/batch-update") && request.method() === "POST"
      );

      // Submit 클릭
      await submitButton.click();

      // API 요청 확인
      const apiRequest = await apiRequestPromise;
      const postData = apiRequest.postDataJSON() as {
        updates: Array<{ taskId: string; rootTaskId: string; status: string }>;
      };

      // 3개 업데이트가 포함되어야 함
      expect(postData.updates).toHaveLength(3);
      expect(postData.updates).toContainEqual({
        taskId: testJobId,
        rootTaskId: testJobId,
        status: "hold",
      });
      expect(postData.updates).toContainEqual({
        taskId: "child-1",
        rootTaskId: testJobId,
        status: "delete",
      });
      expect(postData.updates).toContainEqual({
        taskId: "child-2",
        rootTaskId: testJobId,
        status: "split",
      });
    });
  });

  test.describe("🔒 Locked 상태 (in-progress/done) 테스트", () => {
    test("should disable radio buttons when task status is in-progress", async ({ page }) => {
      const lockedTask = {
        id: testJobId,
        goal: "Locked job",
        acceptance: "Locked acceptance",
        status: "in-progress",
        tasks: [],
      };
      await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(lockedTask, null, 2));

      await page.goto(`${baseUrl}/${testJobId}`);

      // 4개 radio 버튼 모두 disabled
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-accept"]`)).toBeDisabled();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-delete"]`)).toBeDisabled();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-hold"]`)).toBeDisabled();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-split"]`)).toBeDisabled();
    });

    test("should disable radio buttons when task status is done", async ({ page }) => {
      const doneTask = {
        id: testJobId,
        goal: "Done job",
        acceptance: "Done acceptance",
        status: "done",
        tasks: [],
      };
      await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(doneTask, null, 2));

      await page.goto(`${baseUrl}/${testJobId}`);

      // 4개 radio 버튼 모두 disabled
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-accept"]`)).toBeDisabled();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-delete"]`)).toBeDisabled();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-hold"]`)).toBeDisabled();
      await expect(page.locator(`[data-testid="status-radio-${testJobId}-split"]`)).toBeDisabled();
    });

    test("should disable textarea when task status is in-progress", async ({ page }) => {
      const lockedTask = {
        id: testJobId,
        goal: "Locked job",
        acceptance: "Locked acceptance",
        status: "in-progress",
        tasks: [],
      };
      await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(lockedTask, null, 2));

      await page.goto(`${baseUrl}/${testJobId}`);

      const textarea = page.locator(`[data-testid="additional-instructions-${testJobId}"]`);
      await expect(textarea).toBeDisabled();
    });

    test("should disable textarea when task status is done", async ({ page }) => {
      const doneTask = {
        id: testJobId,
        goal: "Done job",
        acceptance: "Done acceptance",
        status: "done",
        tasks: [],
      };
      await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(doneTask, null, 2));

      await page.goto(`${baseUrl}/${testJobId}`);

      const textarea = page.locator(`[data-testid="additional-instructions-${testJobId}"]`);
      await expect(textarea).toBeDisabled();
    });

    test("should not enable submit button for locked task", async ({ page }) => {
      const lockedTask = {
        id: testJobId,
        goal: "Locked job",
        acceptance: "Locked acceptance",
        status: "in-progress",
        tasks: [],
      };
      await fs.writeFile(path.join(testJobDir, "task.json"), JSON.stringify(lockedTask, null, 2));

      await page.goto(`${baseUrl}/${testJobId}`);

      // submit 버튼은 비활성화 상태 유지
      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      await expect(submitButton).toBeDisabled();
    });
  });
});
