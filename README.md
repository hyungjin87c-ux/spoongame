# 수저 게임

태어날 때 받은 '수저'(부모 재력·교육, 외모, 시대)로 시작해 한국식 인생을 끝까지 살아 보는 웹 시뮬레이션 게임입니다. 서버 없이 브라우저에서만 돌아갑니다.

- **플레이**: <https://hyungjin87c-ux.github.io/spoongame/> (모바일 브라우저에서도 됩니다)
- **의견 보내기**: [GitHub 이슈로 남겨 주세요](https://github.com/hyungjin87c-ux/spoongame/issues/new?template=feedback.yml). 어떤 화면에서 무엇을 했는지, 기기·브라우저를 함께 적어 주시면 고치기 쉽습니다. 이슈는 공개이니 개인정보는 적지 말아 주세요.

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
| `npm run sim:1000` | 세 시대 × 두 전략 × 1000판 시뮬레이션 수치 보고 |

Playwright를 처음 쓰면 `npx playwright install chromium`이 한 번 필요합니다.

## 배포

`main`에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 `npm ci` → `typecheck` → `test` → `build`를 거쳐 GitHub Pages에 올립니다. Pages 주소는 `/spoongame/` 하위라서 배포 빌드만 `PAGES_BASE=/spoongame/`로 base 경로를 바꿉니다. 로컬 실행·테스트는 base `/` 그대로입니다. (e2e는 브라우저 설치가 무거워 CI에는 넣지 않았습니다.)

## 문서 지도

| 위치 | 내용 |
|---|---|
| `CLAUDE.md` | 이 프로젝트의 AI 운영 규칙(역할, 명세 → 구현 → 검수 → QA 순서) |
| `docs/spec/` | 요청 명세서(SPEC): 할 것 / 안 할 것 / 완료 기준 |
| `docs/TODO.md` | 할 일과 완료 근거 |
| `docs/review/` | 검수 기록 (REV-*) |
| `qa/reports/` | QA 리포트 (스크린샷은 `qa/screenshots/`) |
| `ai-log/` | 단계별 실행 기록 |
| `wiki/` | 게임 콘셉트·시스템 지도·결정사항 요약 |

## 데이터 출처

지금 세상·다가올 세상 이름 출처: 대한민국 법원 전자가족관계등록시스템 통계서비스 「상위 출생신고 이름 현황」(등록일 기준 잠정치, 2026-10-13 조회)
<https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025>

(`src/data/names.json`의 `meta.attribution`과 같은 내용이며, 게임 첫 화면 하단에도 표기합니다.)
