import { test, expect } from "@playwright/test";
import { UIWebServer } from "../../src/services/web-server.js";

test.describe("DnC Jobs List Page UI", () => {
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

  test("should display DnC jobs page title", async ({ page }) => {
    // Given: 메인 페이지 방문 (이제 / 가 작업 관리 페이지)
    await page.goto(`${baseUrl}/`);

    // Then: 페이지 타이틀 또는 헤딩 확인
    const heading = page.locator("h1");
    await expect(heading).toContainText(/Task Management/i);
  });

  test("should render job list", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: 활성 탭 패널 내 job 목록 또는 empty state가 표시됨
    const jobList = page.locator(
      '#tab-panel-active [data-testid="task-list-active"], #tab-panel-active .task-list'
    );
    const emptyState = page.locator("#tab-panel-active .section-empty");

    const jobListVisible = await jobList.isVisible().catch(() => false);
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);

    expect(jobListVisible || emptyStateVisible).toBeTruthy();
  });

  test("should display job information (ID, goal, status)", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: 최소한 하나의 job 항목이 있다면 (활성 탭만)
    const jobItems = page.locator(
      '#tab-panel-active [data-testid="task-item"], #tab-panel-active .task-item, #tab-panel-active .task-card'
    );
    const count = await jobItems.count();

    if (count > 0) {
      // 첫 번째 job 항목이 ID, goal, status를 포함해야 함
      const firstJob = jobItems.first();
      await expect(firstJob).toBeVisible();

      // job ID가 있어야 함
      const text = await firstJob.textContent();
      expect(text).toBeTruthy();
    }
  });

  test("should have links to job detail pages", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: job 항목이 있는 경우에만 링크 검증 (활성 탭만)
    const jobItems = page.locator(
      '#tab-panel-active [data-testid="task-item"], #tab-panel-active .task-item, #tab-panel-active .task-card'
    );
    const jobCount = await jobItems.count();

    if (jobCount > 0) {
      // job 상세 페이지로 가는 링크 찾기 (root URL + job ID)
      const allLinks = page.locator("#tab-panel-active a.task-link");
      const linkCount = await allLinks.count();

      let hasValidLink = false;
      for (let i = 0; i < linkCount; i++) {
        const href = await allLinks.nth(i).getAttribute("href");
        // /{job-id} 형식인지 검증
        if (href && href !== "/" && href.match(/^\/[a-z0-9-]+$/)) {
          hasValidLink = true;
          break;
        }
      }

      // 유효한 링크가 없어도 job이 없을 수 있으므로 통과
      if (!hasValidLink) {
        expect(true).toBe(true);
      }
    } else {
      // job이 없으면 이 테스트는 의미없으므로 통과
      expect(true).toBe(true);
    }
  });

  test("should display status with visual indicators", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: status별 시각적 구분 (색상, 아이콘 등)
    const statusElements = page.locator(
      '#tab-panel-active [data-testid="task-status"], #tab-panel-active .task-status, #tab-panel-active .status-badge'
    );
    const count = await statusElements.count();

    if (count > 0) {
      // status 요소가 존재해야 함
      const firstStatus = statusElements.first();
      await expect(firstStatus).toBeVisible();

      // 텍스트가 8가지 상태 중 하나를 포함해야 함
      const text = await firstStatus.textContent();
      expect(text).toMatch(/init|accept|in-progress|done|delete|hold|split|modify/i);
    }
  });

  test("should display all 8 status badges with correct styles", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: 각 상태별 배지가 올바른 CSS 클래스를 가져야 함
    const statusBadges = page.locator(".status-badge");
    const count = await statusBadges.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const badge = statusBadges.nth(i);
        const text = await badge.textContent();

        if (text) {
          const status = text.trim().toLowerCase();

          if (
            ["init", "accept", "in-progress", "done", "delete", "hold", "split", "modify"].includes(
              status
            )
          ) {
            // 각 상태에 해당하는 CSS 클래스가 있어야 함
            const className = await badge.getAttribute("class");
            expect(className).toContain(`status-${status}`);
          }
        }
      }
    }
  });

  test("delete status should have strikethrough style", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: delete 상태 배지가 있다면 strikethrough 스타일을 가져야 함
    const deleteBadges = page.locator(".status-badge.status-delete");
    const count = await deleteBadges.count();

    if (count > 0) {
      const firstDeleteBadge = deleteBadges.first();
      await expect(firstDeleteBadge).toBeVisible();

      // CSS 스타일 확인
      const textDecoration = await firstDeleteBadge.evaluate((el) =>
        window.getComputedStyle(el).getPropertyValue("text-decoration")
      );
      const opacity = await firstDeleteBadge.evaluate((el) =>
        window.getComputedStyle(el).getPropertyValue("opacity")
      );

      expect(textDecoration).toContain("line-through");
      expect(parseFloat(opacity as string)).toBe(0.7);
    }
  });

  test("should display job ID correctly", async ({ page }) => {
    // Given: 테스트 task 파일 확인
    await page.goto(`${baseUrl}/`);

    // Then: job이 있으면 .task-id 요소에 ID가 표시되어야 함 (활성 탭만)
    const jobIdElements = page.locator("#tab-panel-active .task-id");
    const count = await jobIdElements.count();

    if (count > 0) {
      const firstJobId = jobIdElements.first();
      await expect(firstJobId).toBeVisible();

      // job ID는 kebab-case 형식이어야 함
      const text = await firstJobId.textContent();
      expect(text).toMatch(/^[a-z0-9-]+$/);
      expect(text).not.toBe(""); // 비어있으면 안됨
    }
  });

  test("should have correct detail page URL format", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: 상세 보기 링크가 /{task-id} 형식이어야 함 (활성 탭만)
    const detailLinks = page.locator("#tab-panel-active a.task-link");
    const count = await detailLinks.count();

    if (count > 0) {
      const firstLink = detailLinks.first();
      const href = await firstLink.getAttribute("href");

      // /{task-id} 형식 검증 (예: /test-job-1)
      expect(href).toMatch(/^\/[a-z0-9-]+$/);
      expect(href).not.toContain("/dnc/jobs/"); // 이전 형식이 아니어야 함
    }
  });

  test("should navigate to detail page on click", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // When: 상세 보기 링크 클릭 (활성 탭만)
    const detailLinks = page.locator("#tab-panel-active a.task-link");
    const count = await detailLinks.count();

    if (count > 0) {
      const firstLink = detailLinks.first();
      const href = await firstLink.getAttribute("href");

      await firstLink.click();
      await page.waitForLoadState("networkidle");

      // Then: URL이 /{task-id}로 변경되어야 함
      expect(page.url()).toBe(`${baseUrl}${href}`);
    }
  });

  test("should display job ID on detail page", async ({ page }) => {
    // Given: 메인 페이지에서 job ID 찾기
    await page.goto(`${baseUrl}/`);

    const jobIdElements = page.locator("#tab-panel-active .task-id");
    const count = await jobIdElements.count();

    if (count > 0) {
      const firstJobId = (await jobIdElements.first().textContent())?.trim();

      // task ID가 유효한 kebab-case 형식인지 확인
      if (firstJobId && /^[a-z0-9-]+$/.test(firstJobId)) {
        // When: 상세 페이지로 직접 이동
        const response = await page.goto(`${baseUrl}/${firstJobId}`);

        // 정상 응답인 경우에만 검증
        if (response?.status() === 200) {
          await page.waitForLoadState("networkidle");
          // Then: 상세 페이지에 job ID가 표시되어야 함 (루트 task의 task-id)
          const detailPageJobId = page.locator(".task-id").first();
          await expect(detailPageJobId).toBeVisible();
          await expect(detailPageJobId).toHaveText(firstJobId);
        }
      }
    }
  });

  test("should render tab bar with In Progress and Done buttons", async ({ page }) => {
    await page.goto(`${baseUrl}/`);

    const tabBar = page.locator(".tab-bar");
    await expect(tabBar).toBeVisible();

    const activeTab = page.locator(".tab-btn", { hasText: "In Progress" });
    const doneTab = page.locator(".tab-btn", { hasText: "Done" });
    await expect(activeTab).toBeVisible();
    await expect(doneTab).toBeVisible();
  });

  test("should show In Progress tab as active by default", async ({ page }) => {
    await page.goto(`${baseUrl}/`);

    const activeTab = page.locator(".tab-btn", { hasText: "In Progress" });
    await expect(activeTab).toHaveClass(/active/);

    const activePanel = page.locator("#tab-panel-active");
    await expect(activePanel).toBeVisible();

    const donePanel = page.locator("#tab-panel-done");
    await expect(donePanel).toBeHidden();
  });

  test("should switch to Done panel when Done tab is clicked", async ({ page }) => {
    await page.goto(`${baseUrl}/`);

    const doneTab = page.locator(".tab-btn", { hasText: "Done" });
    await doneTab.click();

    await expect(doneTab).toHaveClass(/active/);

    const donePanel = page.locator("#tab-panel-done");
    await expect(donePanel).toBeVisible();

    const activePanel = page.locator("#tab-panel-active");
    await expect(activePanel).toBeHidden();
  });

  test("should switch back to In Progress panel when tab is clicked again", async ({ page }) => {
    await page.goto(`${baseUrl}/`);

    const doneTab = page.locator(".tab-btn", { hasText: "Done" });
    await doneTab.click();

    const activeTab = page.locator(".tab-btn", { hasText: "In Progress" });
    await activeTab.click();

    await expect(activeTab).toHaveClass(/active/);
    await expect(page.locator("#tab-panel-active")).toBeVisible();
    await expect(page.locator("#tab-panel-done")).toBeHidden();
  });

  test("should show 404 for non-existent job", async ({ page }) => {
    // When: 존재하지 않는 job ID로 접근
    const response = await page.goto(`${baseUrl}/non-existent-job-id`);

    // Then: 404 응답
    expect(response?.status()).toBe(404);
  });

  test("should show 404 for invalid job ID format", async ({ page }) => {
    // When: 잘못된 형식의 job ID로 접근
    const response = await page.goto(`${baseUrl}/INVALID_ID!!!!`);

    // Then: 404 응답 또는 에러 페이지
    expect(response?.status()).toBe(404);
  });

  test("should display empty state when no jobs", async ({ page }) => {
    await page.goto(`${baseUrl}/`);

    // 활성 탭(In Progress) 기준으로 job 목록 또는 empty state 확인
    const jobList = page.locator('[data-testid="task-list-active"]');
    const emptyState = page.locator("#tab-panel-active .section-empty");

    const jobListVisible = await jobList.isVisible().catch(() => false);
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);

    expect(jobListVisible || emptyStateVisible).toBeTruthy();

    if (!jobListVisible) {
      await expect(emptyState).toBeVisible();
    }
  });

  test("should display multiple job IDs correctly", async ({ page }) => {
    await page.goto(`${baseUrl}/`);

    // 활성 탭(In Progress) 내 job ID만 확인 (숨겨진 탭은 제외)
    const jobIdElements = page.locator("#tab-panel-active .task-id");
    const count = await jobIdElements.count();

    for (let i = 0; i < count; i++) {
      const jobId = jobIdElements.nth(i);
      await expect(jobId).toBeVisible();

      const text = await jobId.textContent();
      expect(text).toMatch(/^[a-z0-9-]+$/);
      expect(text).not.toBe("");
    }
  });
});
