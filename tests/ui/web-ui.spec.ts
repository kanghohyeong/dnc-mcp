import { test, expect } from "@playwright/test";

test.describe("웹 UI 테스트", () => {
  test('페이지 접속 및 "Task Management" 표시 확인', async ({ page }) => {
    // 페이지 접속
    await page.goto("/");

    // 페이지 제목 확인
    await expect(page).toHaveTitle(/Task Management/);

    // "Task Management" 텍스트가 h1 태그에 표시되는지 확인
    const heading = page.locator("h1");
    await expect(heading).toHaveText("Task Management");
    await expect(heading).toBeVisible();
  });
});
