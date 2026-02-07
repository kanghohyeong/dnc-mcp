import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node 환경 지정
    environment: 'node',

    // 환경 변수 설정
    env: {
      NODE_ENV: 'test',
    },

    // 글로벌 테스트 유틸리티 활성화
    globals: true,

    // 테스트 파일 패턴
    include: ['tests/**/*.test.ts'],

    // 테스트 설정 파일
    setupFiles: ['./test-setup.ts'],

    // 커버리지 설정
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        'tests/',
        '**/*.config.ts',
        '**/*.d.ts',
        'test-setup.ts',
        'src/index.ts', // MCP 서버 엔트리포인트
        'src/tools/example-tool.ts', // 참고용 예제 파일
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // 타입 체크 플러그인
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },
  },
});
