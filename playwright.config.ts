import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 테스트 디렉토리
  testDir: './tests',

  // 테스트 파일 패턴 (ui와 e2e 디렉토리)
  testMatch: ['**/ui/**/*.spec.ts', '**/e2e/**/*.spec.ts'],

  // 병렬 실행 설정
  fullyParallel: true,

  // CI 환경에서만 fail on console errors
  forbidOnly: !!process.env.CI,

  // 실패 시 재시도 (CI에서만)
  retries: process.env.CI ? 2 : 0,

  // 동시 실행 worker 수
  workers: process.env.CI ? 1 : undefined,

  // 리포터 설정
  reporter: 'html',

  // 공통 설정
  use: {
    // 베이스 URL
    baseURL: 'http://localhost:3331',

    // 스크린샷 설정
    screenshot: 'only-on-failure',

    // 비디오 설정
    video: 'retain-on-failure',

    // 타임아웃
    actionTimeout: 10000,
  },

  // 프로젝트별 설정
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 웹 서버 설정 (테스트 전 자동 시작)
  webServer: {
    command: 'npm run build && node dist/index.js',
    url: 'http://localhost:3331',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'test',
    },
  },
});
