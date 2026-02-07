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

모든 검증을 통과한 후에만 작업을 완료한 것으로 간주합니다.

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
