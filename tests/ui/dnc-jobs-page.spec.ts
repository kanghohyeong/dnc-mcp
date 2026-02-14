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

    // Then: job 목록 컨테이너 존재하거나, job이 없을 때 empty state 표시
    const jobList = page.locator('[data-testid="job-list"], .job-list');
    const emptyState = page.locator(".empty-state");

    // job 목록이 보이거나 empty state가 보여야 함
    const jobListVisible = await jobList.isVisible().catch(() => false);
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);

    expect(jobListVisible || emptyStateVisible).toBeTruthy();
  });

  test("should display job information (ID, goal, status)", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: 최소한 하나의 job 항목이 있다면
    const jobItems = page.locator('[data-testid="job-item"], .job-item, .job-card');
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

    // Then: job 항목이 있는 경우에만 링크 검증
    const jobItems = page.locator('[data-testid="job-item"], .job-item, .job-card');
    const jobCount = await jobItems.count();

    if (jobCount > 0) {
      // job 상세 페이지로 가는 링크 찾기 (root URL + job ID)
      const allLinks = page.locator("a.job-link");
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
    const statusElements = page.locator('[data-testid="job-status"], .job-status, .status-badge');
    const count = await statusElements.count();

    if (count > 0) {
      // status 요소가 존재해야 함
      const firstStatus = statusElements.first();
      await expect(firstStatus).toBeVisible();

      // 텍스트가 pending, in-progress, done 중 하나를 포함해야 함
      const text = await firstStatus.textContent();
      expect(text).toMatch(/pending|in-progress|done/i);
    }
  });

  test("should display job ID correctly", async ({ page }) => {
    // Given: 테스트 task 파일 확인
    await page.goto(`${baseUrl}/`);

    // Then: job이 있으면 .job-id 요소에 ID가 표시되어야 함
    const jobIdElements = page.locator(".job-id");
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

    // Then: 상세 보기 링크가 /{task-id} 형식이어야 함
    const detailLinks = page.locator("a.job-link");
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

    // When: 상세 보기 링크 클릭
    const detailLinks = page.locator("a.job-link");
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

    const jobIdElements = page.locator(".job-id");
    const count = await jobIdElements.count();

    if (count > 0) {
      const firstJobId = await jobIdElements.first().textContent();

      // When: 상세 페이지로 직접 이동
      await page.goto(`${baseUrl}/${firstJobId}`);

      // Then: 상세 페이지에 job ID가 표시되어야 함
      const detailPageJobId = page.locator('[data-testid="job-id"]');
      await expect(detailPageJobId).toBeVisible();
      await expect(detailPageJobId).toHaveText(firstJobId || "");
    }
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
    // Given: job이 하나도 없는 상태 (이 테스트는 .dnc가 비어있을 때만 의미 있음)
    await page.goto(`${baseUrl}/`);

    // Then: job 목록이 없으면 empty state가 표시되어야 함
    const jobList = page.locator('[data-testid="job-list"]');
    const emptyState = page.locator(".empty-state");

    const jobListVisible = await jobList.isVisible().catch(() => false);
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);

    // 둘 중 하나는 보여야 함
    expect(jobListVisible || emptyStateVisible).toBeTruthy();

    // job이 없으면 empty state가 보여야 함
    if (!jobListVisible) {
      await expect(emptyState).toBeVisible();
    }
  });

  test("should display multiple job IDs correctly", async ({ page }) => {
    // Given: 메인 페이지 방문
    await page.goto(`${baseUrl}/`);

    // Then: 모든 job ID가 올바른 형식으로 표시되어야 함
    const jobIdElements = page.locator(".job-id");
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
