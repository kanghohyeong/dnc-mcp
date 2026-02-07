import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openBrowser } from "../../../src/utils/browser-launcher.js";

// open 패키지 모킹
vi.mock("open", () => ({
  default: vi.fn(),
}));

describe("browser-launcher", () => {
  let mockOpen: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // open 패키지 모킹 설정
    const openModule = await import("open");
    mockOpen = openModule.default as ReturnType<typeof vi.fn>;
    mockOpen.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("openBrowser", () => {
    it("should open valid HTTP URL", async () => {
      const url = "http://localhost:3331";

      await openBrowser(url);

      expect(mockOpen).toHaveBeenCalledWith(url);
      expect(mockOpen).toHaveBeenCalledTimes(1);
    });

    it("should open valid HTTPS URL", async () => {
      const url = "https://example.com";

      await openBrowser(url);

      expect(mockOpen).toHaveBeenCalledWith(url);
      expect(mockOpen).toHaveBeenCalledTimes(1);
    });

    it("should throw error for invalid URL", async () => {
      const invalidUrl = "not-a-url";

      await expect(openBrowser(invalidUrl)).rejects.toThrow("Invalid URL");
    });

    it("should throw error when browser fails to open", async () => {
      const url = "http://localhost:3331";
      const browserError = new Error("Browser not found");
      mockOpen.mockRejectedValueOnce(browserError);

      await expect(openBrowser(url)).rejects.toThrow("Failed to open browser: Browser not found");
    });

    it("should handle non-Error exceptions", async () => {
      const url = "http://localhost:3331";
      mockOpen.mockRejectedValueOnce("String error");

      await expect(openBrowser(url)).rejects.toThrow("Failed to open browser: String error");
    });
  });
});
