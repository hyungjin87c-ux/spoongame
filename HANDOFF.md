# 🥄 Claude Code 인계서 — 수저 게임

## 1. 시작하는 법
1. Claude Code를 **이 저장소의 최상위 폴더**에서 실행한다.
   ```
   cd "<프로젝트 폴더>"   # 이 저장소를 내려받은(또는 열어 둔) 폴더로 이동
   claude
   ```
2. `CLAUDE.md`(마스터 규칙)와 `.claude/agents/`(서브에이전트 6종: planner · developer · designer · reviewer · qa · wiki-keeper)는 자동으로 인식된다. `/agents`로 목록 확인.
3. 아래 "첫 지시문"을 그대로 붙여넣는다.

## 2. 현재 상태
- **현황(진행 중인 SPEC·마일스톤·배포)은 `wiki/00_개요.md`, 운영 규칙은 `CLAUDE.md`** 를 본다. 할 일과 완료 근거는 `docs/TODO.md`가 기준이다. 날짜가 지나면 낡는 현황은 이 문서에 적지 않는다.
- 코드: `src/core`(순수 로직) · `src/data`(이름·분포·이벤트 데이터) · `src/screens`·`src/ui`(화면·컴포넌트) · `src/audio`(BGM) · `tests/`(vitest) · `e2e/`·`e2e-prod/`(Playwright). 실행·검증 명령은 `README.md`의 표를 본다(`npm run dev`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e` 등).

## 3. 첫 지시문 (복사해서 붙여넣기)
```
너는 이 프로젝트의 마스터 AI야. CLAUDE.md 규칙을 따라줘.
wiki/00_개요.md로 현황을 확인하고, docs/TODO.md의 열린 항목과 해당 docs/spec/SPEC-*.md를 읽고 이어서 진행해.
마일스톤마다 reviewer 검수 → 승인되면 다음 단계, 릴리스 앞에서는 qa 서브에이전트로 실사용·공격 테스트.
각 단계 끝날 때마다 ai-log/에 기록하고, 나한테는 마일스톤 단위로만 짧게 보고해줘.
```

## 4. 꼭 지킬 것 (요약)
| 규칙 | 내용 |
|---|---|
| 대화 창구 | 형진 님 ↔ 마스터(메인 세션)만 |
| 명세 우선 | SPEC의 "안 할 것"은 구현 금지, 새 요청은 질문 일괄 → 새 SPEC |
| 검수 루프 | reviewer(opus, 읽기 전용) 승인까지 반복, 같은 지적 2회 → 마스터 개입 |
| 완료 근거 | TODO 체크 시 파일·함수·테스트명 필수 |
| QA | 사람처럼 조작 + 공격 테스트, 스크린샷은 FAIL·관찰(RECORD) 케이스만, 실패 시 planner로 복귀 |
| 저장소 | GitHub 공개 저장소. 비밀·토큰·개인정보 금지, 푸시는 마일스톤 단위, 승인 전 코드는 작업 브랜치(`spec-003`), 검수·QA 승인분만 `main`(Pages 배포) |
| 기록 | wiki/ 큰 그림만, ai-log/ 단계별 상세 |

## 5. 핵심 결정 요약
- 제목 **수저 게임** / 웹(Vite+React+TS) / 서버 없음, localStorage 저장 / GitHub 공개 저장소 + GitHub Pages 배포 (비공식 학습 프로젝트, All rights reserved).
- 시대·이름·인생 길이·문구 어체·경제·인용 같은 세부 결정은 계속 바뀌므로 여기에 적지 않는다. 최신은 `wiki/02_결정사항.md`(지난 결정은 `03`·`04` 보관본), 게임 요약은 `wiki/00_개요.md`, 명세는 `docs/spec/`를 본다.

## 6. 폴더 지도
```
CLAUDE.md            마스터 규칙
HANDOFF.md           이 문서
README.md            게임 소개 · 검증 명령 · 알려진 제한
.claude/agents/      planner · developer · designer(fable) · reviewer(opus) · qa · wiki-keeper(haiku)
.github/             Pages 배포 워크플로 · 이슈 템플릿
docs/spec/           요청 명세서 (SPEC-001 · 003 …)
docs/TODO.md         할 일 + 완료 근거
docs/review/         검수 기록 REV-xxx
docs/data/           통계 근거 · 출처 · 마일스톤별 기획 자료
docs/design/         디자인 시스템 · 시안
qa/                  reports/ · screenshots/ (FAIL·RECORD만)
wiki/                큰 그림
ai-log/              단계별 실행 기록
src/                 core/ · data/ · screens/ · ui/ · audio/ · assets/
tests/ · e2e/        단위 테스트 · 브라우저 테스트 (e2e-prod/는 배포 번들 스모크)
```
