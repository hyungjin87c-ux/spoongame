/**
 * 시안 HTML을 Playwright로 찍어 docs/design/screens/003/ 에 저장한다 (SPEC-003 DS6, designer).
 * 실행: npx vite-node scripts/design/buildMockups.mjs && npx vite-node scripts/design/shootMockups.mjs [이름조각 | --check]
 *   모바일 360×740(DPR 2), 데스크톱 1280×800(DPR 1), 320×640(DPR 2, 좁은 화면 1장 이상), low 320×256(DPR 2 — 400% 확대 상당의 낮은 화면, 띠 고정 해제 QM2-12 확인용).
 *   이름조각을 주면 그 이름의 샷만 다시 찍고(320px 전수 점검은 건너뜀), `--check`면 샷 없이 320px 전수 점검만 한다.
 * 넘침 점검(모든 샷 + 320px 전수, REV-003-D-1 R-122):
 *   ① 문서 가로 넘침: documentElement.scrollWidth > clientWidth
 *   ② 요소 단위 넘침: overflow가 auto/scroll이 아닌 모든 요소에서 scrollWidth > clientWidth + 1 (버튼 이름이 버튼 밖으로 삐져나오는 것을 잡는다),
 *      그리고 요소의 경계 상자가 화면 밖(left < 0, right > 화면 폭)으로 나가는 것. sr-only·svg 내부·inline·숨김 요소는 제외.
 *   하나라도 있으면 목록을 출력하고 종료 코드 1.
 * 파일 이름: <화면>-<mobile|desktop|320|low>[-dark|-forced|-reduced][-textNNN][-full].png (birth-bottom은 맨 아래로 스크롤한 샷)
 *   -reduced = 움직임 줄이기(prefers-reduced-motion: reduce) 에뮬레이션. 그 밖의 샷은 no-preference(연출이 보이는 상태).
 *   -textNNN = 글자 크기 NNN%(html { font-size } — CM11 글자 확대 상태, e2e/textResize.ts와 같은 방식).
 * 같은 시안 파일을 주소 질의(`query`)로 다른 상태로 여는 샷(첫 화면 `state=confirm`·`slide=…`, 출생신고 `era=past|future`)은 320px 전수 점검에도 (파일, 질의) 조합마다 들어간다.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MOCK = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/';
const OUT = ROOT + 'docs/design/screens/003/';
mkdirSync(OUT, { recursive: true });

// vv340 = 360×340(DPR 2): 가상 키보드가 올라온 폰의 **보이는 영역**(visualViewport) 크기 — M7c 기록 시트의 compact 상태(K2·K3 보장 높이 340px)를 그 크기 그대로 찍는다(content-M7c 6-1절). 다른 시안은 쓰지 않는다
const VIEW = { mobile: { width: 360, height: 740, dpr: 2 }, desktop: { width: 1280, height: 800, dpr: 1 }, 320: { width: 320, height: 640, dpr: 2 }, low: { width: 320, height: 256, dpr: 2 }, vv340: { width: 360, height: 340, dpr: 2 } };
/** [파일, 이름, { m: 모바일 변형[], d: 데스크톱 변형[], n: 320 변형[], l: low(320×256) 변형[] }] 변형 옵션: dark, forced, reduced, full(전체 길이), bottom(맨 아래로 스크롤), to(이 선택자의 요소가 화면 위에 오게 스크롤), query(시안 주소의 질의 문자열 — 예 'slide=marriage-count', 'state=confirm', 'era=past'), text(글자 크기 %, 예 200),
 *  el(이 선택자의 **요소만** 찍는다 — 비활성 버튼처럼 작은 부분을 확대 없이 또렷이 볼 때. 넘침 점검은 페이지 전체에 그대로 돈다),
 *  tag(파일 이름 꼬리 — 같은 상태의 전체 샷과 el 샷이 같은 이름으로 덮어쓰지 않게: economy-* 의 'panel'·'card'·'list') */
