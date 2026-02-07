import { test, expect } from '@playwright/test';

test.describe('MCP 서버 E2E 플로우', () => {
  test('MCP 서버 시작 시 웹 페이지 정상 동작', async ({ page }) => {
    // MCP 서버가 자동으로 시작되고 웹 서버가 실행됨 (playwright.config.ts의 webServer 설정)

    // 웹 페이지 접속
    await page.goto('/');

    // "hello world" 페이지가 정상적으로 로드되는지 확인
    await expect(page.locator('h1')).toHaveText('hello world');
    await expect(page).toHaveTitle('Interlock MCP Server');
  });

  test('서버가 올바른 포트에서 응답', async ({ page }) => {
    // 설정된 포트(3331)에서 응답하는지 확인
    const response = await page.goto('/health');

    expect(response?.status()).toBe(200);
    expect(response?.url()).toContain('localhost:3331');
  });

  test('전체 사용자 플로우: 접속 → 페이지 확인 → health check', async ({
    page,
  }) => {
    // 1. 메인 페이지 접속
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    // 2. "hello world" 텍스트 확인
    const heading = page.locator('h1');
    await expect(heading).toHaveText('hello world');

    // 3. health check 엔드포인트 접속
    const healthResponse = await page.goto('/health');
    expect(healthResponse?.status()).toBe(200);

    const healthData = await healthResponse?.json();
    expect(healthData).toEqual({
      status: 'ok',
      message: 'MCP server is running',
    });

    // 4. 메인 페이지로 다시 돌아가기
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('hello world');
  });

  test('CSS 애니메이션이 적용되었는지 확인', async ({ page }) => {
    await page.goto('/');

    const heading = page.locator('h1');

    // h1 요소에 animation이 적용되었는지 확인
    const animationName = await heading.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue('animation-name'),
    );

    expect(animationName).toContain('fadeIn');
  });

  test('404 페이지 처리', async ({ page }) => {
    const response = await page.goto('/non-existent-page', {
      waitUntil: 'domcontentloaded',
    });

    expect(response?.status()).toBe(404);
  });
});
