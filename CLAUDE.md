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