const SHOTS = [
  // 첫 화면 (확정 A안). 캐러셀은 구현과 같은 모델의 14장을 모두 품고 `?slide=<id>`로 보이는 슬라이드를 고른다(기본 1/14 합계출산율)
  ['title-a.html', 'title-a', { m: [{}, { dark: true }, { forced: true }, { full: true }], d: [{}, { dark: true }], n: [{}] }],
  // B형 기준 줄 「27.8명」 / 「인구 10만 명당 · 2025년 기준」 + 상담전화 안내(QM2-4·SC6); 320px에서는 「통계 기준」 줄의 짧은 쌍이 두 줄 모드(QM2-10)
  ['title-a.html', 'title-a-suicide', { m: [{ query: 'slide=suicide-rate', to: '.carousel' }], n: [{ query: 'slide=suicide-rate', to: '.carousel' }] }],
  // 320px 기준 줄부터 카드 끝까지: 「통계 기준」 짧은 쌍이 두 줄 모드(기호 숨김, QM2-10 규칙 3 — 문턱 16.5em > 칸 256px)
  ['title-a.html', 'title-a-pair-split', { n: [{ query: 'slide=suicide-rate', to: '.slide.is-active .slide__basis' }] }],
  // 큰 값 아래 조혼인율 줄(QM2-11)
  ['title-a.html', 'title-a-marriage', { m: [{ query: 'slide=marriage-count', to: '.carousel' }], d: [{ query: 'slide=marriage-count' }] }],
  ['title-continue.html', 'title-continue', { m: [{}], d: [{}] }],
  // 확인 단계(R-204·QM2-6): 안내문 + 「이전 판 지우고 태어나기」(보조) / 「돌아가기」(기본, 맨 아래). low(320×256)에서는 띠가 화면 절반을 넘어 고정이 풀려 본문 끝에 놓인다(QM2-12)
  ['title-continue.html', 'title-confirm', { m: [{ query: 'state=confirm' }], d: [{ query: 'state=confirm' }], l: [{ query: 'state=confirm', bottom: true }] }],
  // 룰렛(구현 모델 core/roulette.ts#buildRoulette, 2026-10-16 M3 맞춤): 회전 중(가장 빠른 구간의 한 프레임 — 흐림·줄무늬) / 결과(수저 릴 왕복 순서라 창 위아래가 이웃 단계: 은 · 동 · [흙] · 동 · 은, R-274) / 움직임 줄이기(= 결과 상태 + 안내 한 줄, 별도 시안 파일 — R-171)
  ['roulette-spin.html', 'roulette-spin', { m: [{}], d: [{}], n: [{}] }],
  // 320 · 글자 200%: 제목 글자 크기 상한(QM3-2) — 「태어날 곳이 / 정해졌습니다」 낱말 사이에서만 접히고 한 글자가 홀로 남지 않는다. 릴 칸의 「다이아몬드<wbr>수저」(D-05)는 320 · 100% 샷
  ['roulette-result.html', 'roulette-result', { m: [{}, { dark: true }, { forced: true }], d: [{}], n: [{}, { text: 200 }] }],
  ['roulette-result-reduced.html', 'roulette-result', { m: [{ reduced: true }], d: [{ reduced: true }] }],
  // 출생신고(지금 세상·시안 주인공): 위·전체·다크·강제 색상(띠는 Canvas/CanvasText + 3px 아래선 — R-291) / 아래(비교 표 3행 + 기대수명 한 줄 + 하단 표기) / 320(「태어난 곳」 한 줄, 또래 칩이 이름 아래) / 넓은 화면(3열 격자 — 「태어난 곳」 두 칸, R-281)
  // / 폭 320·글자 200%(띠 표기가 제목 아래로, 도장은 본문 기준, 격자는 본문 폭 11.5rem 미만이라 **1열** — QM3-1)
  ['birth.html', 'birth-top', { m: [{}, { full: true }, { dark: true }, { forced: true }], d: [{}], n: [{}, { text: 200 }] }],
  // 폭 320 · 글자 200%의 서류 격자: 본문 폭 246px < 11.5rem(368px)이라 **1열** — 어머니·아버지 칸이 한 줄 전체를 받아 직업 이름이 끊기지 않는다(QM3-1, 구현 근거 qa/screenshots/003/dev-M3-r4-birth-grid-320x568-200-jobs.png)
  ['birth.html', 'birth-grid', { n: [{ to: '.doc__grid', text: 200 }] }],
  ['birth.html', 'birth-bottom', { m: [{ bottom: true }], d: [{ bottom: true }] }],
  // 또래 목록(R-269: 이름 옆 「여성/남성」, 좁은 폭에서 칩은 이름 아래 줄)과 비교 카드(카드 내용 폭 35rem 미만이면 한 행이 한 덩어리 — 글자 100%는 좁은 화면, 글자 150%는 데스크톱에서도 쌓인다, QM3-1)
  ['birth.html', 'birth-peers', { m: [{ to: '[aria-labelledby="peers-t"]' }], n: [{ to: '[aria-labelledby="peers-t"]' }] }],
  ['birth.html', 'birth-compare', { m: [{ to: '[aria-labelledby="cmp-t"]' }], d: [{ to: '[aria-labelledby="cmp-t"]' }, { to: '[aria-labelledby="cmp-t"]', text: 150 }], n: [{ to: '[aria-labelledby="cmp-t"]' }] }],
  // 지난·다가올 세상 출생신고(구현 출생 생성기 출력, `?era=`): 비교 카드 없음(R-263), 하단 표기 5줄, 지난 세상은 지역 표기가 다르다(R-264). 다가올 세상은 다이아몬드수저 + 「전남광주통합특별시」
  // — 320 · 글자 150%는 다이아몬드 칩이 칸보다 넓어져 점이 다음 줄로, 이름은 「다이아몬드<wbr>수저」 자리에서만 끊기는 모습(D-05 후속 샷)
  ['birth.html', 'birth-past', { m: [{ query: 'era=past' }, { query: 'era=past', full: true }], d: [{ query: 'era=past' }] }],
  ['birth.html', 'birth-past-bottom', { d: [{ query: 'era=past', bottom: true }] }],
  ['birth.html', 'birth-future', { m: [{ query: 'era=future' }, { query: 'era=future', full: true }], d: [{ query: 'era=future' }], n: [{ query: 'era=future', full: true }, { query: 'era=future', text: 150, to: '.doc__grid' }] }],
  ['birth.html', 'birth-future-bottom', { d: [{ query: 'era=future', bottom: true }] }],
  // 대시보드(2026-10-17 M4 착수 정리): 헤더 sticky(--head-h) + 모바일 고정 진행 줄(= 이 화면의 하단 띠, --bar-h·.page-end-space), 다크는 도구 줄 「다크 모드」 켜짐 상태(aria-pressed + 해 아이콘 + 「켜짐」)
  // 320 · 글자 200% = 헤더 첫 줄 접힘(이름·알약이 로고 아래) + 진행 줄 flex-wrap, low 320×256 = 헤더 + 진행 줄이 절반을 넘어 **헤더 고정이 풀리고** 진행 줄만 고정(11-1 헤더 해제 규칙)
  ['dashboard-infant.html', 'dashboard-infant', { m: [{}, { dark: true }, { full: true }], d: [{}, { dark: true }] }],
  ['dashboard-adult.html', 'dashboard-adult', { m: [{}, { full: true }, { dark: true }, { forced: true }], d: [{}, { dark: true }, { forced: true }], n: [{}, { text: 200 }], l: [{ to: '.profile' }] }],
  // 도구 줄 아래 한 줄(2026-10-17 M4 구현에 맞춰 추가, `?state=`): tools = BGM 켜짐 → 볼륨 줄 「BGM 볼륨」 + range + 「30%」 / exit = 나가기 확인 단계(안내문 → 「첫 화면으로 나가기」(보조) → 「돌아가기」(기본), 첫 화면 확인 단계와 같은 배치 R-204)
  // 「생각 남기기」는 M7c부터 모든 대시보드 샷에서 보통 버튼(aria-haspopup="dialog" — 누르면 note.html의 기록 시트)이다. M4 r2~M7b의 지속 비활성 + 「준비 중」 알약(R-326)은 2026-10-19 후속에서 지웠다. 320 · 글자 200%의 확인 단계: 두 버튼이 flex-wrap으로 한 줄씩, 이름은 낱말 단위 「첫 화면으로 / 나가기」(R-336)
  ['dashboard-infant.html', 'dashboard-tools', { m: [{ query: 'state=tools' }, { query: 'state=tools', dark: true }, { query: 'state=tools', forced: true }], d: [{ query: 'state=tools' }], n: [{ query: 'state=tools' }, { query: 'state=tools', text: 200 }] }],
  ['dashboard-infant.html', 'dashboard-exit', { m: [{ query: 'state=exit' }, { query: 'state=exit', dark: true }, { query: 'state=exit', text: 200 }], d: [{ query: 'state=exit' }], n: [{ query: 'state=exit', text: 200 }] }],
  // 요소 단위 샷(구현 qa/screenshots/003/dev-M4-unavailable-*.png과 같은 자리 — 이름의 unavailable은 M4 r2 때 「생각 남기기 준비 중」을 보던 자리라는 뜻으로 남겼다, D-85): 도구 줄(BGM 켜짐 + 볼륨 줄, 「생각 남기기」는 M7c부터 보통 버튼) 라이트·다크·강제 색상
  // / 확인 단계 상자(320 · 글자 200% — 버튼 이름이 낱말 단위 두 줄, 고정 진행 줄에 가리지 않게 full + el)
  // / 컴포넌트판 버튼 줄(「입력 가드 0.4초」 흐림 ↔ 「다음 결정으로」 점선 — 선택지 대기 중의 모습; 카드 시안 decision-*는 시트가 진행 줄 위를 덮어 요소 샷으로는 보이지 않는다)·도구 줄(강제 색상 포함)
  ['dashboard-infant.html', 'dashboard-unavailable-tools', { m: [{ query: 'state=tools', el: '.toolbar' }, { query: 'state=tools', el: '.toolbar', dark: true }, { query: 'state=tools', el: '.toolbar', forced: true }] }],
  ['dashboard-infant.html', 'dashboard-exit-box', { m: [{ query: 'state=exit', text: 200, el: '.exit-ask', full: true }], n: [{ query: 'state=exit', text: 200, el: '.exit-ask', full: true }] }],
  ['components.html', 'components-buttons', { m: [{ el: '#buttons' }], d: [{ el: '#buttons' }, { el: '#buttons', dark: true }] }],
  ['components.html', 'components-tools', { m: [{ el: '#tools' }, { el: '#tools', forced: true }] }],
  // 밀린 화면·오류 화면(DS1 공통 헤더 — M4가 공통 헤더 컴포넌트로 함께 바꾼다): `system.html` / `?state=error`. 320 · 글자 200% = 제목 글자 크기 상한(R-321: 「바뀌었습니다.」가 한 줄 폭에 들어가도록 바닥 --fs-md까지 줄어든다)
  ['system.html', 'system-superseded', { m: [{}, { forced: true }], d: [{}], n: [{ text: 200 }] }],
  ['system.html', 'system-error', { m: [{ query: 'state=error' }, { query: 'state=error', dark: true }], d: [{ query: 'state=error' }], n: [{ query: 'state=error', text: 200 }] }],
  // 중대 결정 카드(M7b, 2026-10-19 — design-system.md 6절 「중대 결정 카드」, copy.md 6절). 한 파일에 `?state=`로 상태를 담는다.
  // decision-infant: 기본 = 수동 모달 시트 「동생이 생겼다」 + 연구 c-033(이벤트 JSON의 실제 연결 — 저자 5명 「Teti 외」, 긴 영문 원제 — 320 · 글자 200%의 시트 안 스크롤) / kinder = 「유치원 고르기」 + 통계 c-061(기관 둘 「교육부, 한국교육개발원」 쉼표 나열 · 자료 이름 「교육통계연보: …」 쌍점) / auto = 「동생이 생겼다」의 자동 모드 인라인 틀(full로 카드 전체)
  ['decision-infant.html', 'decision-infant', { m: [{}, { dark: true }, { forced: true }], d: [{}], n: [{}, { text: 200 }], l: [{}] }],
  ['decision-infant.html', 'decision-infant-kinder', { m: [{ query: 'state=kinder' }], d: [{ query: 'state=kinder' }], n: [{ query: 'state=kinder', text: 200 }] }],
  ['decision-infant.html', 'decision-infant-auto', { m: [{ query: 'state=auto', full: true }, { query: 'state=auto', dark: true, full: true }], d: [{ query: 'state=auto' }], n: [{ query: 'state=auto', text: 200, full: true }] }],
  // decision-adult: 기본 = 수동 시트 「같은 팀의 사람」(인용 없음 — 빈 박스 0) / stat = 「살 곳을 구하는 일」 + 통계 c-015 / collapsed = 접힌 띠(수동, 「결정 다시 열기」) / auto = 자동 모드 인라인 카드(스크림 없음, 진행 줄 그대로) / auto-collapsed = 자동 모드에서 접힌 띠
  ['decision-adult.html', 'decision-adult', { m: [{}, { dark: true }], d: [{}, { dark: true }], n: [{}] }],
  ['decision-adult.html', 'decision-adult-stat', { m: [{ query: 'state=stat' }, { query: 'state=stat', forced: true }], d: [{ query: 'state=stat' }], n: [{ query: 'state=stat', text: 200 }] }],
  ['decision-adult.html', 'decision-collapsed', { m: [{ query: 'state=collapsed' }, { query: 'state=collapsed', dark: true }, { query: 'state=collapsed', text: 200 }], d: [{ query: 'state=collapsed' }], n: [{ query: 'state=collapsed', text: 200 }], l: [{ query: 'state=collapsed' }] }],
  ['decision-adult.html', 'decision-auto', { m: [{ query: 'state=auto' }, { query: 'state=auto', dark: true }, { query: 'state=auto', forced: true }], d: [{ query: 'state=auto' }, { query: 'state=auto', dark: true }], n: [{ query: 'state=auto' }, { query: 'state=auto', text: 200, full: true }], l: [{ query: 'state=auto' }] }],
  ['decision-adult.html', 'decision-auto-collapsed', { m: [{ query: 'state=auto-collapsed' }], d: [{ query: 'state=auto-collapsed' }] }],
  // 인용 박스 표본 넷 + 출처 줄 변환 예(components.html #cite — 지난·다가올 세상 머리말은 시안 주인공(지금 세상)의 카드에 못 두므로 여기서 본다)
  // (320 · 글자 200%는 components.html의 다른 표본(#tools 5열 격자 비교판)이 페이지 넘침 점검에 걸려 두지 않는다 — 머리말 포함 글자의 200% 접힘은 decision-infant·decision-infant-auto 320 · 200% 샷과 감사가 덮는다)
  ['components.html', 'components-cite', { m: [{ el: '#cite' }, { el: '#cite', dark: true }], n: [{ el: '#cite' }] }],
  // M7c 자유 기록 「생각 남기기」 시트(2026-10-19 designer 선행, copy.md 7절·content-M7c 7-5절 3항): 기본 = 5세 ① 영유아기 기억 + 연구 인용 c-037, 빈 입력란 / typing = 입력 중(34/140) / empty = 빈 입력 안내(aria-invalid, 포커스 입력란)
  // / confirm = 글이 있는데 2번 → 확인 단계(두 버튼 자리에 「글을 지우고 담아 두기」 → 맨 아래 「돌아가서 이어 쓰기」) / off = 「저절로 뜨는 기록 카드 끄기」를 누른 뒤(「켜기」 + 알림)
  // / compact = 가상 키보드가 올라와 시트 전체가 보이는 높이에 들어가지 않는 상태의 표본(visualViewport 340px = K3 보장 높이 — vv340은 보이는 영역 그대로, mobile은 아래에 키보드 자리; 구현의 판정 조건은 design-system.md 11-10, 2026-10-19 후속)
  // / manual = 도구 줄 「생각 남기기」로 연 수동 시트(31세, 인용 없음 → 빈 박스 0) / limit = 기록 40개 도달(안내 + 「닫기」) / past = ① 지난 세상 표본(실제 c-037의 past 머리말 「지금의 연구로는」 포함 84자 — 시트만 1966년, 뒤 대시보드는 지금 세상 주인공)
  // 2026-10-19 후속(developer UI 단계 뒤): 문구·질문은 구현 상수(noteSheetText.ts·notes.json)에서 읽고 모든 대시보드 샷의 「생각 남기기」가 보통 버튼이라 dashboard-*·decision-*·economy-*·components-* 도 다시 찍는다
  ['note.html', 'note', { m: [{}, { dark: true }, { forced: true }], d: [{}, { dark: true }], n: [{}, { text: 200 }], l: [{}] }],
  ['note.html', 'note-typing', { m: [{ query: 'state=typing' }], n: [{ query: 'state=typing', text: 200 }] }],
  ['note.html', 'note-empty', { m: [{ query: 'state=empty' }, { query: 'state=empty', dark: true }, { query: 'state=empty', forced: true }], n: [{ query: 'state=empty', text: 200 }] }],
  ['note.html', 'note-confirm', { m: [{ query: 'state=confirm' }, { query: 'state=confirm', forced: true }, { query: 'state=confirm', el: '.note-confirm', tag: 'box' }], d: [{ query: 'state=confirm' }], n: [{ query: 'state=confirm', text: 200 }, { query: 'state=confirm', text: 200, el: '.note-confirm', tag: 'box' }] }],
  ['note.html', 'note-off', { m: [{ query: 'state=off' }, { query: 'state=off', dark: true }, { query: 'state=off', el: '.sheet__foot', tag: 'foot' }], n: [{ query: 'state=off', text: 200 }, { query: 'state=off', text: 200, el: '.sheet__foot', tag: 'foot' }] }],
  // compact 샷은 입력란에 포커스를 둔 채 찍는다(focus) — 실기기에서 키보드가 올라온 순간의 모습이고, K3(보이는 높이 340px에서 입력란 전체 + 두 버튼이 함께 보인다)을 vv340 샷이 보여 준다. 2026-10-19 r2부터 질문이 sticky 한 줄로 시트 위에 남는다(D-88)
  ['note.html', 'note-compact', { m: [{ query: 'state=compact', focus: '#note-input' }], v: [{ query: 'state=compact', focus: '#note-input' }, { query: 'state=compact', focus: '#note-input', dark: true }, { query: 'state=compact', focus: '#note-input', text: 200 }] }],
  ['note.html', 'note-manual', { m: [{ query: 'state=manual' }], d: [{ query: 'state=manual' }], n: [{ query: 'state=manual', text: 200 }] }],
  ['note.html', 'note-limit', { m: [{ query: 'state=limit' }, { query: 'state=limit', dark: true }], d: [{ query: 'state=limit' }] }],
  ['note.html', 'note-past', { m: [{ query: 'state=past' }], n: [{ query: 'state=past', text: 200 }] }],
  // 「나의 기록」 줄 표본(인생 기록 카드 + 엔딩 연표 한 묶음, copy.md 7-4): 짧은 글·3줄·최신 줄·긴 URL·띄어쓰기 없는 한글 140자·히브리/아랍 글·그림 문자(가족 ZWJ·깃발·피부색·키캡)
  ['note-rows.html', 'note-rows', { m: [{}, { dark: true }, { forced: true }, { full: true }], d: [{}, { dark: true }], n: [{}, { text: 200 }, { text: 200, full: true }] }],
  // 엔딩: 머리 = 얼굴 96px 정사각 + 텍스트 칸 `.ending__who`(R-320), 320 · 글자 200% = 제목 「이서연의 인생」 글자 크기 상한(R-321 — 낱말이 끊기지 않고 칸이 좁으면 얼굴 아래 줄로)
  // M7e(R-327): 머리 「{세상} · 생애 기록」 + 「연월 ~ 연도 · N세」, 출발선 카드 = 띠(출발선 구간) + 마름모(마지막 자리) 막대 + 범례(수저 칩) + 합쇼체 제안 문안, 「최종 순자산」 줄은 금액만.
  // `?state=`: zero = 최종 순자산 0원(흙수저, 현행 규칙 자리 + 규칙 후보 주석) / past = 지난 세상 인물(음수 + 「지금 가치로 환산」) / early = 스무 살 전(동수저 — 중앙 구간 「하위 25% 선과 상위 45% 선 사이」, 띠만)
  ['ending.html', 'ending', { m: [{}, { full: true }, { dark: true }, { forced: true }], d: [{}, { dark: true }], n: [{}, { text: 200 }, { text: 200, el: '[aria-labelledby="ending-journey-title"]', tag: 'journey' }] }],
  ['ending.html', 'ending-zero', { m: [{ query: 'state=zero', to: '[aria-labelledby="ending-journey-title"]' }], n: [{ query: 'state=zero', text: 200, el: '[aria-labelledby="ending-journey-title"]', tag: 'journey' }] }],
  ['ending.html', 'ending-past', { m: [{ query: 'state=past' }, { query: 'state=past', forced: true, to: '[aria-labelledby="ending-journey-title"]' }], d: [{ query: 'state=past' }], n: [{ query: 'state=past', text: 200 }] }],
  ['ending.html', 'ending-early', { m: [{ query: 'state=early' }, { query: 'state=early', dark: true, to: '[aria-labelledby="ending-journey-title"]' }], n: [{ query: 'state=early', text: 200 }, { query: 'state=early', text: 200, el: '.ending-stats', tag: 'card' }] }],
  ['ending.html', 'ending-down', { m: [{ query: 'state=down', to: '[aria-labelledby="ending-journey-title"]' }], n: [{ query: 'state=down', text: 200, el: '[aria-labelledby="ending-journey-title"]', tag: 'journey' }] }],
  // M5 경제 모델 (economy-m5.html — 생성기 economyPage()가 만든다, D-35. 영향 줄·자산 카드·최종 순자산 줄은 구현 컴포넌트가 만든 마크업이다): `?state=`로 상태를 고른다.
  // 영향 줄: 47세 보증 결정(항목 4개, 부채 ▲ 붉음) 라이트·다크·강제 색상·320·낮은 화면, 글자 200%에서 선택지 카드 요소 샷(줄마다 항목이 접히는 모습 — 「집안 살림 ▼▼▼」만 기호 묶음이 이름 아래로)
  ['economy-m5.html', 'economy-choice', { m: [{}, { dark: true }, { forced: true }, { text: 200, el: '.choice-panel', tag: 'panel' }], d: [{}, { dark: true }], n: [{}, { text: 200, el: '.choice-panel', tag: 'panel' }, { dark: true, text: 200, el: '.choice-panel', tag: 'panel' }], l: [{}, { text: 200 }] }],
  ['economy-m5.html', 'economy-choice-young', { m: [{ query: 'state=choice-young' }], n: [{ query: 'state=choice-young', text: 200 }, { query: 'state=choice-young', text: 200, el: '.choice-panel', tag: 'panel' }] }],
  ['economy-m5.html', 'economy-impact-samples', { m: [{ query: 'state=impact-samples', full: true }, { query: 'state=impact-samples', full: true, dark: true }, { query: 'state=impact-samples', full: true, forced: true }], d: [{ query: 'state=impact-samples', full: true }], n: [{ query: 'state=impact-samples', el: '.choices-list', tag: 'list' }, { query: 'state=impact-samples', text: 200, el: '.choices-list', tag: 'list' }, { query: 'state=impact-samples', text: 200, full: true }] }],
  // 자산 카드: 지금 세상(태그 없음, 음수 순자산) / 지난 세상(「지금 가치로 환산」 태그) / 가장 긴 금액(폭 320 · 글자 200%에서도 한 덩어리)
  ['economy-m5.html', 'economy-assets', { m: [{ query: 'state=assets' }, { query: 'state=assets', dark: true }, { query: 'state=assets', el: '.card--assets', tag: 'card' }], d: [{ query: 'state=assets' }], n: [{ query: 'state=assets', text: 200 }, { query: 'state=assets', text: 200, el: '.card--assets', tag: 'card' }] }],
  ['economy-m5.html', 'economy-assets-past', { m: [{ query: 'state=assets-past' }, { query: 'state=assets-past', forced: true }], n: [{ query: 'state=assets-past', dark: true, text: 200 }] }],
  ['economy-m5.html', 'economy-assets-big', { m: [{ query: 'state=assets-big' }], n: [{ query: 'state=assets-big' }, { query: 'state=assets-big', text: 200 }] }],
  // 엔딩 「최종 순자산」 줄: 지금 세상 / 지난 세상 음수(태그) / 스무 살 전
  ['economy-m5.html', 'economy-ending', { m: [{ query: 'state=ending' }, { query: 'state=ending', dark: true }], d: [{ query: 'state=ending' }], n: [{ query: 'state=ending', text: 200 }, { query: 'state=ending', text: 200, el: '.ending-stats', tag: 'card' }] }],
  ['economy-m5.html', 'economy-ending-past', { m: [{ query: 'state=ending-past' }, { query: 'state=ending-past', forced: true }], n: [{ query: 'state=ending-past', text: 200 }] }],
  ['economy-m5.html', 'economy-ending-early', { m: [{ query: 'state=ending-early' }], n: [{ query: 'state=ending-early', text: 200 }, { query: 'state=ending-early', text: 200, el: '.ending-stats', tag: 'card' }] }],
  // 디자인 시스템
  ['components.html', 'components', { m: [{ full: true }], d: [{ full: true }, { dark: true, full: true }] }],
  ['symbols.html', 'symbols', { m: [{ full: true }], d: [{ full: true }] }],
  ['faces.html', 'faces-48', { m: [{ full: true }], d: [{ full: true }] }],
  ['faces-all.html', 'faces-80', { m: [{ full: true }], d: [{ full: true }] }],
];

