import { test, expect } from "@playwright/test";
import { UIWebServer } from "../../src/services/web-server.js";
import * as fs from "fs/promises";
import type { Task } from "../../src/utils/dnc-utils.js";

test.describe.serial("Tree Hierarchy UI", () => {
  let webServer: UIWebServer;
  let baseUrl: string;
  const testTaskId = "test-hierarchy-task";

  test.beforeAll(async () => {
    // 테스트용 계층 구조 task 생성
    const hierarchyTask: Task = {
      id: testTaskId,
      goal: "Root task goal",
      acceptance: "# Root Acceptance\n\nThis is **root** acceptance criteria.",
      status: "in-progress",
      tasks: [
        {
          id: "child-1",
          goal: "Child 1 goal",
          acceptance: "## Child 1 Acceptance\n\nFirst child task.",
          status: "done",
          tasks: [
            {
              id: "grandchild-1",
              goal: "Grandchild goal",
              acceptance: "### Grandchild Acceptance\n\nNested task.",
              status: "pending",
              tasks: [],
            },
          ],
        },
        {
          id: "child-2",
          goal: "Child 2 goal",
          acceptance: "## Child 2 Acceptance\n\nSecond child task.",
          status: "in-progress",
          tasks: [],
        },
      ],
    };

    // .dnc 디렉토리 생성 및 task 파일 작성
    await fs.mkdir(`.dnc/${testTaskId}`, { recursive: true });
    await fs.writeFile(
      `.dnc/${testTaskId}/task.json`,
      JSON.stringify(hierarchyTask, null, 2),
      "utf-8"
    );

    // 웹 서버 시작
    webServer = new UIWebServer({ autoOpenBrowser: false });
    await webServer.start();
    const port = webServer.getPort();
    baseUrl = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    // 웹 서버 종료
    await webServer.stop();

    // 테스트용 task 삭제
    try {
      await fs.rm(`.dnc/${testTaskId}`, { recursive: true, force: true });
    } catch {
      // 이미 삭제되었거나 없으면 무시
    }
  });

  test.describe("재귀적 섹션 렌더링", () => {
    test("계층 구조가 화면에 표시된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: task-item 요소들이 존재하는지 (루트 포함 총 4개)
      const taskItems = page.locator(".task-item");
      const count = await taskItems.count();

      // Root task + child-1 + child-2 + grandchild-1 = 4개
      expect(count).toBe(4);
    });

    test("3-level 계층 구조가 올바른 depth 속성으로 렌더링된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 각 레벨의 data-depth 확인
      const rootTask = page.locator(`[data-testid="tree-item-${testTaskId}"]`);
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const child2 = page.locator('[data-testid="tree-item-child-2"]');
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');

      await expect(rootTask).toHaveAttribute("data-depth", "0");
      await expect(child1).toHaveAttribute("data-depth", "1");
      await expect(child2).toHaveAttribute("data-depth", "1");
      await expect(grandchild1).toHaveAttribute("data-depth", "2");
    });

    test("모든 레벨이 동일한 섹션 구조를 가진다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 루트 task가 Goal, Acceptance Criteria 섹션을 가짐
      const rootTask = page.locator(`[data-testid="tree-item-${testTaskId}"]`);
      await expect(rootTask.locator('.section-label:has-text("Goal")').first()).toBeVisible();
      await expect(
        rootTask.locator('.section-label:has-text("Acceptance Criteria")').first()
      ).toBeVisible();

      // child-1도 동일한 섹션 구조
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      await expect(child1.locator('.section-label:has-text("Goal")').first()).toBeVisible();
      await expect(
        child1.locator('.section-label:has-text("Acceptance Criteria")').first()
      ).toBeVisible();
    });

    test("부모-자식 관계가 올바르게 중첩된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: child-1 아래에 grandchild-1이 중첩되어 있는지
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const grandchild1InChild1 = child1.locator('[data-testid="tree-item-grandchild-1"]');

      await expect(grandchild1InChild1).toBeVisible();
    });
  });

  test.describe("Acceptance Criteria 표시", () => {
    test("Acceptance Criteria가 일반 텍스트로 표시된다 (마크다운 없음)", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 루트 task의 Acceptance Criteria가 일반 텍스트
      const rootTask = page.locator(`[data-testid="tree-item-${testTaskId}"]`);
      const acceptanceContent = rootTask
        .locator('.section-label:has-text("Acceptance Criteria")')
        .first()
        .locator("..")
        .locator(".section-content");

      // HTML 태그가 아닌 일반 텍스트로 표시되어야 함
      const content = await acceptanceContent.textContent();
      expect(content).toContain("Root Acceptance");

      // HTML 태그가 렌더링되지 않아야 함 (예: <h1>, <strong> 등)
      const innerHTML = await acceptanceContent.innerHTML();
      expect(innerHTML).not.toContain("<h1>");
      expect(innerHTML).not.toContain("<strong>");
    });

    test("모든 레벨의 task에 Acceptance Criteria 섹션이 존재한다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 각 레벨에 Acceptance Criteria 섹션 존재
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');

      await expect(
        child1.locator('.section-label:has-text("Acceptance Criteria")').first()
      ).toBeVisible();
      await expect(
        grandchild1.locator('.section-label:has-text("Acceptance Criteria")').first()
      ).toBeVisible();
    });
  });

  test.describe("Subtasks 섹션", () => {
    test("자식이 있는 task에만 Subtasks 섹션이 표시된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 루트 task와 child-1은 Subtasks 섹션이 있음
      const rootTask = page.locator(`[data-testid="tree-item-${testTaskId}"]`);
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const child2 = page.locator('[data-testid="tree-item-child-2"]');

      await expect(rootTask.locator('.section-label:has-text("Subtasks")').first()).toBeVisible();
      await expect(child1.locator('.section-label:has-text("Subtasks")').first()).toBeVisible();

      // child-2는 자식이 없으므로 Subtasks 섹션이 없어야 함
      const child2SubtasksSection = child2.locator('.section-label:has-text("Subtasks")');
      await expect(child2SubtasksSection).toHaveCount(0);
    });

    test("모든 자식 task가 항상 표시된다 (펼치기/접기 없음)", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 모든 subtask가 즉시 visible
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const child2 = page.locator('[data-testid="tree-item-child-2"]');
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');

      await expect(child1).toBeVisible();
      await expect(child2).toBeVisible();
      await expect(grandchild1).toBeVisible();
    });
  });

  test.describe("시각적 위계", () => {
    test("들여쓰기로 계층 구조가 표현된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: depth=0은 들여쓰기 없음
      const rootTask = page.locator(`[data-testid="tree-item-${testTaskId}"]`);
      const rootPadding = await rootTask.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).paddingLeft;
      });

      // depth=1은 들여쓰기 있음
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const child1Padding = await child1.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).paddingLeft;
      });

      // depth=2는 더 큰 들여쓰기
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');
      const grandchildPadding = await grandchild1.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).paddingLeft;
      });

      // 위계에 따라 padding이 증가해야 함
      const rootPx = parseInt(rootPadding as string);
      const child1Px = parseInt(child1Padding as string);
      const grandchildPx = parseInt(grandchildPadding as string);

      expect(child1Px).toBeGreaterThan(rootPx);
      expect(grandchildPx).toBeGreaterThan(child1Px);
    });

    test("task header에 ID와 Status가 표시된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: child-1의 header에 ID와 Status dropdown
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const child1Header = child1.locator(".task-header").first();

      await expect(child1Header).toBeVisible();
      await expect(child1Header.locator('[data-testid="tree-item-title"]')).toContainText(
        "child-1"
      );
      // Status는 이제 dropdown으로 표시됨
      const statusDropdown = child1Header.locator('[data-testid="status-dropdown-child-1"]');
      await expect(statusDropdown).toBeVisible();
      await expect(statusDropdown).toHaveValue("done");
    });
  });
});
