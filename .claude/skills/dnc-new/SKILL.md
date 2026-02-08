---
name: dnc-new
description: 분할 정복(Divide and Conquer) 작업 관리에서 새로운 최상위 작업(root job)을 생성합니다. 큰 구현 목표를 정의하고 spec을 작성합니다.
argument-hint: [goal]
disable-model-invocation: true
---

# DnC New — Root Job 생성

분할 정복(Divide and Conquer) 워크플로우의 시작점으로, 새로운 최상위 작업(root job)을 생성합니다.

## 데이터 구조

### JSON 파일 (`.dnc/{root_job_id}.json`)

```json
{
    "id": "job-{slug}",
    "goal": "목표 설명",
    "spec": ".dnc/specs/{root_job_id}/{root_job_id}.md",
    "status": "pending",
    "divided_jobs": []
}
```

### Job ID 규칙

- `job-{goal-based-slug}` 형식
- goal을 영문 kebab-case slug로 변환 (예: "인증 기능 구현" → `job-implement-auth`)

### Job 상태값

- `pending`: 아직 시작되지 않음
- `in-progress`: 작업 진행 중
- `done`: 완료됨

## 실행 단계

### 1단계: 인자 검증

- `$ARGUMENTS`에서 goal(최상위 목표)을 추출합니다.
- goal이 없으면 사용자에게 AskUserQuestion 도구로 입력을 요청합니다: "최상위 목표(goal)를 입력해 주세요."
- goal을 영문 kebab-case slug로 변환하여 job ID를 생성합니다 (예: "인증 기능 구현" → `job-implement-auth`).
- `.dnc/{root_job_id}.json` 파일이 이미 존재하면, 덮어쓸지 사용자에게 AskUserQuestion으로 확인합니다.

### 2단계: 디렉토리 구조 생성

- `.dnc/` 디렉토리를 생성합니다 (없으면).
- `.dnc/specs/{root_job_id}/` 디렉토리를 생성합니다.

### 3단계: Spec 마크다운 작성

사용자와 함께 `.dnc/specs/{root_job_id}/{root_job_id}.md` 파일을 작성합니다.

사용자에게 AskUserQuestion 도구로 다음 항목들을 순차적으로 질문합니다:

1. **목표 상세 설명**: "이 작업의 구체적인 목표를 설명해 주세요."
2. **요구사항**: "이 작업의 주요 요구사항을 나열해 주세요."
3. **제약조건**: "구현 시 지켜야 할 제약조건이 있나요?" (선택)
4. **완료 기준**: "이 작업이 완료되었다고 판단할 기준은 무엇인가요?"

수집한 정보를 아래 템플릿에 채워 spec 파일을 생성합니다:

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

### 4단계: JSON 파일 생성

`.dnc/{root_job_id}.json` 파일을 생성합니다:

```json
{
    "id": "{root_job_id}",
    "goal": "{사용자가 입력한 goal}",
    "spec": ".dnc/specs/{root_job_id}/{root_job_id}.md",
    "status": "pending",
    "divided_jobs": []
}
```

### 5단계: 결과 안내

사용자에게 다음 정보를 출력합니다:

- 생성된 JSON 파일 경로: `.dnc/{root_job_id}.json`
- 생성된 Spec 파일 경로: `.dnc/specs/{root_job_id}/{root_job_id}.md`
- 다음 단계 안내: `/dnc-divide`로 하위 작업 분할을 진행하세요.
