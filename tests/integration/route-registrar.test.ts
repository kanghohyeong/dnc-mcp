import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RouteRegistrar } from "../../src/services/route-registrar.js";
import { DncJobService } from "../../src/services/dnc-job-service.js";
import { createTestTaskWithHierarchy } from "../helpers/test-utils.js";
import type { Task } from "../../src/utils/dnc-utils.js";

describe("RouteRegistrar - 계층 구조 데이터 변환", () => {
  let routeRegistrar: RouteRegistrar;
  let mockDncJobService: DncJobService;

  beforeEach(() => {
    mockDncJobService = {
      getTaskById: vi.fn(),
      getAllRootTasks: vi.fn(),
    } as unknown as DncJobService;

    routeRegistrar = new RouteRegistrar(mockDncJobService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("addHtmlToTask - 계층 구조 처리", () => {
    it("3-level 계층 구조를 가진 task 데이터를 올바르게 변환한다", async () => {
      // Arrange
      const hierarchyTask = createTestTaskWithHierarchy();

      // Act
      // @ts-expect-error - private 메서드 테스트
      const result = await routeRegistrar.addHtmlToTask(hierarchyTask);

      // Assert - Root level
      expect(result.id).toBe("root-task");
      expect(result.acceptanceHtml).toContain("<h1>Root Acceptance</h1>");
      expect(result.acceptanceHtml).toContain("<strong>root</strong>");
      expect(result.tasks).toHaveLength(2);

      // Assert - Child level (child-1)
      const child1 = result.tasks[0];
      expect(child1.id).toBe("child-1");
      expect(child1.acceptanceHtml).toContain("<h2>Child 1 Acceptance</h2>");
      expect(child1.tasks).toHaveLength(1);

      // Assert - Grandchild level
      const grandchild1 = child1.tasks[0];
      expect(grandchild1.id).toBe("grandchild-1");
      expect(grandchild1.acceptanceHtml).toContain("<h3>Grandchild Acceptance</h3>");
      expect(grandchild1.tasks).toHaveLength(0);

      // Assert - Child level (child-2)
      const child2 = result.tasks[1];
      expect(child2.id).toBe("child-2");
      expect(child2.acceptanceHtml).toContain("<h2>Child 2 Acceptance</h2>");
      expect(child2.tasks).toHaveLength(0);
    });

    it("tasks 필드가 각 레벨에서 올바르게 유지된다", async () => {
      // Arrange
      const hierarchyTask = createTestTaskWithHierarchy();

      // Act
      // @ts-expect-error - private 메서드 테스트
      const result = await routeRegistrar.addHtmlToTask(hierarchyTask);

      // Assert - tasks 필드 존재 확인
      expect(result).toHaveProperty("tasks");
      expect(result.tasks[0]).toHaveProperty("tasks");
      expect(result.tasks[0].tasks[0]).toHaveProperty("tasks");
      expect(result.tasks[1]).toHaveProperty("tasks");
    });

    it("acceptanceHtml이 모든 레벨에 추가된다", async () => {
      // Arrange
      const hierarchyTask = createTestTaskWithHierarchy();

      // Act
      // @ts-expect-error - private 메서드 테스트
      const result = await routeRegistrar.addHtmlToTask(hierarchyTask);

      // Assert - acceptanceHtml 존재 확인
      expect(result).toHaveProperty("acceptanceHtml");
      expect(result.tasks[0]).toHaveProperty("acceptanceHtml");
      expect(result.tasks[0].tasks[0]).toHaveProperty("acceptanceHtml");
      expect(result.tasks[1]).toHaveProperty("acceptanceHtml");

      // Assert - HTML이 실제로 변환되었는지
      expect(result.acceptanceHtml).toMatch(/<h\d>/);
      expect(result.tasks[0].acceptanceHtml).toMatch(/<h\d>/);
      expect(result.tasks[0].tasks[0].acceptanceHtml).toMatch(/<h\d>/);
      expect(result.tasks[1].acceptanceHtml).toMatch(/<h\d>/);
    });
  });

  describe("계층 구조가 없는 경우", () => {
    it("빈 tasks 배열을 가진 task도 정상 처리한다", async () => {
      // Arrange
      const emptyTask: Task = {
        id: "empty-task",
        goal: "Empty task",
        acceptance: "# Empty Acceptance",
        status: "pending",
        tasks: [],
      };

      // Act
      // @ts-expect-error - private 메서드 테스트
      const result = await routeRegistrar.addHtmlToTask(emptyTask);

      // Assert
      expect(result.id).toBe("empty-task");
      expect(result.acceptanceHtml).toContain("<h1>Empty Acceptance</h1>");
      expect(result.tasks).toHaveLength(0);
    });

    it("Root task만 있는 경우 정상 처리한다", async () => {
      // Arrange
      const rootOnlyTask: Task = {
        id: "root-only",
        goal: "Root only task",
        acceptance: "Root acceptance",
        status: "done",
        tasks: [],
      };

      // Act
      // @ts-expect-error - private 메서드 테스트
      const result = await routeRegistrar.addHtmlToTask(rootOnlyTask);

      // Assert
      expect(result.id).toBe("root-only");
      expect(result.acceptanceHtml).toContain("<p>Root acceptance</p>");
      expect(result.tasks).toHaveLength(0);
    });
  });
});
