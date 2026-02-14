---
name: dnc-conquer
description: 분할 정복 작업의 말단 작업(leaf job)을 실제로 구현합니다. spec을 읽고 TDD 워크플로우에 따라 코드를 작성합니다.
argument-hint: [job-id]
disable-model-invocation: true
---

# DnC Conquer — Leaf Job 구현

분할 정복 워크플로우의 '정복' 단계로, 말단(leaf) job의 spec을 읽고 실제 코드를 구현합니다.

## 데이터 구조 참고

### Job 상태값

- `pending`: 아직 시작되지 않음
- `in-progress`: 작업 진행 중
- `done`: 완료됨

### Leaf Job 조건

- `divided_jobs`가 비어있는 job (`[]`)
- `status`가 `pending`인 job

## 실행 단계

### 1단계: 기존 Job 스캔

- `.dnc/` 디렉토리에서 `*/job_relation.json` 패턴으로 파일들을 스캔합니다.
- 디렉토리명에서 root job ID를 추출합니다.
- 디렉토리가 없거나 JSON 파일이 없으면 사용자에게 안내합니다: "아직 생성된 job이 없습니다. `/dnc-new`로 먼저 root job을 생성하세요."

### 2단계: 실행할 Leaf Job 선택

- `$ARGUMENTS`에 job ID가 주어졌으면 해당 job을 찾습니다 (모든 root job의 트리를 재귀적으로 탐색).
  - 찾은 job이 leaf job이 아니면 (divided_jobs가 비어있지 않으면) 사용자에게 알리고 중단합니다.
  - 찾은 job이 이미 `done` 상태이면 사용자에게 알리고 중단합니다.
- job ID가 없으면:
  - 모든 root job의 트리에서 실행 가능한 leaf job 목록을 추출합니다 (divided_jobs가 비어있고, status가 `pending`인 job).
  - 목록이 비어있으면 사용자에게 안내합니다: "실행 가능한 leaf job이 없습니다."
  - 목록을 표시하고 사용자에게 AskUserQuestion으로 실행할 job을 선택하도록 요청합니다.

### 3단계: Spec 읽기 및 분석

- 선택된 job의 spec 마크다운 파일을 읽습니다.
- spec의 목표, 요구사항, 제약조건, 완료 기준을 파악합니다.
- 해당 job의 status를 `in-progress`로 변경하고 JSON 파일을 저장합니다.

### 4단계: TDD 워크플로우에 따른 구현

CLAUDE.md의 TDD 워크플로우 규칙을 따라 구현합니다:

1. **테스트 케이스 계획**: spec을 바탕으로 테스트 케이스 목록을 작성합니다.
   - 정상 동작 케이스
   - 에러 처리 케이스
   - 경계값 테스트 케이스
   - 기타 예외 상황 케이스
2. **사용자 승인**: 테스트 케이스 목록을 사용자에게 제시하고 승인을 받습니다.
3. **Red-Green-Refactor 사이클**:
   - **Red**: 실패하는 테스트 작성
   - **Green**: 테스트를 통과하는 최소 코드 작성
   - **Refactor**: 코드 개선

### 5단계: 구현 완료 검증

다음 검증을 모두 수행합니다:

1. `npm run typecheck` — TypeScript 타입 오류 없음
2. `npm run lint` — 코드 스타일 검사 통과 (필요시 `npm run lint:fix`)
3. `npm run format:check` — 포맷팅 확인 (필요시 `npm run format`)
4. `npm run test` — 모든 테스트 통과
5. `npm run test:coverage` — 커버리지 80% 이상 유지

모든 검증을 통과해야 합니다.

### 6단계: 상태 업데이트

1. 해당 job의 status를 `done`으로 변경합니다.
2. **재귀적 부모 상태 업데이트**: 부모 job의 모든 `divided_jobs`가 `done`이면 부모 job의 status도 `done`으로 변경합니다. 이를 root job까지 재귀적으로 수행합니다.
3. root job JSON 파일을 저장합니다.

### 7단계: 결과 안내

사용자에게 다음 정보를 출력합니다:

- 완료된 job ID와 goal
- 구현한 코드 파일 목록
- 작성한 테스트 파일 목록
- 상태 변경 내역 (부모 job 자동 완료 포함)
- 현재 전체 진행 상태 요약 (완료/전체)
- 다음 단계 안내:
  - 다음 leaf job을 구현하려면 `/dnc-conquer`
  - 전체 상태를 확인하려면 `/dnc-status`
