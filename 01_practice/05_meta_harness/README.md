# 05_meta_harness — 웹툰 제작 하네스

도메인에 맞는 **에이전트 팀 + 스킬**을 생성하는 메타 하네스(`harness` 플러그인)로 구축한 **웹툰 제작 파이프라인**입니다. 자연어로 "웹툰 1화 만들어줘"라고 요청하면, 전문 에이전트들이 협업해 기획부터 실제 이미지 생성까지 한 번에 수행합니다.

> 샘플 산출물: Claude Code 보안을 소재로 한 **「커밋 가드 — 클로디」 1화(3컷)** — `_workspace/`에 포함.

## 파이프라인

```
기획안 승인 게이트 → 세계관·캐릭터 → 시나리오 → 콘티 → 작화 프롬프트 → (선택) 실제 이미지 생성
                                         ↳ 각 단계마다 일관성 검수(QA)가 경계면을 교차 비교
```

처음엔 사용자와 **제작 기획안**을 합의(승인 게이트)한 뒤 상세 생성에 들어가, 잘못된 방향으로 전체를 만드는 낭비를 막습니다.

## 구성

### 에이전트 (`.claude/agents/`)
| 에이전트 | 역할 |
|---|---|
| `story-architect` | 제작 기획안 · 세계관 바이블 · 캐릭터 시트 · 플롯 아크 |
| `scenario-writer` | 에피소드 시나리오 · 대사 · 씬 구성 |
| `storyboard-director` | 세로 스크롤 컷 단위 콘티 · 구도 · 연출 |
| `art-prompt-designer` | OpenAI gpt-image용 작화 프롬프트 · 일관성 블록 |
| `webtoon-illustrator` | 프롬프트로 실제 PNG 생성(레퍼런스 연쇄 일관성) |
| `consistency-reviewer` | 캐릭터/플롯/톤/연출 경계면 교차 QA |

### 스킬 (`.claude/skills/`)
각 에이전트 전용 스킬 + **오케스트레이터**(`webtoon-orchestrator`)가 팀 구성·작업 할당·데이터 흐름을 조율합니다. 작화 실행 스킬(`webtoon-illustration`)에는 이미지 생성 스크립트가 번들돼 있습니다.

## 사용법

새 Claude Code 세션에서 자연어로 요청하면 오케스트레이터가 트리거됩니다.

```
"클로드코드 보안 아이디어로 웹툰 1화 만들어줘 (3컷)"   # 신규 제작
"다음 화 만들어줘"                                    # 기획 재사용 + 화차 증가
"컷2 빨강 톤 낮춰서 다시"                              # 부분 재실행
```

산출물은 모두 `_workspace/`에 저장됩니다.

| 파일 | 내용 |
|---|---|
| `00_plan.md` | 제작 기획안 |
| `00_world_bible.md` / `00_character_sheets.md` | 세계관 · 캐릭터 |
| `01_scenario_ep{N}.md` | 시나리오 |
| `02_storyboard_ep{N}.md` | 컷 콘티 |
| `03_art_prompts_ep{N}.md` | 작화 프롬프트(gpt-image용) |
| `images/cut{n}.png` | 실제 생성 이미지 |
| `qa_report_ep{N}.md` | 일관성 검수 리포트 |

## 실제 이미지 생성 (선택)

작화 실행 단계는 **OpenAI 이미지 API**를 호출하므로 키 설정이 필요합니다(유료).

```bash
# 1) 의존성
pip install openai

# 2) 환경변수 (.env.example을 복사해 채우기)
cp .env.example .env
#   .env 안에 OPENAI_API_KEY=sk-... 입력
#   OPENAI_IMAGE_MODEL=gpt-image-2 (기본값)
```

내부적으로 번들 스크립트가 호출됩니다(직접 실행도 가능):

```bash
set -a; . ./.env; set +a
python3 .claude/skills/webtoon-illustration/scripts/generate_image.py \
  --prompt-file _workspace/images/_prompt_cut1.txt \
  --out _workspace/images/cut1.png \
  --size 1024x1536 --model "$OPENAI_IMAGE_MODEL"
# 2번 컷부터는 --ref 로 앞선 컷을 넘겨 캐릭터 일관성 유지
```

> `.env`는 `.gitignore`로 제외됩니다. 실제 키를 커밋하지 마세요.

## 설계 포인트

- **에이전트 팀 모드**: 세계관·캐릭터 바이블을 전 단계가 참조하고 QA가 각 단계에 개입하므로, 단발 서브 에이전트보다 팀 협업이 품질을 높입니다.
- **캐릭터 일관성**: 캐릭터 시트의 시각적 식별점 → 작화 프롬프트의 "고정 외형 블록" → 이미지 생성 시 **레퍼런스 연쇄**(`--ref`)로 컷 간 동일 인물 유지.
- **gpt-image 특성 반영**: 자연어 서술형 프롬프트 · 화면 내 영문 텍스트 활용 · 한글 말풍선은 비우고 후편집.
- **점진적 QA**: 전체 완성 후 1회가 아니라 각 단계 직후 인접 산출물을 교차 비교해 모순을 조기에 잡습니다.

## 하네스 진화 이력

변경 이력은 [`CLAUDE.md`](./CLAUDE.md)에 기록됩니다. 하네스는 고정물이 아니라 사용자 피드백으로 계속 진화하는 시스템입니다(예: 기획안 승인 게이트, 실제 이미지 생성 단계는 실행 중 피드백으로 추가됨).
