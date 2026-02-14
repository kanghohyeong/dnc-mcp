---
name: create-skill
description: 새로운 Claude Code skill을 생성합니다. skill 디렉토리와 SKILL.md 템플릿을 자동으로 만들어 줍니다.
argument-hint: [skill-name]
disable-model-invocation: true
---

# Create Skill

새로운 Claude Code skill의 뼈대를 생성하는 skill입니다.

## 실행 단계

### 1단계: 인자 검증

- `$ARGUMENTS`에서 skill 이름을 추출합니다.
- skill 이름이 없으면 사용자에게 입력을 요청합니다.
- skill 이름이 kebab-case가 아니면 자동으로 변환하고 사용자에게 알립니다. (예: `mySkill` → `my-skill`)
- `.claude/skills/<skill-name>/` 경로에 이미 파일이 존재하면, 덮어쓸지 사용자에게 확인합니다.

### 2단계: skill 용도 파악

사용자에게 AskUserQuestion 도구로 질문합니다:

- "이 skill이 수행할 작업은 무엇인가요?" (자유 입력)

### 3단계: frontmatter 옵션 결정

사용자에게 AskUserQuestion 도구로 다음 옵션들을 결정합니다:

1. **description** (필수): skill의 목적을 구체적으로 설명하는 문장. Claude가 자동 호출 여부를 판단하는 핵심 기준이므로, 어떤 상황에서 이 skill이 유용한지 명확하게 작성하도록 안내합니다.

2. **argument-hint**: 인자 힌트 문자열 (예: `[filename]`, `[issue-number]`, `[component-name]`). 필요 없으면 생략합니다.

3. **호출 방식**: 다음 중 선택
   - 자동 호출 허용 (기본값) — Claude가 상황에 맞으면 자동으로 이 skill을 호출할 수 있음
   - 수동 호출만 — `disable-model-invocation: true` 설정. 사용자가 `/skill-name`으로 직접 호출해야만 실행됨

4. **사용자 호출 가능 여부**: 다음 중 선택
   - 사용자 호출 가능 (기본값)
   - 사용자 호출 불가 — `user-invocable: false` 설정. Claude만 자동으로 호출할 수 있음

5. **도구 제한**: 다음 중 선택
   - 제한 없음 (기본값) — 모든 도구 사용 가능
   - 도구 제한 — `allowed-tools` 목록을 지정하여 특정 도구만 사용 가능하게 제한

6. **실행 컨텍스트**: 다음 중 선택
   - 메인 컨텍스트 (기본값) — 현재 대화 컨텍스트에서 실행
   - 격리 컨텍스트 — `context: fork` 또는 `context: agent` 설정. 별도 컨텍스트에서 실행

### 4단계: SKILL.md 파일 생성

- `.claude/skills/<skill-name>/` 디렉토리를 생성합니다.
- 사용자가 선택한 옵션을 반영하여 `SKILL.md` 파일을 생성합니다.
- frontmatter에는 기본값과 다른 옵션만 포함합니다 (기본값인 옵션은 생략).
- body에는 해당 skill이 수행할 작업 단계를 구체적으로 작성합니다.
- CLAUDE.md에 이미 정의된 전역 규칙(린팅, 테스트, 코드 스타일 등)은 body에 중복으로 넣지 않습니다.

생성할 SKILL.md의 구조:

```markdown
---
name: <skill-name>
description: <사용자가 작성한 description>
# 기본값이 아닌 옵션만 포함
---

# <Skill 제목>

<skill의 목적 한 줄 설명>

## 실행 단계

### 1단계: ...
- ...

### 2단계: ...
- ...
```

### 5단계: 결과 안내

사용자에게 다음 정보를 출력합니다:

- 생성된 파일 경로: `.claude/skills/<skill-name>/SKILL.md`
- 호출 방법: `/<skill-name>`으로 호출 가능 (user-invocable이 false가 아닌 경우)
- 다음 단계 안내: SKILL.md의 "실행 단계" 섹션을 프로젝트에 맞게 상세화할 것을 권장
