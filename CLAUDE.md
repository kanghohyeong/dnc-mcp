# 프로젝트 지침

이 문서는 Claude가 이 프로젝트에서 코드를 작성할 때 따라야 할 규칙들을 정의합니다.

## Lint 규칙

### ESLint 관련
- **eslint-disable 주석 사용 금지**: 코드에서 `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` 등의 주석을 사용하지 않습니다. Lint 오류가 발생하면 주석으로 무시하지 말고 근본적인 문제를 해결해야 합니다.
