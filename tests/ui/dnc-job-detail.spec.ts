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

    await fs.writeFile(path.join(jobDir, "job_relation.json"), JSON.stringify(job, null, 2));
    await fs.writeFile(
      path.join(jobDir, "spec.md"),
      "# UI Test Spec\n\nThis is a test spec for UI."
    );
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
});
