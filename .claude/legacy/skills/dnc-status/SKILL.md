---
name: dnc-status
description: 분할 정복 작업의 전체 진행 상태를 트리 구조로 조회합니다.
argument-hint: [root-job-id]
disable-model-invocation: true
---

# DnC Status — 작업 상태 조회

분할 정복 워크플로우의 전체 진행 상태를 트리 구조로 표시합니다.

## 상태 아이콘

- `done` → done
- `in-progress` → in-progress
- `pending` → pending

## 실행 단계

### 1단계: Job 파일 스캔

- `.dnc/` 디렉토리에서 `*/job_relation.json` 패턴으로 파일들을 스캔합니다.
- 디렉토리명에서 root job ID를 추출합니다 (예: `.dnc/job-implement-auth/job_relation.json` → `job-implement-auth`).
- 디렉토리가 없거나 JSON 파일이 없으면 사용자에게 안내합니다: "아직 생성된 job이 없습니다. `/dnc-new`로 먼저 root job을 생성하세요."

### 2단계: 표시 범위 결정

- `$ARGUMENTS`에 root job ID가 주어졌으면 해당 root job만 표시합니다.
  - 해당 ID의 JSON 파일이 없으면 사용자에게 알립니다.
- 인자가 없으면 모든 root job을 표시합니다.

### 3단계: 트리 구조 출력

각 root job에 대해 다음과 같은 트리 구조를 출력합니다:

```
📋 implement-auth (in-progress)
├── 🔄 implement-oauth (in-progress)
│   ├── ✅ google-oauth (done)
│   └── ⏳ naver-oauth (pending)
└── ⏳ implement-login-ui (pending)
```

트리 구조 규칙:
- 들여쓰기는 `│   `, `├── `, `└── ` 를 사용합니다.
- 각 job은 `{상태아이콘} {job-id에서 job- prefix 제거} ({status})` 형식으로 표시합니다.
- 상태 아이콘: ✅ (done), 🔄 (in-progress), ⏳ (pending)
- 하위 작업이 있으면 재귀적으로 들여쓰기하여 표시합니다.

### 4단계: 요약 통계 출력

트리 출력 아래에 요약 통계를 출력합니다:

```
---
📊 요약: 전체 5개 작업 | ✅ 완료 1개 | 🔄 진행중 2개 | ⏳ 대기 2개 | 진행률 20%
```

통계 계산 규칙:
- **전체 job 수**: 트리의 모든 job을 재귀적으로 카운트합니다.
- **진행률**: (done 수 / 전체 수) * 100, 소수점 버림.
- 여러 root job이 있으면 각 root job별 통계 + 전체 합산 통계를 모두 표시합니다.

### 5단계: 다음 단계 안내

현재 상태에 따라 적절한 다음 단계를 안내합니다:

- pending인 leaf job이 있으면: "다음 작업을 구현하려면 `/dnc-conquer`를 실행하세요."
- 분할되지 않은 pending job이 있으면: "작업을 분할하려면 `/dnc-divide {job-id}`를 실행하세요."
- 모든 job이 done이면: "모든 작업이 완료되었습니다! 🎉"
