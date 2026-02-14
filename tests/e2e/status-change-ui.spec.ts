import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";

test.describe("Status Change UI", () => {
  const dncDir = path.join(process.cwd(), ".dnc");
  let testJobId: string;
  let testJobDir: string;

  test.beforeEach(async ({ page: _page }, testInfo) => {
    // 각 테스트마다 고유한 ID 생성 (테스트 간 격리)
    testJobId = `test-job-${Date.now()}-${testInfo.testId}`;
    testJobDir = path.join(dncDir, testJobId);

    // 테스트용 task 생성
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
    // 테스트용 task 정리
    await fs.rm(testJobDir, { recursive: true, force: true });
  });

  test.describe("✅ UI 렌더링 테스트", () => {
    test("should display status dropdown for each task", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      // Root task dropdown (동적 testJobId 사용)
      const rootDropdown = page.locator(`[data-testid="status-dropdown-${testJobId}"]`);
      await expect(rootDropdown).toBeVisible();
      await expect(rootDropdown).toHaveValue("init");

      // Child 1 dropdown
      const child1Dropdown = page.locator('[data-testid="status-dropdown-child-1"]');
      await expect(child1Dropdown).toBeVisible();
      await expect(child1Dropdown).toHaveValue("init");

      // Child 2 dropdown
      const child2Dropdown = page.locator('[data-testid="status-dropdown-child-2"]');
      await expect(child2Dropdown).toBeVisible();
      await expect(child2Dropdown).toHaveValue("accept");
    });

    test("should display all status options in dropdown", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      const dropdown = page.locator(`[data-testid="status-dropdown-${testJobId}"]`);
      await dropdown.waitFor({ state: "visible" });

      const options = dropdown.locator("option");

      // 7개 옵션 확인
      await expect(options).toHaveCount(7);

      // 각 옵션 값 확인
      const optionValues = await options.allTextContents();
      expect(optionValues).toContain("init");
      expect(optionValues).toContain("accept");
      expect(optionValues).toContain("in-progress");
      expect(optionValues).toContain("done");
      expect(optionValues).toContain("delete");
      expect(optionValues).toContain("hold");
      expect(optionValues).toContain("split");
    });

    test("should display submit button at the bottom", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      await submitButton.waitFor({ state: "visible", timeout: 10000 });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toHaveText(/변경사항 저장|Save Changes/i);

      // 초기에는 비활성화
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe("🔄 상태 변경 및 추적 테스트", () => {
    test("should enable submit button when status changes", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      const rootDropdown = page.locator(`[data-testid="status-dropdown-${testJobId}"]`);

      // 초기에는 비활성화
      await expect(submitButton).toBeDisabled();

      // 상태 변경
      await rootDropdown.selectOption("done");

      // Submit 버튼 활성화
      await expect(submitButton).toBeEnabled();
    });

    test("should track multiple task changes", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      const rootDropdown = page.locator(`[data-testid="status-dropdown-${testJobId}"]`);
      const child1Dropdown = page.locator('[data-testid="status-dropdown-child-1"]');

      // 여러 task 상태 변경
      await rootDropdown.selectOption("in-progress");
      await child1Dropdown.selectOption("done");

      // Submit 버튼 활성화
      await expect(submitButton).toBeEnabled();
    });

    test("should disable submit button when reverted to original state", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      const submitButton = page.locator('[data-testid="submit-status-changes"]');
      const rootDropdown = page.locator(`[data-testid="status-dropdown-${testJobId}"]`);

      // 상태 변경
      await rootDropdown.selectOption("done");
      await expect(submitButton).toBeEnabled();

      // 다시 원래 상태로
      await rootDropdown.selectOption("init");
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe("📡 API 호출 및 피드백 테스트", () => {
    test("should call API when submit button is clicked", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      const rootDropdown = page.locator(`[data-testid="status-dropdown-${testJobId}"]`);
      const submitButton = page.locator('[data-testid="submit-status-changes"]');

      // 상태 변경
      await rootDropdown.selectOption("done");

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
        status: "done",
      });
    });

    test.skip("should update UI after successful API response", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      const rootDropdown = page.locator(`[data-testid="status-dropdown-${testJobId}"]`);
      const submitButton = page.locator('[data-testid="submit-status-changes"]');

      // 상태 변경
      await rootDropdown.selectOption("done");

      // Submit 클릭
      await submitButton.click();

      // API 응답 대기 - 버튼 텍스트가 "저장 중..."에서 "변경사항 저장"으로 변경될 때까지 기다림
      await expect(submitButton).toHaveText("변경사항 저장", { timeout: 5000 });

      // Submit 버튼이 다시 비활성화됨
      await expect(submitButton).toBeDisabled();
    });

    test("should send multiple updates in batch", async ({ page }) => {
      await page.goto(`/${testJobId}`);

      const rootDropdown = page.locator(`[data-testid="status-dropdown-${testJobId}"]`);
      const child1Dropdown = page.locator('[data-testid="status-dropdown-child-1"]');
      const child2Dropdown = page.locator('[data-testid="status-dropdown-child-2"]');
      const submitButton = page.locator('[data-testid="submit-status-changes"]');

      // 여러 상태 변경
      await rootDropdown.selectOption("in-progress");
      await child1Dropdown.selectOption("done");
      await child2Dropdown.selectOption("in-progress");

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
        status: "in-progress",
      });
      expect(postData.updates).toContainEqual({
        taskId: "child-1",
        rootTaskId: testJobId,
        status: "done",
      });
      expect(postData.updates).toContainEqual({
        taskId: "child-2",
        rootTaskId: testJobId,
        status: "in-progress",
      });
    });
  });
});
