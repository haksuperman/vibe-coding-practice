# code-review-kit

바닐라 HTML/CSS/JS MVP를 위한 코드 리뷰 + 커밋 게이트 플러그인. 세 가지 구성요소를 하나로 묶었다.

## 구성요소

| 종류 | 이름 | 설명 |
|---|---|---|
| Skill | `mvp-code-review` | 정확성·보안(XSS)·영속성·접근성·가독성·회귀 체크리스트와 보고 형식 |
| Subagent | `code-reviewer` | 위 스킬을 호출해 변경분을 리뷰하는 읽기 전용 에이전트 |
| Hook | `PreToolUse`(Bash) | `git commit` 시도 시 lint/build/test를 돌리고 실패하면 커밋 차단(exit 2) |

## 디렉터리 구조

```
code-review-kit/
├── .claude-plugin/plugin.json   # 플러그인 매니페스트
├── skills/mvp-code-review/SKILL.md
├── agents/code-reviewer.md
└── hooks/
    ├── hooks.json               # PreToolUse 훅 등록 (${CLAUDE_PLUGIN_ROOT} 사용)
    └── pre-commit-check.mjs      # 실제 검사 로직 (node 내장만 사용)
```

## 사용

- 리뷰: `code-reviewer` 서브에이전트를 호출하면 `mvp-code-review` 스킬 절차대로 리뷰한다.
- 커밋 게이트: 훅은 대상 프로젝트의 `CLAUDE_PROJECT_DIR`에서 `npm run lint/build/test`를 실행한다.
  따라서 **대상 프로젝트에 해당 npm 스크립트가 있어야** 한다.

## 참고

- 훅 변경은 Claude Code 세션 재시작 후 적용된다.
- 이 플러그인을 활성화하면 프로젝트의 `.claude/`에 동일한 스킬/에이전트/훅이 있을 경우 중복될 수 있다. 하나만 유지하는 것을 권장한다.
