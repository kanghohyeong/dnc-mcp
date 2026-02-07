import { test, expect } from "@playwright/test";

test.describe("웹 UI 테스트", () => {
  test('페이지 접속 및 "hello world" 표시 확인', async ({ page }) => {
    // 페이지 접속
    await page.goto("/");

    // 페이지 제목 확인
    await expect(page).toHaveTitle("Interlock MCP Server");

    // "hello world" 텍스트가 h1 태그에 표시되는지 확인
    const heading = page.locator("h1");
    await expect(heading).toHaveText("hello world");
    await expect(heading).toBeVisible();
  });

  test("페이지 스타일 확인", async ({ page }) => {
    await page.goto("/");

    const heading = page.locator("h1");

    // h1 요소가 존재하는지 확인
    await expect(heading).toBeVisible();

    // 폰트 크기가 적용되었는지 확인 (4rem)
    const fontSize = await heading.evaluate<string>((el: HTMLElement): string => {
      const w = globalThis as typeof window;
      const computed = w.getComputedStyle(el as Element);
      return computed.getPropertyValue("font-size");
    });
    expect(fontSize).toBeTruthy();

    // 색상이 적용되었는지 확인
    const color = await heading.evaluate<string>((el: HTMLElement): string => {
      const w = globalThis as typeof window;
      const computed = w.getComputedStyle(el as Element);
      return computed.getPropertyValue("color");
    });
    expect(color).toBeTruthy();
  });

  test("health 엔드포인트 확인", async ({ page }) => {
    const response = await page.goto("/health");

    expect(response?.status()).toBe(200);

    const json = (await response?.json()) as { status: string; message: string };
    expect(json).toEqual({
      status: "ok",
      message: "MCP server is running",
    });
  });

  test("반응형 레이아웃 확인", async ({ page }) => {
    await page.goto("/");

    // body가 flexbox로 중앙 정렬되는지 확인
    const bodyDisplay = await page.evaluate<string>((): string => {
      const w = globalThis as typeof window;
      const d = globalThis.document as Document;
      const computed = w.getComputedStyle(d.body as Element);
      return computed.getPropertyValue("display");
    });
    expect(bodyDisplay).toBe("flex");

    // h1이 화면에 표시되는지 확인
    const heading = page.locator("h1");
    await expect(heading).toBeInViewport();
  });
});
