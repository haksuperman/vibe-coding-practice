---
name: mvp-code-review
description: Review changed or staged code for correctness bugs, security issues (XSS / unsafe DOM), accessibility, state/persistence robustness, and clarity. Use when reviewing a diff, a PR, or before committing in this vanilla HTML/CSS/JS MVP project.
---

# MVP 코드 리뷰 스킬

이 프로젝트(바닐라 HTML/CSS/JS 단일 파일 MVP)의 변경분을 빠르고 일관되게 리뷰하기 위한 체크리스트와 절차입니다.

> 이름이 `mvp-code-review`인 이유: 내장 `/code-review` 스킬과 충돌하지 않도록 프로젝트 전용으로 분리했습니다.

## 절차

1. **변경 범위 파악** — 우선 변경된 내용만 본다.
   - git 저장소면: `git diff` (스테이지된 것은 `git diff --cached`)
   - git이 아니면: 사용자가 지목한 파일(보통 `index.html`)을 읽는다.
2. 아래 체크리스트로 훑는다. 해당 없는 항목은 건너뛴다.
3. **발견 사항만** 보고한다. 문제가 없으면 "이상 없음"이라고 명확히 말한다.

## 체크리스트

### 1. 정확성 (Correctness)
- 경계/엣지 케이스: 빈 배열, 후보가 0개, 마지막 1개 제외 시 빈 풀 등 가드가 있는가
- 상태 변수(`selectedCategories`, `lastPicked`, `history`, `menus`)가 모든 경로에서 일관되게 갱신되는가
- 비동기/타이머(`setTimeout` 슬롯 애니메이션) 중복 실행·중첩 방지(`isSpinning`)가 되는가
- off-by-one, 잘못된 비교(`==` vs `===`), 잘못된 필터 조건이 없는가

### 2. 보안 (Security)
- **XSS**: 사용자 입력(메뉴 이름 등)을 `innerHTML`로 넣지 않는가. `textContent`/`createElement`로 안전하게 렌더하는가
- localStorage에서 읽은 값을 검증 없이 신뢰하지 않는가(타입/허용값 체크)
- `eval`, `new Function`, 위험한 동적 실행이 없는가

### 3. 데이터/영속성 (State & Persistence)
- `JSON.parse`가 `try/catch`로 감싸져 있고, 깨진/부재 데이터에 폴백이 있는가
- 구버전 저장 포맷에 대한 마이그레이션이 깨지지 않는가
- 저장(`saveState`) 호출이 상태를 바꾸는 모든 지점에 빠짐없이 있는가

### 4. 접근성 (Accessibility)
- 인터랙티브 요소가 실제 `<button>`/`<input>`이고 `aria-label`이 적절한가
- 색만으로 정보를 전달하지 않는가(카테고리 색 + 텍스트 라벨 병행 등)
- 키보드로 조작 가능한가(포커스 가능한 요소 사용)

### 5. 가독성/유지보수 (Clarity)
- 매직 넘버/문자열이 상수로 분리돼 있는가(`CATEGORY_COLOR`, `STORAGE_KEY` 등)
- 중복 로직을 함수로 묶을 수 있는가
- 함수/변수 이름이 의도를 드러내는가
- 죽은 코드, 사용하지 않는 변수/CSS 규칙이 남아있지 않은가

### 6. 회귀 (Regression)
- 이번 변경이 기존 기능(추천, 필터, 최근 제외, 기록, 추가/삭제, 저장)을 깨지 않는가
- 제거한 식별자(예: 삭제한 DOM id/클래스) 참조가 코드에 남아있지 않은가 — `grep`으로 확인

## 보고 형식

발견 사항을 심각도와 위치로 정리한다:

```
## 코드 리뷰 결과

### 🔴 (Must fix) 정확성/보안 문제
- `index.html:123` — <문제> → <제안>

### 🟡 (Should fix) 개선 권장
- `index.html:200` — <문제> → <제안>

### 🟢 (Nit) 사소한 제안
- ...

요약: <한두 줄 총평>
```

- 각 항목은 **파일:라인**과 **구체적 수정 제안**을 함께 적는다.
- 추측성 지적은 "확실치 않음"이라고 표시한다.
- 문제가 없으면 군더더기 없이 "이상 없음"으로 끝낸다.
