# 프로젝트 지침

이 문서는 Claude가 이 프로젝트에서 코드를 작성할 때 따라야 할 규칙들을 정의합니다.

## Lint 규칙

### ESLint 관련
- **eslint-disable 주석 사용 금지**: 코드에서 `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` 등의 주석을 사용하지 않습니다. Lint 오류가 발생하면 주석으로 무시하지 말고 근본적인 문제를 해결해야 합니다.

### 작업 완료 전 검증
코드 작성을 완료한 후, 반드시 다음 검증을 수행해야 합니다:

1. **타입 검사**: `npm run typecheck`로 TypeScript 타입 오류가 없는지 확인
2. **린팅**: `npm run lint`로 코드 스타일 검사 (필요시 `npm run lint:fix`로 자동 수정)
3. **포맷팅**: `npm run format:check`로 코드 포맷팅 확인 (필요시 `npm run format`으로 포맷 적용)
4. **테스트**: `npm run test`로 모든 테스트 통과 확인

모든 검증을 통과한 후에만 작업을 완료한 것으로 간주합니다.

## 테스트 규칙

### TDD 워크플로우

새로운 기능 구현 시 **반드시 테스트를 먼저 작성**해야 합니다 (Test-Driven Development):

#### 테스트 케이스 계획 및 확인

- TDD 작업 시작 전, **작성할 테스트 케이스 목록을 사용자에게 제시하고 승인을 받아야** 합니다
- 제시할 내용:
  - 정상 동작 케이스
  - 에러 처리 케이스
  - 경계값 테스트 케이스
  - 기타 예외 상황 케이스
- 사용자 승인 후 테스트 작성을 시작합니다

#### TDD 사이클

1. **Red**: 실패하는 테스트 작성

2. **Green**: 테스트를 통과하는 최소 코드 작성

3. **Refactor**: 코드 개선 및 커버리지 확인
   - `npm run test:coverage`로 커버리지 80% 이상 유지

### 테스트 작성 규칙

#### 테스트 파일 위치

- **단위 테스트**: `tests/unit/` - 개별 함수/클래스 테스트
  - 도구: `tests/unit/tools/`
  - 서비스: `tests/unit/services/`
  - 유틸리티: `tests/unit/utils/`

- **통합 테스트**: `tests/integration/` - 모듈 간 상호작용 테스트

- **UI 테스트**: `tests/ui/` - Playwright로 웹 페이지 UI 검증

- **E2E 테스트**: `tests/e2e/` - 전체 시스템 플로우 테스트

#### 테스트 파일 명명 규칙

- Vitest: `*.test.ts` (예: `get-kst-time.test.ts`)
- Playwright: `*.spec.ts` (예: `web-ui.spec.ts`)

#### 필수 테스트 항목

새로운 코드 작성 시 다음을 반드시 테스트해야 합니다:

1. **정상 동작 케이스**: 기대하는 입력에 대한 정상 출력
2. **에러 처리**: 잘못된 입력 또는 예외 상황 처리
3. **경계값 테스트**: 최소값, 최대값, 빈 값 등
4. **모킹**: 외부 의존성은 `vi.mock()`으로 격리

#### 테스트 헬퍼 활용

반복되는 테스트 설정은 `tests/helpers/test-utils.ts`의 헬퍼 함수를 사용:

- `createTestMcpServer()`: MCP 서버 테스트 인스턴스 생성
- `createTestWebServer()`: 웹 서버 테스트 인스턴스 생성
- `mockKstTime(isoString)`: Date 모킹
- `waitForServer(server)`: 서버 준비 대기

### 테스트 명령어

#### 개발 중 (빠른 피드백)

```bash
npm run test:watch         # Watch 모드 (파일 변경 시 자동 재실행)
npm run test:vitest:ui     # 브라우저 UI 모드
npm run test:unit          # 단위 테스트만
npm run test:integration   # 통합 테스트만
```

#### 검증 (커밋 전)

```bash
npm run test              # 전체 테스트 (Vitest + Playwright)
npm run test:coverage     # 커버리지 확인 (80% 이상 필수)
```

