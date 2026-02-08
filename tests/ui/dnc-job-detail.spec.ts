import { test, expect } from "@playwright/test";
import { UIWebServer } from "../../src/services/web-server.js";
import { DncJobService, type DncJob } from "../../src/services/dnc-job-service.js";
import {
  DncJobDetailLoader,
  type DncJobWithDetails,
} from "../../src/services/dnc-job-detail-loader.js";

/**
 * 테스트용 메모리 기반 DncJobService
 */
class MockDncJobService extends DncJobService {
  private jobs: Map<string, DncJob> = new Map();

  constructor() {
    super();
  }

  addJob(job: DncJob): void {
    this.jobs.set(job.id, job);
  }

  removeJob(jobId: string): void {
    this.jobs.delete(jobId);
  }

  clearJobs(): void {
    this.jobs.clear();
  }

  getAllRootJobs(): Promise<DncJob[]> {
    return Promise.resolve(Array.from(this.jobs.values()));
  }

  getJobById(jobId: string): Promise<DncJob | null> {
    const job = this.jobs.get(jobId);
    if (job) {
      return Promise.resolve(job);
    }

    // divided_jobs에서 재귀 검색
    for (const rootJob of this.jobs.values()) {
      const found = this.findJobInTreeHelper(rootJob, jobId);
      if (found) {
        return Promise.resolve(found);
      }
    }

    return Promise.resolve(null);
  }

  private findJobInTreeHelper(job: DncJob, targetId: string): DncJob | null {
    if (job.id === targetId) {
      return job;
    }

    for (const childJob of job.divided_jobs) {
      const found = this.findJobInTreeHelper(childJob, targetId);
      if (found) {
        return found;
      }
    }

    return null;
  }
}

/**
 * 테스트용 메모리 기반 DncJobDetailLoader
 */
class MockDncJobDetailLoader extends DncJobDetailLoader {
  private specContents: Map<string, string> = new Map();
  private mockJobService: MockDncJobService;

  constructor(mockJobService: MockDncJobService) {
    super();
    this.mockJobService = mockJobService;
  }

  setSpecContent(specPath: string, content: string): void {
    this.specContents.set(specPath, content);
  }

  clearSpecContents(): void {
    this.specContents.clear();
  }

  async loadJobWithDetails(job: DncJob): Promise<DncJobWithDetails> {
    // 메모리에서 spec 내용 가져오기
    const specContent = this.specContents.get(job.spec) || "# Default Spec";

    // divided_jobs 재귀 변환
    const dividedJobsWithDetails = await Promise.all(
      job.divided_jobs.map((childJob) => this.loadJobWithDetails(childJob))
    );

    return {
      id: job.id,
      goal: job.goal,
      spec: job.spec,
      status: job.status,
      specContent,
      divided_jobs: dividedJobsWithDetails,
    };
  }

  async loadJobByIdWithDetails(jobId: string): Promise<DncJobWithDetails | null> {
    // MockDncJobService에서 job 찾기
    const job = await this.mockJobService.getJobById(jobId);
    if (!job) {
      return null;
    }

    // details로 변환
    return this.loadJobWithDetails(job);
  }
}

let webServer: UIWebServer;
let baseURL: string;
let mockJobService: MockDncJobService;
let mockDetailLoader: MockDncJobDetailLoader;

