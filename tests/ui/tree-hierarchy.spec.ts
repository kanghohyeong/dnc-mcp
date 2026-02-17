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

    test("기본 상태에서 모든 자식 task가 펼쳐진 상태로 표시된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 모든 subtask가 즉시 visible (기본값: 펼침)
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const child2 = page.locator('[data-testid="tree-item-child-2"]');
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');

      await expect(child1).toBeVisible();
      await expect(child2).toBeVisible();
      await expect(grandchild1).toBeVisible();
    });
  });

  test.describe("Subtasks 토글 기능", () => {
    test("자식이 있는 task의 Subtasks 헤더에 토글 버튼이 표시된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 루트 task의 Subtasks 헤더에 토글 버튼이 있음
      const rootTask = page.locator(`[data-testid="tree-item-${testTaskId}"]`);
      const toggleBtn = rootTask.locator(".subtasks-header .subtasks-toggle-btn").first();
      await expect(toggleBtn).toBeVisible();
      await expect(toggleBtn).toHaveText("▼");
    });

    test("토글 버튼 클릭 시 subtasks가 접힌다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // When: 루트 task의 Subtasks 헤더 클릭
      const rootTask = page.locator(`[data-testid="tree-item-${testTaskId}"]`);
      const subtasksHeader = rootTask.locator(".subtasks-header").first();
      await subtasksHeader.click();

      // Then: .task-children에 collapsed 클래스가 추가됨
      const taskChildren = rootTask.locator(".task-children").first();
      await expect(taskChildren).toHaveClass(/collapsed/);

      // Then: 토글 버튼 아이콘이 ▶로 변경
      const toggleBtn = subtasksHeader.locator(".subtasks-toggle-btn");
      await expect(toggleBtn).toHaveText("▶");

      // Then: child-1, child-2가 화면에 보이지 않음
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      await expect(child1).not.toBeVisible();
    });

    test("접힌 상태에서 재클릭 시 subtasks가 다시 펼쳐진다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      const rootTask = page.locator(`[data-testid="tree-item-${testTaskId}"]`);
      const subtasksHeader = rootTask.locator(".subtasks-header").first();

      // When: 접기 → 펼치기
      await subtasksHeader.click();
      await subtasksHeader.click();

      // Then: .task-children에 collapsed 클래스가 제거됨
      const taskChildren = rootTask.locator(".task-children").first();
      await expect(taskChildren).not.toHaveClass(/collapsed/);

      // Then: 토글 버튼 아이콘이 ▼로 복구
      const toggleBtn = subtasksHeader.locator(".subtasks-toggle-btn");
      await expect(toggleBtn).toHaveText("▼");

      // Then: child-1이 다시 보임
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      await expect(child1).toBeVisible();
    });

    test("자식이 없는 task에는 토글 버튼이 없다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: child-2(자식 없음)에는 토글 버튼이 없음
      const child2 = page.locator('[data-testid="tree-item-child-2"]');
      const toggleBtn = child2.locator(".subtasks-toggle-btn");
      await expect(toggleBtn).toHaveCount(0);
    });
  });

  test.describe("수직선 색상", () => {
    test("depth 1 task의 수직선이 빨강 계열(#FF4444)이다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: depth=1인 child-1의 border-left-color가 #FF4444(rgb(255,68,68))
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const borderColor = await child1.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).borderLeftColor;
      });
      expect(borderColor).toBe("rgb(255, 68, 68)");
    });

    test("depth 2 task의 수직선이 주황 계열(#FF8C00)이다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: depth=2인 grandchild-1의 border-left-color가 #FF8C00(rgb(255,140,0))
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');
      const borderColor = await grandchild1.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).borderLeftColor;
      });
      expect(borderColor).toBe("rgb(255, 140, 0)");
    });

    test("depth 1 task의 수직선 두께가 4px이다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: depth=1인 child-1의 border-left-width가 4px
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const borderWidth = await child1.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).borderLeftWidth;
      });
      expect(borderWidth).toBe("4px");
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
