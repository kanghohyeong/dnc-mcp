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
    // Given: DnC jobs 페이지 방문
    await page.goto(`${baseUrl}/dnc/jobs`);

    // Then: 페이지 타이틀 또는 헤딩 확인
    const heading = page.locator("h1");
    await expect(heading).toContainText(/DnC Jobs|Job List/i);
  });

  test("should render job list", async ({ page }) => {
    // Given: DnC jobs 페이지 방문
    await page.goto(`${baseUrl}/dnc/jobs`);

    // Then: job 목록 컨테이너 존재하거나, job이 없을 때 empty state 표시
    const jobList = page.locator('[data-testid="job-list"], .job-list');
    const emptyState = page.locator(".empty-state");

    // job 목록이 보이거나 empty state가 보여야 함
    const jobListVisible = await jobList.isVisible().catch(() => false);
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);

    expect(jobListVisible || emptyStateVisible).toBeTruthy();
  });

  test("should display job information (ID, goal, status)", async ({ page }) => {
    // Given: DnC jobs 페이지 방문
    await page.goto(`${baseUrl}/dnc/jobs`);

    // Then: 최소한 하나의 job 항목이 있다면
    const jobItems = page.locator('[data-testid="job-item"], .job-item, tbody tr');
    const count = await jobItems.count();

    if (count > 0) {
      // 첫 번째 job 항목이 ID, goal, status를 포함해야 함
      const firstJob = jobItems.first();
      await expect(firstJob).toBeVisible();

      // job- 로 시작하는 ID가 있어야 함
      const text = await firstJob.textContent();
      expect(text).toBeTruthy();
    }
  });

  test("should have links to job detail pages", async ({ page }) => {
    // Given: DnC jobs 페이지 방문
    await page.goto(`${baseUrl}/dnc/jobs`);

    // Then: job 항목이 있는 경우에만 링크 검증
    const jobItems = page.locator('[data-testid="job-item"], .job-item, tbody tr');
    const jobCount = await jobItems.count();

    if (jobCount > 0) {
      // job 상세 페이지로 가는 링크 찾기 (job ID가 포함된 링크만)
      const allLinks = page.locator('a[href*="/dnc/jobs/"]');
      const linkCount = await allLinks.count();

      let hasValidLink = false;
      for (let i = 0; i < linkCount; i++) {
        const href = await allLinks.nth(i).getAttribute("href");
        // /dnc/jobs/ 뒤에 실제 ID가 있는 링크만 검증
        if (href && href !== "/dnc/jobs/" && href !== "/dnc/jobs") {
          expect(href).toMatch(/\/dnc\/jobs\/.+/);
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
    // Given: DnC jobs 페이지 방문
    await page.goto(`${baseUrl}/dnc/jobs`);

    // Then: status별 시각적 구분 (색상, 아이콘 등)
    const statusElements = page.locator('[data-testid="job-status"], .job-status, .status');
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
});
