import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";
import { UIWebServer } from "../../src/services/web-server.js";
import type { DncJob } from "../../src/services/dnc-job-service.js";

let webServer: UIWebServer;
let baseURL: string;

test.describe("DnC Job Detail Page", () => {
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

  test.beforeEach(async () => {
    // 테스트용 job 생성
    const dncDir = path.join(process.cwd(), ".dnc");
    const jobDir = path.join(dncDir, "job-ui-test");
    await fs.mkdir(jobDir, { recursive: true });

    const job: DncJob = {
      id: "job-ui-test",
      goal: "UI 테스트용 job입니다",
      spec: ".dnc/job-ui-test/spec.md",
      status: "in-progress",
      divided_jobs: [],
    };

    const specContent = `# UI Test Spec

This is a test spec for UI.

## 요구사항

- 첫 번째 요구사항
- 두 번째 요구사항

## 코드 예제

\`\`\`typescript
function example() {
  return "test";
}
\`\`\`

**강조된 텍스트**와 *이탤릭 텍스트*가 있습니다.`;

    await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job, null, 2));
    await fs.writeFile(path.join(jobDir, "spec.md"), specContent);
  });

  test.afterEach(async () => {
    // 테스트용 job 삭제
    const jobDir = path.join(process.cwd(), ".dnc", "job-ui-test");
    await fs.rm(jobDir, { recursive: true, force: true });
  });

  test("should display job basic information", async ({ page }) => {
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

    // Job ID 확인
    const jobId = page.getByTestId("job-id");
    await expect(jobId).toBeVisible();
    await expect(jobId).toHaveText("job-ui-test");

    // Goal 확인
    const jobGoal = page.getByTestId("job-goal");
    await expect(jobGoal).toBeVisible();
    await expect(jobGoal).toContainText("UI 테스트용 job입니다");

    // Status 확인
    const jobStatus = page.getByTestId("job-status");
    await expect(jobStatus).toBeVisible();
    await expect(jobStatus).toHaveText("in-progress");
  });

  test("should display correct status style for pending", async ({ page }) => {
    // 테스트용 pending job 생성
    const dncDir = path.join(process.cwd(), ".dnc");
    const jobDir = path.join(dncDir, "job-pending-test");
    await fs.mkdir(jobDir, { recursive: true });

    const job: DncJob = {
      id: "job-pending-test",
      goal: "Pending job",
      spec: ".dnc/job-pending-test/spec.md",
      status: "pending",
      divided_jobs: [],
    };

    await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job, null, 2));
    await fs.writeFile(path.join(jobDir, "spec.md"), "# Pending Spec");

    await page.goto(`${baseURL}/dnc/jobs/job-pending-test`);

    const jobStatus = page.getByTestId("job-status");
    await expect(jobStatus).toHaveClass(/status-pending/);

    // 정리
    await fs.rm(jobDir, { recursive: true, force: true });
  });

  test("should display correct status style for done", async ({ page }) => {
    // 테스트용 done job 생성
    const dncDir = path.join(process.cwd(), ".dnc");
    const jobDir = path.join(dncDir, "job-done-test");
    await fs.mkdir(jobDir, { recursive: true });

    const job: DncJob = {
      id: "job-done-test",
      goal: "Done job",
      spec: ".dnc/job-done-test/spec.md",
      status: "done",
      divided_jobs: [],
    };

    await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job, null, 2));
    await fs.writeFile(path.join(jobDir, "spec.md"), "# Done Spec");

    await page.goto(`${baseURL}/dnc/jobs/job-done-test`);

    const jobStatus = page.getByTestId("job-status");
    await expect(jobStatus).toHaveClass(/status-done/);

    // 정리
    await fs.rm(jobDir, { recursive: true, force: true });
  });

  test("should have back to list link", async ({ page }) => {
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

    const backLink = page.getByRole("link", { name: /목록으로 돌아가기/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/dnc/jobs");
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    // 뷰포트를 먼저 설정
    await page.setViewportSize({ width: 375, height: 667 });

    // 페이지 로드 및 로드 완료 대기
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`, { waitUntil: "networkidle" });

    // 모바일에서도 모든 요소가 보여야 함
    await expect(page.getByTestId("job-id")).toBeVisible();
    await expect(page.getByTestId("job-goal")).toBeVisible();
    await expect(page.getByTestId("job-status")).toBeVisible();
  });

  test("should be responsive on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`, { waitUntil: "networkidle" });

    // 데스크톱에서도 모든 요소가 보여야 함
    await expect(page.getByTestId("job-id")).toBeVisible();
    await expect(page.getByTestId("job-goal")).toBeVisible();
    await expect(page.getByTestId("job-status")).toBeVisible();
  });

  // TC1: Spec 섹션이 페이지에 표시됨
  test("should display spec section on page", async ({ page }) => {
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

    const specSection = page.getByTestId("job-spec-section");
    await expect(specSection).toBeVisible();
  });

  // TC2: Spec 내용이 마크다운으로 렌더링됨
  test("should render spec content as markdown", async ({ page }) => {
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

    // 토글 버튼을 클릭하여 내용을 펼침
    const toggleButton = page.getByTestId("spec-toggle-button");
    await toggleButton.click();

    const specContent = page.getByTestId("spec-content");

    // 마크다운 제목이 h1 태그로 렌더링되는지 확인
    const h1 = specContent.locator("h1");
    await expect(h1).toContainText("UI Test Spec");

    // 마크다운 제목이 h2 태그로 렌더링되는지 확인
    const h2 = specContent.locator("h2").first();
    await expect(h2).toContainText("요구사항");

    // 목록이 렌더링되는지 확인
    const listItems = specContent.locator("li");
    await expect(listItems).toHaveCount(2);

    // 코드 블록이 렌더링되는지 확인
    const codeBlock = specContent.locator("pre code");
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText("function example()");

    // 강조 텍스트가 렌더링되는지 확인
    const strong = specContent.locator("strong");
    await expect(strong).toContainText("강조된 텍스트");

    // 이탤릭 텍스트가 렌더링되는지 확인
    const em = specContent.locator("em");
    await expect(em).toContainText("이탤릭 텍스트");
  });

  // TC3: 초기 상태에서 Spec이 접혀있음
  test("should have spec collapsed by default", async ({ page }) => {
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

    const specContent = page.getByTestId("spec-content");
    await expect(specContent).toBeHidden();
  });

  // TC4: 토글 버튼 클릭 시 Spec이 펼쳐짐
  test("should expand spec when toggle button is clicked", async ({ page }) => {
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

    const toggleButton = page.getByTestId("spec-toggle-button");
    const specContent = page.getByTestId("spec-content");

    // 초기에는 접혀있음
    await expect(specContent).toBeHidden();

    // 토글 버튼 클릭
    await toggleButton.click();

    // 펼쳐짐
    await expect(specContent).toBeVisible();
  });

  // TC5: 다시 토글 버튼 클릭 시 Spec이 접힘
  test("should collapse spec when toggle button is clicked again", async ({ page }) => {
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

    const toggleButton = page.getByTestId("spec-toggle-button");
    const specContent = page.getByTestId("spec-content");

    // 펼침
    await toggleButton.click();
    await expect(specContent).toBeVisible();

    // 다시 토글
    await toggleButton.click();

    // 접힘
    await expect(specContent).toBeHidden();
  });

  // TC6: 마크다운 스타일이 적용됨
  test("should apply markdown styles", async ({ page }) => {
    await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

    const toggleButton = page.getByTestId("spec-toggle-button");
    await toggleButton.click();

    const specContent = page.getByTestId("spec-content");

    // 코드 블록 스타일 확인
    const codeBlock = specContent.locator("pre");
    const bgColor = await codeBlock.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)"); // 배경색이 있어야 함

    // 제목 스타일 확인
    const h2 = specContent.locator("h2").first();
    const fontSize = await h2.evaluate((el) => window.getComputedStyle(el).fontSize);
    const defaultFontSize = await page.evaluate(
      () => window.getComputedStyle(document.body).fontSize
    );
    expect(fontSize).not.toBe(defaultFontSize); // 기본 폰트 사이즈와 달라야 함
  });
});
