---
name: dnc-divide
description: 기존 작업(job)을 더 작은 하위 작업들로 분할합니다. 분할 정복 전략의 '분할' 단계를 수행합니다.
argument-hint: [job-id]
disable-model-invocation: true
---

# DnC Divide — Job 분할

분할 정복 워크플로우의 '분할' 단계로, 기존 job을 더 작은 하위 작업들로 나눕니다.

## 데이터 구조 참고

### Job 상태값

- `pending`: 아직 시작되지 않음
- `in-progress`: 작업 진행 중
- `done`: 완료됨

### 디렉토리 구조

```
.dnc/
└── {root_job_id}/
    ├── job_relation.json
    └── specs/
        ├── {root_job_id}.md
        ├── {child_job_slug}.md
        └── ...
```

## 실행 단계

### 1단계: 기존 Job 스캔

- `.dnc/` 디렉토리에서 `*/job_relation.json` 패턴으로 파일들을 스캔합니다.
- 디렉토리명에서 root job ID를 추출합니다.
- 디렉토리가 없거나 JSON 파일이 없으면 사용자에게 안내합니다: "아직 생성된 job이 없습니다. `/dnc-new`로 먼저 root job을 생성하세요."

### 2단계: 분할할 Job 선택

- `$ARGUMENTS`에 job ID가 주어졌으면 해당 job을 찾습니다 (root job과 모든 하위 job을 재귀적으로 탐색).
- job ID가 없으면:
  - 모든 root job의 트리 구조를 표시합니다.
  - 사용자에게 AskUserQuestion 도구로 분할할 job ID를 선택하도록 요청합니다.
- 선택된 job이 이미 `done` 상태이면 사용자에게 알리고 중단합니다.
- 선택된 job에 이미 divided_jobs가 있으면, 추가 분할할지 사용자에게 확인합니다.

### 3단계: Spec 분석 및 분할 제안

- 선택된 job의 spec 마크다운 파일을 읽습니다.
- spec을 분석하여 하위 작업 목록을 제안합니다:
  - 각 하위 작업의 goal (목표)
  - 각 하위 작업의 예상 job ID
- 제안된 목록을 사용자에게 보여주고 AskUserQuestion으로 승인/수정을 요청합니다.

### 4단계: 하위 작업 Spec 작성

승인된 각 하위 작업에 대해:

1. job ID를 생성합니다 (`job-{slug}` 형식).
2. 사용자와 함께 spec 마크다운 파일을 작성합니다.
   - 파일 경로: `.dnc/{root_job_id}/specs/{child_job_slug}.md`
   - root_job_id는 해당 root job의 ID입니다 (최상위 job).
   - child_job_slug는 `job-` prefix를 제거한 slug입니다.
3. spec 파일의 구조:

```markdown
# {goal}

## 목표

{상세 설명}

## 요구사항

{요구사항 목록}

## 제약조건

{제약조건 목록 또는 "없음"}

## 완료 기준

{완료 기준 목록}
```

### 5단계: JSON 업데이트

1. 각 하위 작업을 부모 job의 `divided_jobs` 배열에 추가합니다:

```json
{
    "id": "{child_job_id}",
    "goal": "{child_goal}",
    "spec": ".dnc/{root_job_id}/specs/{child_job_slug}.md",
    "status": "pending",
    "divided_jobs": []
}
```

2. 부모 job의 status를 `in-progress`로 변경합니다.
3. root job JSON 파일을 저장합니다.

### 6단계: 결과 안내

사용자에게 다음 정보를 출력합니다:

- 분할된 작업 트리 (전체 구조 표시)
- 각 하위 작업의 spec 파일 경로
- 다음 단계 안내:
  - 하위 작업을 더 분할하려면 `/dnc-divide {job-id}`
  - 말단 작업을 구현하려면 `/dnc-conquer`
  - 전체 상태를 확인하려면 `/dnc-status`
