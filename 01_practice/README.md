# 01_practice

이 챕터의 실습 프로젝트 모음입니다. 각 폴더는 독립적으로 실행할 수 있으며, 자세한 사용법은 폴더 안의 README를 참고하세요.

## 프로젝트

- [`01_random-lunch-picker-mvp/`](./01_random-lunch-picker-mvp/) — 점심 메뉴 랜덤 추천기 MVP. 바닐라 HTML/CSS/JS에 빌드·린트·테스트 스크립트를 갖춘 작은 프로젝트.
- [`02_vibe-coding/`](./02_vibe-coding/) — 카드·통장 내역서(CSV/Excel) 분석기. 파일을 올리면 카테고리·요일·월별·가맹점 TOP10을 차트로 보여주는 클라이언트 사이드 웹 앱(외부 의존성은 Excel 파싱용 SheetJS 1개).
- [`03_agentic-engineering/`](./03_agentic-engineering/) — 채팅방 CSV 요약 도우미. CSV를 올려 기간을 고르면 OpenAI로 한국어 마크다운 요약을 만들어 주는 MVP. CLAUDE.md 기반 컨텍스트 엔지니어링, TDD 가드 훅, 스모크 테스트 스크립트 등 에이전틱 엔지니어링 실습을 함께 담았습니다.
- [`04_harness-engineering/`](./04_harness-engineering/) — CVE Insight. CVE 번호·URL·뉴스를 입력하면 취약점 분석·조치방안·유사 취약점·실습 시나리오를 만들어 주는 Next.js 15 웹 앱(NVD API로 사실 보강 + OpenAI로 해석 생성). 하네스 엔지니어링 실습으로, PRD/ARCHITECTURE/ADR 문서화 → `phases/`의 step 분할 설계 → `scripts/execute.py`가 각 step을 독립 Claude 세션으로 순차 자동 실행(가드레일 주입·컨텍스트 누적·자가 교정·2단계 커밋)하는 워크플로우를 담았습니다.
- [`05_meta_harness/`](./05_meta_harness/) — 웹툰 제작 하네스. 도메인에 맞는 에이전트 팀과 스킬을 생성하는 메타 하네스(`harness` 플러그인)로 구축한 웹툰 제작 파이프라인입니다. 기획(세계관·캐릭터)→시나리오→콘티→작화 프롬프트→실제 이미지 생성(OpenAI gpt-image-2)→일관성 검수를 전문 에이전트 6 + 스킬 6 + 오케스트레이터로 협업 실행하며, 제작 기획안 승인 게이트와 레퍼런스 연쇄 기반 캐릭터 일관성을 담았습니다. 샘플 산출물로 Claude Code 보안을 소재로 한 「커밋 가드 — 클로디」 1화(3컷)를 포함합니다.