const arg = process.argv[2];
const checkOnly = arg === '--check';
const only = checkOnly ? undefined : arg;
const browser = await chromium.launch();
const problems = [];

/** 페이지 안에서 실행: 문서·요소 단위 가로 넘침 목록 */
function overflowReport() {
  const out = [];
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push(`document scrollWidth ${de.scrollWidth} > ${de.clientWidth}`);
  const vw = de.clientWidth;
  const describe = (el) => {
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `<${el.tagName.toLowerCase()}${cls}> "${text}"`;
  };
  // 읽기 전용으로 접은(clip: rect(0 0 0 0)) 요소와 그 안 — 좁은 화면 비교 표의 머리글(thead)처럼 화면에 그려지지 않는 것은 세지 않는다(구현 e2e 측정기 e2e/textResize.ts와 같은 규칙, M3)
  const clipped = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).clip === 'rect(0px, 0px, 0px, 0px)');
  // 의도된 한 줄 줄임의 허용 목록(2026-10-19 r2, diff-003.md D-88 · design-system.md 11-10 「줄임 허용」): compact 기록 시트의 질문 h2는 sticky 한 줄로 그려 넘치는 글자가 「…」로 끝난다 — 글자·접근 가능한 이름은 그대로.
  // 이 선택자 하나뿐이고(늘리려면 design-system.md 11-10에 이유를 적는다) 세 조건(text-overflow: ellipsis · white-space: nowrap · overflow-x: hidden)이 모두 맞을 때만 「(줄임 허용)」 접두사로 따로 내보낸다 — 호출자는 넘침으로 세지 않는다. 구현 e2e/textResize.ts의 clipped 판정도 같은 목록(D-88)
  const ELLIPSIS_ALLOWED = ['.sheet--compact .sheet__title'];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || el.classList.contains('sr-only') || el.closest('.sr-only')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || clipped.some((c) => c.contains(el))) continue;
    if (el.clientWidth === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) {
      const intentional = cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' && cs.overflowX === 'hidden' && ELLIPSIS_ALLOWED.some((s) => el.matches(s));
      out.push(`${intentional ? '(줄임 허용) ' : ''}${describe(el)} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    }
    if (r.right > vw + 1 || r.left < -1) out.push(`${describe(el)} 화면 밖 (left ${Math.round(r.left)}, right ${Math.round(r.right)}, 화면 ${vw})`);
  }
  return out;
}
/** 넘침 목록에서 의도된 줄임(허용 목록)을 뺀다 — 샷·--check의 「넘침 N건」은 이것만 센다 */
const realOverflow = (list) => list.filter((p) => !p.startsWith('(줄임 허용)'));

async function shoot(file, name, kind, opt) {
  const v = VIEW[kind];
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: v.dpr,
    forcedColors: opt.forced ? 'active' : 'none',
    reducedMotion: opt.reduced ? 'reduce' : 'no-preference',
    colorScheme: opt.dark ? 'dark' : 'light',
  });
  const page = await ctx.newPage();
  const query = [opt.dark ? 'theme=dark' : '', opt.query ?? ''].filter(Boolean).join('&');
  await page.goto(MOCK + file + (query ? `?${query}` : ''));
  await page.waitForLoadState('load');
  if (opt.text) {
    // 글자 확대 상태(CM11): 문서 루트 글자 크기만 키운다(e2e/textResize.ts와 같은 방식). 시안의 흉내 스크립트(띠 높이·FitPair)는 resize 신호로 다시 잰다
    await page.addStyleTag({ content: `html { font-size: ${opt.text}%; }` });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  }
  await page.waitForTimeout(80);
  if (opt.focus) {
    // 요소에 포커스를 둔 채 찍는다(M7c 기록 시트의 입력란 — 시안의 포커스 흉내 스크립트가 입력란 상자를 보이는 영역에 둔다, K4). 이름에 상태가 들어 있어 접미사를 더하지 않는다
    await page.focus(opt.focus);
    await page.waitForTimeout(120);
  }
  let suffix = '';
  if (opt.dark) suffix += '-dark';
  if (opt.forced) suffix += '-forced';
  if (opt.reduced) suffix += '-reduced';
  if (opt.text) suffix += `-text${opt.text}`;
  const label = `${name}-${kind}${suffix}`;
  for (const p of realOverflow(await page.evaluate(overflowReport))) problems.push(`${label}: ${p}`);
  if (opt.full) {
    const h = await page.evaluate(() => Math.min(6000, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
    await page.setViewportSize({ width: v.width, height: Math.max(v.height, h) });
    await page.waitForTimeout(100);
    suffix += '-full';
  }
  if (opt.bottom) {
    // 이름(birth-bottom)에 이미 「아래」가 들어 있으므로 접미사를 더하지 않는다
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
  }
  if (opt.to) {
    // 특정 요소(예: 좁은 화면에서 접힘선 아래에 있는 통계 카드)가 화면 위에 오도록 스크롤한 샷 — 이름에 그 뜻이 들어 있어 접미사를 더하지 않는다
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8);
    }, opt.to);
    await page.waitForTimeout(150);
  }
  // tag = 파일 이름 꼬리(예 'panel'·'card'·'list'): 같은 상태의 전체 샷과 요소 단위 샷(el)이 같은 이름으로 서로 덮어쓰지 않게 한다(2026-10-18 M5 r3 — economy-* 등록에서 el 샷이 전체 샷을 덮던 것)
  const path = `${OUT}${name}-${kind}${suffix}${opt.tag ? `-${opt.tag}` : ''}.png`;
  if (opt.el) {
    // 요소 단위 샷: 그 요소의 경계 상자만(고정 요소·스크림이 위에 있으면 보이는 그대로 찍힌다)
    const target = page.locator(opt.el).first();
    if ((await target.count()) === 0) throw new Error(`${label}: 요소 ${opt.el}가 없다`);
    await target.screenshot({ path });
  } else {
    await page.screenshot({ path });
  }
  await ctx.close();
  console.log('saved', path.replace(ROOT, ''));
}

for (const [file, name, plan] of SHOTS) {
  if (checkOnly || (only && !name.includes(only))) continue;
  for (const [kind, variants] of [['mobile', plan.m ?? []], ['desktop', plan.d ?? []], ['320', plan.n ?? []], ['low', plan.l ?? []], ['vv340', plan.v ?? []]]) {
    for (const opt of variants) await shoot(file, name, kind, opt);
  }
}

// 320px 전수 넘침 점검(스크린샷 없이): 모든 화면 시안 × 주소 질의로 여는 상태(확인 단계·슬라이드·세상) × 라이트·다크
if (!only) {
  const targets = new Map(); // "file?query" → [file, query]
  for (const [file, name, plan] of SHOTS) {
    if (/^faces|^components|^symbols/.test(name)) continue;
    for (const variants of Object.values(plan)) for (const opt of variants) targets.set(`${file}?${opt.query ?? ''}`, [file, opt.query ?? '']);
  }
  for (const [file, q] of targets.values()) {
    for (const dark of [false, true]) {
      const query = [dark ? 'theme=dark' : '', q].filter(Boolean).join('&');
      const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
      const page = await ctx.newPage();
      await page.goto(MOCK + file + (query ? `?${query}` : ''));
      await page.waitForLoadState('load');
      await page.waitForTimeout(60);
      for (const p of realOverflow(await page.evaluate(overflowReport))) problems.push(`${file}${q ? `?${q}` : ''} 320px${dark ? ' dark' : ''}: ${p}`);
      await ctx.close();
    }
  }
}
await browser.close();
const uniq = [...new Set(problems)];
console.log(uniq.length === 0 ? '넘침 없음: 문서 가로 넘침 0 · 요소 단위 넘침 0 (360·1280·320, 라이트·다크·강제 색상·움직임 줄이기)' : `넘침 ${uniq.length}건:\n` + uniq.join('\n'));
if (uniq.length > 0) process.exit(1);
