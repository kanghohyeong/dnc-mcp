import { describe, it, expect, beforeEach, vi } from "vitest";
import { HistoryService } from "../../../src/services/history-service.js";

describe("HistoryService", () => {
  let historyService: HistoryService;

  beforeEach(() => {
    // 싱글톤 인스턴스 초기화
    historyService = HistoryService.getInstance();
    historyService.clearHistory();
  });

  describe("싱글톤 패턴", () => {
    it("getInstance()는 항상 같은 인스턴스를 반환해야 함", () => {
      const instance1 = HistoryService.getInstance();
      const instance2 = HistoryService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("addHistory()", () => {
    it("히스토리를 추가하고 historyAdded 이벤트를 발생시켜야 함", () => {
      const eventSpy = vi.fn();
      historyService.on("historyAdded", eventSpy);

      const request = {};
      const response = { kst: "2026. 02. 07. 12:00:00" };

      historyService.addHistory("get_kst_time", request, response);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const entry = eventSpy.mock.calls[0][0];

      expect(entry).toMatchObject({
        toolName: "get_kst_time",
        request,
        response,
      });
      expect(entry.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(typeof entry.timestamp).toBe("number");
      expect(typeof entry.timestampKst).toBe("string");
    });

    it("여러 히스토리를 추가할 수 있어야 함", () => {
      historyService.addHistory("tool1", { input: 1 }, { output: 1 });
      historyService.addHistory("tool2", { input: 2 }, { output: 2 });
      historyService.addHistory("tool1", { input: 3 }, { output: 3 });

      const allHistory = historyService.getHistory();
      expect(allHistory).toHaveLength(3);
    });

    it("각 히스토리 엔트리는 고유한 ID를 가져야 함", () => {
      historyService.addHistory("get_kst_time", {}, { kst: "time1" });
      historyService.addHistory("get_kst_time", {}, { kst: "time2" });

      const history = historyService.getHistory();
      const ids = history.map((entry) => entry.id);

      expect(new Set(ids).size).toBe(2);
    });
  });

  describe("getHistory()", () => {
    beforeEach(() => {
      historyService.addHistory("get_kst_time", {}, { kst: "time1" });
      historyService.addHistory("other_tool", {}, { result: "other1" });
      historyService.addHistory("get_kst_time", {}, { kst: "time2" });
    });

    it("toolName 없이 호출하면 전체 히스토리를 반환해야 함", () => {
      const history = historyService.getHistory();
      expect(history).toHaveLength(3);
    });

    it("toolName으로 필터링할 수 있어야 함", () => {
      const history = historyService.getHistory("get_kst_time");
      expect(history).toHaveLength(2);
      expect(history.every((entry) => entry.toolName === "get_kst_time")).toBe(true);
    });

    it("존재하지 않는 toolName으로 필터링하면 빈 배열을 반환해야 함", () => {
      const history = historyService.getHistory("non_existent_tool");
      expect(history).toHaveLength(0);
    });

    it("반환된 히스토리는 원본 데이터와 독립적이어야 함 (불변성)", () => {
      const history1 = historyService.getHistory();
      const history2 = historyService.getHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe("clearHistory()", () => {
    it("전체 히스토리를 초기화해야 함", () => {
      historyService.addHistory("get_kst_time", {}, { kst: "time1" });
      historyService.addHistory("other_tool", {}, { result: "other1" });

      expect(historyService.getHistory()).toHaveLength(2);

      historyService.clearHistory();

      expect(historyService.getHistory()).toHaveLength(0);
    });

    it("clearHistory 후에도 새 히스토리를 추가할 수 있어야 함", () => {
      historyService.addHistory("get_kst_time", {}, { kst: "time1" });
      historyService.clearHistory();

      historyService.addHistory("get_kst_time", {}, { kst: "time2" });

      expect(historyService.getHistory()).toHaveLength(1);
    });
  });

  describe("이벤트 리스너 관리", () => {
    it("on()으로 리스너를 등록할 수 있어야 함", () => {
      const listener = vi.fn();
      historyService.on("historyAdded", listener);

      historyService.addHistory("get_kst_time", {}, { kst: "time1" });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("off()로 리스너를 제거할 수 있어야 함", () => {
      const listener = vi.fn();
      historyService.on("historyAdded", listener);
      historyService.off("historyAdded", listener);

      historyService.addHistory("get_kst_time", {}, { kst: "time1" });

      expect(listener).not.toHaveBeenCalled();
    });

    it("여러 리스너를 등록할 수 있어야 함", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      historyService.on("historyAdded", listener1);
      historyService.on("historyAdded", listener2);

      historyService.addHistory("get_kst_time", {}, { kst: "time1" });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe("timestampKst 포맷", () => {
    it("KST 타임스탬프는 '년. 월. 일. 시:분:초' 형식이어야 함", () => {
      const eventSpy = vi.fn();
      historyService.on("historyAdded", eventSpy);

      historyService.addHistory("get_kst_time", {}, { kst: "time1" });

      const entry = eventSpy.mock.calls[0][0];
      // 예: "2026. 02. 07. 12:00:00"
      expect(entry.timestampKst).toMatch(/^\d{4}\. \d{2}\. \d{2}\. \d{2}:\d{2}:\d{2}$/);
    });
  });
});