test.describe("DnC Job Detail Page", () => {
  test.beforeAll(async () => {
    // Mock 서비스 생성
    mockJobService = new MockDncJobService();
    mockDetailLoader = new MockDncJobDetailLoader(mockJobService);

    // Mock 서비스로 서버 시작
    webServer = new UIWebServer({
      autoOpenBrowser: false,
      dncJobService: mockJobService,
      dncJobDetailLoader: mockDetailLoader,
    });
    await webServer.start();
    baseURL = `http://localhost:${webServer.getPort()}`;
  });

  test.afterAll(async () => {
    // 모든 테스트 후 서버 종료
    await webServer.stop();
  });

  test.beforeEach(() => {
    // 이전 데이터 정리
    mockJobService.clearJobs();
    mockDetailLoader.clearSpecContents();

    // 테스트용 job 추가 (메모리)
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

    mockJobService.addJob(job);
    mockDetailLoader.setSpecContent(job.spec, specContent);
  });

  test.afterEach(() => {
    // 메모리 데이터만 정리
    mockJobService.clearJobs();
    mockDetailLoader.clearSpecContents();
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
    const job: DncJob = {
      id: "job-pending-test",
      goal: "Pending job",
      spec: ".dnc/job-pending-test/spec.md",
      status: "pending",
      divided_jobs: [],
    };

    mockJobService.addJob(job);
    mockDetailLoader.setSpecContent(job.spec, "# Pending Spec");

    await page.goto(`${baseURL}/dnc/jobs/job-pending-test`);

    const jobStatus = page.getByTestId("job-status");
    await expect(jobStatus).toHaveClass(/status-pending/);
  });

  test("should display correct status style for done", async ({ page }) => {
    const job: DncJob = {
      id: "job-done-test",
      goal: "Done job",
      spec: ".dnc/job-done-test/spec.md",
      status: "done",
      divided_jobs: [],
    };

    mockJobService.addJob(job);
    mockDetailLoader.setSpecContent(job.spec, "# Done Spec");

    await page.goto(`${baseURL}/dnc/jobs/job-done-test`);

    const jobStatus = page.getByTestId("job-status");
    await expect(jobStatus).toHaveClass(/status-done/);
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

  test.describe("Subtasks Tree UI", () => {
    test("should display subtasks section when job has divided_jobs", async ({ page }) => {
      const job: DncJob = {
        id: "job-with-subtasks",
        goal: "Parent job with subtasks",
        spec: ".dnc/job-with-subtasks/spec.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "subtask-1",
            goal: "First subtask",
            spec: ".dnc/job-with-subtasks/subtask-1-spec.md",
            status: "done",
            divided_jobs: [],
          },
          {
            id: "subtask-2",
            goal: "Second subtask",
            spec: ".dnc/job-with-subtasks/subtask-2-spec.md",
            status: "pending",
            divided_jobs: [],
          },
        ],
      };

      mockJobService.addJob(job);
      mockDetailLoader.setSpecContent(job.spec, "# Parent Spec");
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-subtasks/subtask-1-spec.md",
        "# Subtask 1 Spec"
      );
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-subtasks/subtask-2-spec.md",
        "# Subtask 2 Spec"
      );

      await page.goto(`${baseURL}/dnc/jobs/job-with-subtasks`);

      const subtasksSection = page.getByTestId("subtasks-section");
      await expect(subtasksSection).toBeVisible();
    });

    test("should not display subtasks section when job has no divided_jobs", async ({ page }) => {
      await page.goto(`${baseURL}/dnc/jobs/job-ui-test`);

      const subtasksSection = page.getByTestId("subtasks-section");
      await expect(subtasksSection).toHaveCount(0);
    });

    test("should display subtask information correctly", async ({ page }) => {
      const job: DncJob = {
        id: "job-with-subtasks",
        goal: "Parent job",
        spec: ".dnc/job-with-subtasks/spec.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "subtask-1",
            goal: "First subtask goal",
            spec: ".dnc/job-with-subtasks/subtask-1-spec.md",
            status: "done",
            divided_jobs: [],
          },
        ],
      };

      mockJobService.addJob(job);
      mockDetailLoader.setSpecContent(job.spec, "# Parent Spec");
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-subtasks/subtask-1-spec.md",
        "# Subtask 1 Spec"
      );

      await page.goto(`${baseURL}/dnc/jobs/job-with-subtasks`);

      const subtaskItem = page.getByTestId("subtask-item-subtask-1");
      await expect(subtaskItem).toBeVisible();

      const subtaskId = subtaskItem.getByTestId("subtask-id");
      await expect(subtaskId).toContainText("subtask-1");

      const subtaskGoal = subtaskItem.getByTestId("subtask-goal");
      await expect(subtaskGoal).toContainText("First subtask goal");

      const subtaskStatus = subtaskItem.getByTestId("subtask-status");
      await expect(subtaskStatus).toContainText("done");
    });

    test("should apply correct status styles to subtasks", async ({ page }) => {
      const job: DncJob = {
        id: "job-with-subtasks",
        goal: "Parent job",
        spec: ".dnc/job-with-subtasks/spec.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "subtask-pending",
            goal: "Pending subtask",
            spec: ".dnc/job-with-subtasks/subtask-pending-spec.md",
            status: "pending",
            divided_jobs: [],
          },
          {
            id: "subtask-in-progress",
            goal: "In-progress subtask",
            spec: ".dnc/job-with-subtasks/subtask-in-progress-spec.md",
            status: "in-progress",
            divided_jobs: [],
          },
          {
            id: "subtask-done",
            goal: "Done subtask",
            spec: ".dnc/job-with-subtasks/subtask-done-spec.md",
            status: "done",
            divided_jobs: [],
          },
        ],
      };

      mockJobService.addJob(job);
      mockDetailLoader.setSpecContent(job.spec, "# Parent Spec");
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-subtasks/subtask-pending-spec.md",
        "# Pending Spec"
      );
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-subtasks/subtask-in-progress-spec.md",
        "# In-progress Spec"
      );
      mockDetailLoader.setSpecContent(".dnc/job-with-subtasks/subtask-done-spec.md", "# Done Spec");

      await page.goto(`${baseURL}/dnc/jobs/job-with-subtasks`);

      const pendingStatus = page
        .getByTestId("subtask-item-subtask-pending")
        .getByTestId("subtask-status");
      await expect(pendingStatus).toHaveClass(/status-pending/);

      const inProgressStatus = page
        .getByTestId("subtask-item-subtask-in-progress")
        .getByTestId("subtask-status");
      await expect(inProgressStatus).toHaveClass(/status-in-progress/);

      const doneStatus = page
        .getByTestId("subtask-item-subtask-done")
        .getByTestId("subtask-status");
      await expect(doneStatus).toHaveClass(/status-done/);
    });

    test("should display subtasks with correct indentation for nested structure", async ({
      page,
    }) => {
      const job: DncJob = {
        id: "job-with-nested-subtasks",
        goal: "Parent job",
        spec: ".dnc/job-with-nested-subtasks/spec.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "subtask-level-1",
            goal: "Level 1 subtask",
            spec: ".dnc/job-with-nested-subtasks/subtask-level-1-spec.md",
            status: "in-progress",
            divided_jobs: [
              {
                id: "subtask-level-2",
                goal: "Level 2 subtask",
                spec: ".dnc/job-with-nested-subtasks/subtask-level-2-spec.md",
                status: "pending",
                divided_jobs: [],
              },
            ],
          },
        ],
      };

      mockJobService.addJob(job);
      mockDetailLoader.setSpecContent(job.spec, "# Parent Spec");
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-nested-subtasks/subtask-level-1-spec.md",
        "# Level 1 Spec"
      );
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-nested-subtasks/subtask-level-2-spec.md",
        "# Level 2 Spec"
      );

      await page.goto(`${baseURL}/dnc/jobs/job-with-nested-subtasks`);

      // Level 1 subtask
      const level1Item = page.getByTestId("subtask-item-subtask-level-1");
      await expect(level1Item).toBeVisible();
      const level1Padding = await level1Item.evaluate((el) =>
        window.getComputedStyle(el).paddingLeft.replace("px", "")
      );

      // Level 2 subtask
      const level2Item = page.getByTestId("subtask-item-subtask-level-2");
      await expect(level2Item).toBeVisible();
      const level2Padding = await level2Item.evaluate((el) =>
        window.getComputedStyle(el).paddingLeft.replace("px", "")
      );

      // Level 2의 패딩이 Level 1보다 커야 함
      expect(Number(level2Padding)).toBeGreaterThan(Number(level1Padding));
    });

    test("should render deeply nested subtasks recursively", async ({ page }) => {
      const job: DncJob = {
        id: "job-with-deep-subtasks",
        goal: "Parent job",
        spec: ".dnc/job-with-deep-subtasks/spec.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "subtask-level-1",
            goal: "Level 1",
            spec: ".dnc/job-with-deep-subtasks/subtask-level-1-spec.md",
            status: "in-progress",
            divided_jobs: [
              {
                id: "subtask-level-2",
                goal: "Level 2",
                spec: ".dnc/job-with-deep-subtasks/subtask-level-2-spec.md",
                status: "in-progress",
                divided_jobs: [
                  {
                    id: "subtask-level-3",
                    goal: "Level 3",
                    spec: ".dnc/job-with-deep-subtasks/subtask-level-3-spec.md",
                    status: "pending",
                    divided_jobs: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      mockJobService.addJob(job);
      mockDetailLoader.setSpecContent(job.spec, "# Parent Spec");
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-deep-subtasks/subtask-level-1-spec.md",
        "# Level 1 Spec"
      );
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-deep-subtasks/subtask-level-2-spec.md",
        "# Level 2 Spec"
      );
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-deep-subtasks/subtask-level-3-spec.md",
        "# Level 3 Spec"
      );

      await page.goto(`${baseURL}/dnc/jobs/job-with-deep-subtasks`);

      // 모든 레벨이 표시되어야 함
      await expect(page.getByTestId("subtask-item-subtask-level-1")).toBeVisible();
      await expect(page.getByTestId("subtask-item-subtask-level-2")).toBeVisible();
      await expect(page.getByTestId("subtask-item-subtask-level-3")).toBeVisible();
    });

    test("should toggle subtask spec independently", async ({ page }) => {
      const job: DncJob = {
        id: "job-with-subtasks",
        goal: "Parent job",
        spec: ".dnc/job-with-subtasks/spec.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "subtask-1",
            goal: "First subtask",
            spec: ".dnc/job-with-subtasks/subtask-1-spec.md",
            status: "done",
            divided_jobs: [],
          },
          {
            id: "subtask-2",
            goal: "Second subtask",
            spec: ".dnc/job-with-subtasks/subtask-2-spec.md",
            status: "pending",
            divided_jobs: [],
          },
        ],
      };

      mockJobService.addJob(job);
      mockDetailLoader.setSpecContent(job.spec, "# Parent Spec");
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-subtasks/subtask-1-spec.md",
        "# Subtask 1 Spec\n\nContent for subtask 1"
      );
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-subtasks/subtask-2-spec.md",
        "# Subtask 2 Spec\n\nContent for subtask 2"
      );

      await page.goto(`${baseURL}/dnc/jobs/job-with-subtasks`);

      const subtask1Toggle = page
        .getByTestId("subtask-item-subtask-1")
        .getByTestId("subtask-spec-toggle");
      const subtask1Content = page
        .getByTestId("subtask-item-subtask-1")
        .getByTestId("subtask-spec-content");
      const subtask2Toggle = page
        .getByTestId("subtask-item-subtask-2")
        .getByTestId("subtask-spec-toggle");
      const subtask2Content = page
        .getByTestId("subtask-item-subtask-2")
        .getByTestId("subtask-spec-content");

      // 초기에는 모두 접혀있음
      await expect(subtask1Content).toBeHidden();
      await expect(subtask2Content).toBeHidden();

      // subtask-1만 펼침
      await subtask1Toggle.click();
      await expect(subtask1Content).toBeVisible();
      await expect(subtask2Content).toBeHidden();

      // subtask-2도 펼침
      await subtask2Toggle.click();
      await expect(subtask1Content).toBeVisible();
      await expect(subtask2Content).toBeVisible();

      // subtask-1 다시 접기
      await subtask1Toggle.click();
      await expect(subtask1Content).toBeHidden();
      await expect(subtask2Content).toBeVisible();
    });

    test("should display subtask spec content as markdown", async ({ page }) => {
      const job: DncJob = {
        id: "job-with-subtasks",
        goal: "Parent job",
        spec: ".dnc/job-with-subtasks/spec.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "subtask-1",
            goal: "First subtask",
            spec: ".dnc/job-with-subtasks/subtask-1-spec.md",
            status: "done",
            divided_jobs: [],
          },
        ],
      };

      const subtaskSpecContent = `# Subtask Spec

## 요구사항

- Item 1
- Item 2

**Bold text** and *italic text*`;

      mockJobService.addJob(job);
      mockDetailLoader.setSpecContent(job.spec, "# Parent Spec");
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-subtasks/subtask-1-spec.md",
        subtaskSpecContent
      );

      await page.goto(`${baseURL}/dnc/jobs/job-with-subtasks`);

      const subtaskToggle = page
        .getByTestId("subtask-item-subtask-1")
        .getByTestId("subtask-spec-toggle");
      await subtaskToggle.click();

      const subtaskContent = page
        .getByTestId("subtask-item-subtask-1")
        .getByTestId("subtask-spec-content");

      // 마크다운이 렌더링되어야 함
      await expect(subtaskContent.locator("h1")).toContainText("Subtask Spec");
      await expect(subtaskContent.locator("h2")).toContainText("요구사항");
      await expect(subtaskContent.locator("li")).toHaveCount(2);
      await expect(subtaskContent.locator("strong")).toContainText("Bold text");
      await expect(subtaskContent.locator("em")).toContainText("italic text");
    });

    test("should toggle nested subtask specs independently", async ({ page }) => {
      const job: DncJob = {
        id: "job-with-nested-subtasks",
        goal: "Parent job",
        spec: ".dnc/job-with-nested-subtasks/spec.md",
        status: "in-progress",
        divided_jobs: [
          {
            id: "subtask-level-1",
            goal: "Level 1 subtask",
            spec: ".dnc/job-with-nested-subtasks/subtask-level-1-spec.md",
            status: "in-progress",
            divided_jobs: [
              {
                id: "subtask-level-2",
                goal: "Level 2 subtask",
                spec: ".dnc/job-with-nested-subtasks/subtask-level-2-spec.md",
                status: "pending",
                divided_jobs: [],
              },
            ],
          },
        ],
      };

      mockJobService.addJob(job);
      mockDetailLoader.setSpecContent(job.spec, "# Parent Spec");
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-nested-subtasks/subtask-level-1-spec.md",
        "# Level 1 Spec Content"
      );
      mockDetailLoader.setSpecContent(
        ".dnc/job-with-nested-subtasks/subtask-level-2-spec.md",
        "# Level 2 Spec Content"
      );

      await page.goto(`${baseURL}/dnc/jobs/job-with-nested-subtasks`);

      const level1Toggle = page
        .getByTestId("subtask-item-subtask-level-1")
        .getByTestId("subtask-spec-toggle");
      const level1Content = page
        .getByTestId("subtask-item-subtask-level-1")
        .getByTestId("subtask-spec-content");
      const level2Toggle = page
        .getByTestId("subtask-item-subtask-level-2")
        .getByTestId("subtask-spec-toggle");
      const level2Content = page
        .getByTestId("subtask-item-subtask-level-2")
        .getByTestId("subtask-spec-content");

      // Level 1만 펼침
      await level1Toggle.click();
      await expect(level1Content).toBeVisible();
      await expect(level2Content).toBeHidden();

      // Level 2도 펼침
      await level2Toggle.click();
      await expect(level1Content).toBeVisible();
      await expect(level2Content).toBeVisible();

      // Level 1 접기 (Level 2는 여전히 펼쳐져 있어야 함)
      await level1Toggle.click();
      await expect(level1Content).toBeHidden();
      await expect(level2Content).toBeVisible();
    });
  });
});
