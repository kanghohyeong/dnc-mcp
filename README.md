# interlock_mcp

TypeScript로 작성된 Model Context Protocol용 MCP 서버입니다.

## 설명

Node.js와 TypeScript를 사용한 MCP (Model Context Protocol) 서버 구현체입니다. Model Context Protocol은 LLM을 외부 데이터 소스 및 도구에 연결하기 위한 Anthropic의 표준 프로토콜입니다.

## 사전 요구사항

- Node.js >= 16.0.0
- npm 또는 yarn

## 설치

```bash
npm install
```

## 개발 명령어

### 빌드

TypeScript를 JavaScript로 컴파일:

```bash
npm run build
```

### 감시 모드

개발 중 파일 변경 시 자동으로 재빌드:

```bash
npm run watch
```

### 서버 실행

컴파일된 MCP 서버 시작:

```bash
npm start
```

참고: 실행하기 전에 먼저 프로젝트를 빌드해야 합니다.

### 코드 품질

#### 린팅

ESLint로 코드 스타일 검사:

```bash
npm run lint
```

린팅 이슈 자동 수정:

```bash
npm run lint:fix
```

#### 포맷팅

Prettier로 코드 포맷:

```bash
npm run format
```

파일 수정 없이 포맷팅 검사 (CI에 유용):

```bash
npm run format:check
```

#### 타입 검사

파일 생성 없이 TypeScript 타입 검사 실행:

```bash
npm run typecheck
```

### 디버깅

대화형 디버깅을 위한 MCP Inspector 실행:

```bash
npm run inspector
```

## 프로젝트 구조

```
interlock_mcp/
├── src/              # TypeScript 소스 파일
│   └── index.ts      # 메인 서버 진입점
├── build/            # 컴파일된 JavaScript 출력 (git 무시됨)
├── node_modules/     # 의존성 (git 무시됨)
├── package.json      # 프로젝트 메타데이터 및 의존성
├── tsconfig.json     # TypeScript 설정
├── .eslintrc.json    # ESLint 설정
├── .prettierrc       # Prettier 설정
└── README.md         # 이 파일
```

## 개발 워크플로우

1. **빌드**: `npm run build`로 TypeScript 코드 컴파일
2. **테스트**: `npm start`로 서버 실행 또는 `npm run inspector`로 디버깅
3. **포맷**: `npm run format`으로 코드가 올바르게 포맷되었는지 확인
4. **린트**: `npm run lint`로 코드 품질 검사

활발한 개발을 위해서는 `npm run watch`를 사용하여 변경 시 자동으로 재빌드하세요.

## 중요 사항

### STDIO Transport 로깅

이 서버는 MCP 클라이언트와의 통신을 위해 STDIO transport를 사용합니다. **로깅에는 항상 `console.error()`를 사용**해야 하며, 절대 `console.log()`를 사용하지 마세요. `console.log()`를 사용하면 stdout이 MCP 프로토콜 메시지용으로 예약되어 있어 프로토콜 통신에 간섭이 발생합니다.

✅ 올바른 예:
```typescript
console.error("Server started");
```

❌ 잘못된 예:
```typescript
console.log("Server started"); // STDIO 통신을 방해합니다
```

### 스키마 검증

이 프로젝트는 MCP SDK의 필수 피어 의존성인 Zod를 스키마 검증에 사용합니다. 스키마 검증은 도구 인자 및 응답에 대한 타입 안정성을 보장합니다.

### 실행 전 빌드

`npm start`를 실행하기 전에 항상 `npm run build`를 실행하세요. 서버는 TypeScript 소스 파일이 아닌 `build/` 디렉토리의 컴파일된 JavaScript를 실행합니다.

## 도구 추가하기

MCP 서버에 새로운 도구를 추가하려면:

1. `src/index.ts`에서 `registerTool`을 사용하여 도구 정의
2. 도구 로직 구현
3. 필요한 경우 Zod 스키마를 사용하여 입력 검증
4. `npm run build`로 재빌드
5. `npm run inspector`로 테스트

도구 구조 예시는 `src/index.ts`의 주석으로 제공되어 있습니다.

## 라이선스

MIT
