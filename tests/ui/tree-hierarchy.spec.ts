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

  test.describe("트리 렌더링", () => {
    test("계층 구조가 화면에 표시된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: tree-item 요소들이 존재하는지
      const treeItems = page.locator('[data-testid^="tree-item-"]');
      const count = await treeItems.count();

      // Root task의 하위 task들 (child-1, child-2, grandchild-1) = 3개
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test("3-level 계층 구조가 올바른 depth로 렌더링된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: 각 레벨의 depth 확인
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const child2 = page.locator('[data-testid="tree-item-child-2"]');
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');

      await expect(child1).toBeVisible();
      await expect(child2).toBeVisible();

      // grandchild는 초기에 접혀있을 수 있음 (DOM에는 존재하지만 hidden)
      const grandchildExists = await grandchild1.count();
      expect(grandchildExists).toBeGreaterThan(0);
    });

    test("부모-자식 관계가 올바르게 표현된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: child-1 아래에 grandchild-1이 중첩되어 있는지
      const child1Container = page.locator('[data-testid="tree-item-child-1"]').locator("..");
      const grandchild1InChild1 = child1Container.locator('[data-testid="tree-item-grandchild-1"]');

      const exists = await grandchild1InChild1.count();
      expect(exists).toBeGreaterThan(0);
    });
  });

  test.describe("펼치기/접기 기능", () => {
    test("초기 상태: 자식 노드가 접혀있다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: grandchild가 숨겨져 있는지 (CSS로 hidden)
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');

      // hidden 또는 display: none 상태 확인
      const isHidden = await grandchild1.isHidden().catch(() => true);
      expect(isHidden).toBeTruthy();
    });

    test("토글 아이콘 클릭 시 자식 노드가 표시/숨김된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // When: child-1의 토글 아이콘 클릭 (직접 자식만 선택)
      const toggleIcon = page.locator(
        '[data-testid="tree-item-child-1"] > .tree-item-header .tree-toggle'
      );
      await toggleIcon.click();

      // Then: grandchild-1이 표시됨
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');
      await expect(grandchild1).toBeVisible();

      // When: 다시 토글 아이콘 클릭
      await toggleIcon.click();

      // Then: grandchild-1이 숨겨짐
      await expect(grandchild1).toBeHidden();
    });

    test("expanded 클래스가 토글된다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // When: child-1의 토글 아이콘 클릭 (직접 자식만 선택)
      const child1Item = page.locator('[data-testid="tree-item-child-1"]');
      const toggleIcon = page.locator(
        '[data-testid="tree-item-child-1"] > .tree-item-header .tree-toggle'
      );

      // 요소가 렌더링될 때까지 대기
      await expect(child1Item).toBeVisible();

      // 초기 상태: expanded 클래스 없음
      const initialClass = await child1Item.getAttribute("class");
      expect(initialClass).not.toMatch(/expanded/);

      // 펼치기
      await toggleIcon.click();

      // Then: expanded 클래스 추가
      await expect(child1Item).toHaveClass(/expanded/);

      // 접기
      await toggleIcon.click();

      // Then: expanded 클래스 제거
      await expect(child1Item).not.toHaveClass(/expanded/);
    });
  });

  test.describe("일괄 제어 버튼", () => {
    test("모두 펼치기 버튼이 모든 노드를 확장한다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // When: "모두 펼치기" 버튼 클릭
      const expandAllBtn = page.locator(
        'button:has-text("모두 펼치기"), button[data-action="expand-all"]'
      );
      await expandAllBtn.click();

      // Then: 모든 tree-item이 expanded 클래스를 가짐
      const child1 = page.locator('[data-testid="tree-item-child-1"]');

      await expect(child1).toHaveClass(/expanded/);
      // child2는 자식이 없어도 expanded 클래스를 가질 수 있음 (구현에 따라)

      // grandchild가 visible 상태인지 확인
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');
      await expect(grandchild1).toBeVisible();
    });

    test("모두 접기 버튼이 모든 노드를 축소한다", async ({ page }) => {
      // Given: task 상세 페이지 방문 및 모두 펼치기
      await page.goto(`${baseUrl}/${testTaskId}`);

      // subtasks 섹션이 렌더링될 때까지 대기
      await page.waitForSelector('[data-testid="subtasks-section"]', { timeout: 5000 });

      const expandAllBtn = page.locator('button:has-text("모두 펼치기")').first();
      await expandAllBtn.click();

      // When: "모두 접기" 버튼 클릭
      const collapseAllBtn = page.locator(
        'button:has-text("모두 접기"), button[data-action="collapse-all"]'
      );
      await collapseAllBtn.click();

      // Then: 모든 tree-item에서 expanded 클래스 제거
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');

      await expect(child1).not.toHaveClass(/expanded/);
      await expect(grandchild1).toBeHidden();
    });
  });

  test.describe("시각적 표현", () => {
    test("들여쓰기로 계층 구조가 표현된다", async ({ page }) => {
      // Given: task 상세 페이지 방문 및 모두 펼치기
      await page.goto(`${baseUrl}/${testTaskId}`);
      const expandAllBtn = page.locator(
        'button:has-text("모두 펼치기"), button[data-action="expand-all"]'
      );
      await expandAllBtn.click();

      // Then: 각 레벨마다 다른 padding-left 값
      const child1 = page.locator('[data-testid="tree-item-child-1"]');
      const grandchild1 = page.locator('[data-testid="tree-item-grandchild-1"]');

      const child1Style = await child1.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).paddingLeft;
      });

      const grandchildStyle = await grandchild1.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).paddingLeft;
      });

      // grandchild의 padding이 child보다 커야 함
      const child1Padding = parseInt(child1Style as string);
      const grandchildPadding = parseInt(grandchildStyle as string);

      expect(grandchildPadding).toBeGreaterThan(child1Padding);
    });

    test("토글 아이콘이 존재한다", async ({ page }) => {
      // Given: task 상세 페이지 방문
      await page.goto(`${baseUrl}/${testTaskId}`);

      // Then: child-1에 토글 아이콘 존재 (자식이 있음)
      const child1Toggle = page.locator(
        '[data-testid="tree-item-child-1"] > .tree-item-header .tree-toggle'
      );
      await expect(child1Toggle).toBeVisible();

      // child-2에는 토글 아이콘이 없거나 disabled (자식 없음)
      const child2 = page.locator('[data-testid="tree-item-child-2"]');
      const child2Toggle = child2.locator("> .tree-item-header .tree-toggle");
      const child2HasToggle = await child2Toggle.count();

      // 자식이 없으면 토글 아이콘이 없거나 보이지 않아야 함
      if (child2HasToggle > 0) {
        const isVisible = await child2Toggle.isVisible();
        expect(isVisible).toBeFalsy();
      }
    });
  });
});
