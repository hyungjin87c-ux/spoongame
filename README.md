# 수저 게임

태어날 때 받은 '수저'(부모 재력·교육, 외모, 시대)로 시작해 한국식 인생을 끝까지 살아 보는 웹 시뮬레이션 게임입니다. 서버 없이 브라우저에서만 돌아갑니다.

> **비공식 학습 프로젝트입니다. 다른 게임·서비스와 무관합니다.**

- **플레이**: <https://hyungjin87c-ux.github.io/spoongame/> (모바일 브라우저에서도 됩니다)
- **의견 보내기**: [GitHub 이슈로 남겨 주세요](https://github.com/hyungjin87c-ux/spoongame/issues/new?template=feedback.yml). 어떤 화면에서 무엇을 했는지, 기기·브라우저를 함께 적어 주시면 고치기 쉽습니다. 이슈는 공개이니 개인정보는 적지 말아 주세요.

## 알려진 제한

지금 알고 있는 제한이며 점차 개선합니다. 다른 문제를 발견하시면 위 「의견 보내기」로 알려 주세요.

- 인터넷이 끊긴 상태에서 새로고침하거나 다시 접속하면 열리지 않을 수 있습니다(서비스 워커·오프라인 설치 기능 없음). 이미 열린 뒤에 끊기면 플레이는 계속됩니다.
- 인생 길이 「약 1시간」은 준비 중이라 선택할 수 없습니다. 지금은 「약 30분」만 즐길 수 있습니다.
- iOS Safari는 자동 시험(WebKit 엔진)으로만 확인했습니다. 실기기 확인은 Android와 PC 웹에서 합니다.
- 한 해 도중의 진행률 막대는 새로고침 뒤 0%부터 다시 채워집니다(나이와 저장된 진행은 유지됩니다).
- 직접 적은 기록 글은 이 기기(브라우저)에만 저장됩니다. 다른 기기에서는 보이지 않고, 서버나 의견 보내기 주소로 보내지 않습니다.

## 로컬에서 실행

Node.js 24 기준으로 개발합니다.

```bash
npm ci
npm run dev
```

## 검증 명령

| 명령 | 하는 일 |
|---|---|
| `npm run typecheck` | 타입 검사 (앱 코드 + 스크립트·설정) |
| `npm test` | 단위·통합 테스트 (vitest) |
| `npm run build` | 타입 검사 → 이벤트 데이터 검증 → 프로덕션 빌드 (`dist/`) |
| `npm run e2e` | 개발 서버(5199)에 대한 Playwright e2e |
| `npm run e2e:prod` | 빌드 후 프로덕션 번들(4199)에 대한 Playwright 스모크 |
| `npm run check:todo` | `docs/TODO.md`의 완료 근거(파일·테스트)가 실제로 있는지 전수 대조 |
| `npm run check:dist` | 최종 재산 분포표가 최신인지 확인 |
| `npm run sim:1000` | 시대 3 × 전략 2 × 인생 길이 모드 2 × 1000판(12000판) 시뮬레이션 수치 보고 |

Playwright를 처음 쓰면 `npx playwright install chromium`이 한 번 필요합니다.

## 배포

`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 `npm ci` → `typecheck` → `test` → `build`를 거쳐 GitHub Pages에 올립니다. Pages 주소는 `/spoongame/` 하위라서 배포 빌드만 `PAGES_BASE=/spoongame/`로 base 경로를 바꿉니다. 로컬 실행·테스트는 base `/` 그대로입니다. (e2e는 브라우저 설치가 무거워 CI에는 넣지 않았습니다.)

## 문서 지도

| 위치 | 내용 |
|---|---|
| `CLAUDE.md` | 이 프로젝트의 AI 운영 규칙(역할, 명세 → 구현 → 검수 → QA 순서) |
| `docs/spec/` | 요청 명세서(SPEC): 할 것 / 안 할 것 / 완료 기준 |
| `docs/TODO.md` | 할 일과 완료 근거 |
| `docs/data/` | 통계 근거·출처 기록(`events-stats-basis.md`, `korea-stats-sources.md`)과 인생 단계별 데이터 소스 표(`korea-life-data-sources.csv`), 기준선(`spec-003-baseline.md`) |
| `docs/review/` | 검수 기록 (REV-*) |
| `qa/reports/` | QA 리포트 (스크린샷은 `qa/screenshots/`) |
| `ai-log/` | 단계별 실행 기록 |
| `wiki/` | 게임 콘셉트·시스템 지도·결정사항 요약 |

## 데이터 출처

2008년 이후 출생 이름 출처: 대한민국 법원 전자가족관계등록시스템 통계서비스 「상위 출생신고 이름 현황」(등록일 기준 잠정치, 2026-10-13 조회)
<https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025>

(`src/data/names.json`의 `meta.attribution`과 같은 내용이며, 게임 첫 화면 하단에도 표기합니다.)

통계 수치(출생·사망·인구·소득 등)는 국가데이터처(2025년 10월 1일 이전 발표분은 통계청)와 관계 기관의 공개 자료에서 원문과 대조해 옮겼으며, 기관·통계표·주소·열람일은 `docs/data/korea-stats-sources.md`에 적었습니다. 원문 대조를 못 한 값은 게임에 쓰지 않습니다.

## 라이선스

All rights reserved — 공개 열람만, 재사용 불가.
