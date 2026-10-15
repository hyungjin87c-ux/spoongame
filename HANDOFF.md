# 🥄 Claude Code 인계서 — 수저 게임

## 1. 시작하는 법
1. Claude Code를 **이 폴더**(`5. 수저프로젝트`)에서 실행한다.
   ```
   cd "<프로젝트 폴더>"   # 이 저장소를 내려받은(또는 열어 둔) 폴더로 이동
   claude
   ```
2. `CLAUDE.md`(마스터 규칙)와 `.claude/agents/`(서브에이전트 5종)는 자동으로 인식된다. `/agents`로 목록 확인.
3. 아래 "첫 지시문"을 그대로 붙여넣는다.

## 2. 현재 상태 (2026-10-13)
- ✅ 워크플로우 셋업 완료 (SPEC-000)
- ✅ SPEC-001 MVP **확정** → `docs/spec/SPEC-001-MVP.md`
- ✅ M1(기반)·M2(출생) 구현·검수 승인 (`docs/review/REV-001-M1-1.md`, `REV-001-M2-2.md`)
- ⏭ 다음: TODO의 SPEC-001 **M3(인생 진행·속도 컨트롤)** → 승인 후 QA
- 코드: `src/core`(순수 로직) · `src/data`(이름·분포 데이터) · `src/screens` · `tests/`(vitest) · `e2e/`(Playwright). 실행: `npm run dev`, 검증: `npm run typecheck && npm test && npm run build && npm run e2e`

## 3. 첫 지시문 (복사해서 붙여넣기)
```
너는 이 프로젝트의 마스터 AI야. CLAUDE.md 규칙을 따라줘.
docs/spec/SPEC-001-MVP.md(확정)와 docs/TODO.md를 읽고,
M1(기반)부터 developer 서브에이전트에게 맡겨 진행해.
마일스톤마다 reviewer 검수 → 승인되면 다음 마일스톤.
M3(속도 컨트롤 포함)과 M6 끝나면 qa 서브에이전트로 실사용·공격 테스트.
각 단계 끝날 때마다 ai-log/에 기록하고, 나한테는 마일스톤 단위로만 짧게 보고해줘.
```

## 4. 꼭 지킬 것 (요약)
| 규칙 | 내용 |
|---|---|
| 대화 창구 | 형진 님 ↔ 마스터(메인 세션)만 |
| 명세 우선 | SPEC의 "안 할 것"은 구현 금지, 새 요청은 질문 일괄 → 새 SPEC |
| 검수 루프 | reviewer(opus, 읽기 전용) 승인까지 반복, 같은 지적 2회 → 마스터 개입 |
| 완료 근거 | TODO 체크 시 파일·함수·테스트명 필수 |
| QA | 사람처럼 조작 + 공격 테스트, 스크린샷 필수, 실패 시 planner로 복귀 |
| 기록 | wiki/ 큰 그림만, ai-log/ 단계별 상세 |

## 5. 핵심 결정 요약
- 제목 **수저 게임** / 웹(Vite+React+TS) / 서버 없음, localStorage 저장
- 이름: 입력 없음, 출생 연도·성별 풀에서 랜덤. 지금 세상(2008~2025년생)은 법원 통계서비스 연도·성별 상위 20 / 다가올 세상(2030~2060년생)은 최근 5개 연도(2021~2025) 공식 풀 합집합 / 지난 세상(1950~1989년생)은 언론 인용 확인분 + 추정 보충(통계 아님, 구분 표기). 정치적으로 민감한 실존 인물과 같은 성+이름은 걸러냄. 타이틀에 법원 통계 출처 표기
- 플레이 10~30분, 속도 1·2·4·8배 + 다음 결정으로 + 자동 모드
- 사연 이벤트: 커뮤니티 사연 모티브 AI 각색 40개+ (원문 사용 금지)
- 엔딩: 담담한 회고

## 6. 폴더 지도
```
CLAUDE.md            마스터 규칙
HANDOFF.md           이 문서
.claude/agents/      planner · developer · reviewer(opus) · qa · wiki-keeper(haiku)
docs/spec/           요청 명세서 (SPEC-001 확정)
docs/TODO.md         할 일 + 완료 근거
docs/review/         검수 기록 REV-xxx
qa/                  reports/ · screenshots/
wiki/                큰 그림
ai-log/              단계별 실행 기록
src/                 core/ · data/ · screens/ · ui/
tests/ · e2e/        단위 테스트 · 브라우저 테스트
```