#### Playwright 테스트

```bash
npm run test:playwright   # 모든 Playwright 테스트
npm run test:ui           # UI 테스트만
npm run test:e2e          # E2E 테스트만
npm run test:playwright:ui # Playwright UI 모드
npm run test:playwright:debug # 디버그 모드
```

### 커버리지 목표

- **Lines/Functions/Statements**: 80% 이상
- **Branches**: 75% 이상


### 테스트 작성 금지 사항

- ❌ `eslint-disable` 주석 사용하지 않음
- ❌ 테스트 없이 새로운 함수/클래스 추가하지 않음
- ❌ 실패하는 테스트를 커밋하지 않음
- ❌ 커버리지를 낮추는 코드 작성하지 않음

## 프로젝트 구조

### MCP 도구 모듈화

모든 MCP 도구 구현은 **반드시** `src/tools/` 디렉토리에 개별 파일로 작성해야 합니다.

**금지**: `src/index.ts`에 도구 로직을 직접 작성
**권장**: `src/tools/` 디렉토리에 별도 파일로 분리

### 새로운 도구 추가 절차

1. **파일 생성**: `src/tools/도구명.ts` 생성
   - 파일명은 kebab-case 사용 (예: `get-kst-time.ts`)

2. **도구 구현**: 다음 패턴을 따라 작성
   ```typescript
   import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

   export function register도구명Tool(mcpServer: McpServer) {
     mcpServer.registerTool(
       "tool_name",  // snake_case
       {
         description: "도구 설명",
         inputSchema: {},
       },
       (args) => {
         // 도구 로직
         return {
           content: [{ type: "text", text: "결과" }],
         };
       }
     );
   }
   ```

3. **메인 파일 수정**: `src/index.ts`에서
   - import 문 추가: `import { register도구명Tool } from "./tools/도구명.js";`
   - 도구 등록: `register도구명Tool(mcpServer);`

### 명명 규칙

- **도구 파일명**: kebab-case (예: `get-kst-time.ts`)
- **등록 함수명**: camelCase, `register로시작` (예: `registerGetKstTimeTool`)
- **도구 이름**: snake_case (예: `get_kst_time`)
- **import 확장자**: 항상 `.js` 사용 (TypeScript ESM 규칙)

### 도구 파일 구조 원칙

- 각 도구는 하나의 파일에 하나의 등록 함수만 export
- 도구 로직이 복잡한 경우 내부 헬퍼 함수를 같은 파일에 작성 가능
- 여러 도구가 공유하는 유틸리티는 `src/utils/` 디렉토리에 별도 관리

## 코드베이스 탐색

### Serena MCP 도구 활용

코드베이스 탐색 시 Serena MCP의 semantic 도구를 우선적으로 사용해야 합니다.

- **금지**: Read 도구로 전체 파일을 무분별하게 읽기
- **권장**: Serena 도구(`get_symbols_overview`, `find_symbol` 등)로 필요한 심볼만 선택적으로 읽기
- **원칙**: 토큰 효율적이고 단계적인 정보 수집

## 코드 작성 원칙

### 단일 책임 원칙 (Single Responsibility Principle)

모든 코드는 단일 책임 원칙을 따라야 합니다:

- **원칙**: 하나의 클래스/함수/모듈은 하나의 책임만 가져야 합니다
- **목표**: 책임이 비대해지지 않도록 코드를 작성합니다
- **실천 방법**:
  - 함수는 하나의 작업만 수행하도록 작성
  - 클래스는 하나의 목적을 위해 존재하도록 설계
  - 책임이 커지면 여러 개의 작은 단위로 분리
  - 함수/클래스 이름이 "And", "Or"를 포함하면 분리 고려

### 책임 분리 기준

다음 징후가 보이면 코드를 분리해야 합니다:

- 함수가 30줄 이상인 경우
- 함수가 3개 이상의 다른 작업을 수행하는 경우
- 클래스가 5개 이상의 public 메서드를 가지는 경우
- 한 파일에 너무 많은 로직이 집중된 경우 (300줄 초과)
- 코드 재사용이 어려운 구조인 경우
