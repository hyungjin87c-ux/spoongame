// QA-003 M9 P6 눈 판정 결과를 케이스로 남긴다(판정은 임시 폴더의 촬영 28장을 직접 열어 본 사람 눈 결과 — m9-wk-visual.mjs).
// 사용: node qa/scripts/m9-wk-visual-case.mjs <촬영 폴더>   — RECORD는 그 샷을 QA_SHOT_DIR(임시)에 케이스 이름으로 복사해 두고, 최종 표 생성이 저장소로 옮긴다.
import fs from 'node:fs';
import path from 'node:path';
import { addCase } from './m7c-lib.mjs';

const dir = path.resolve(process.argv[2]);
const shotDir = process.env.QA_SHOT_DIR;
const count = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).length;
addCase({
  id: 'P6-wk-visual-spoon',
  cat: 'P6 WebKit 눈 판정',
  title: 'WebKit 수저 띠(은·금 광택)·수저 칩·첫 화면 — Chromium과 나란히 놓고 눈으로 비교 (1280×800·360×740 터치)',
  steps: `두 엔진으로 첫 화면·수저 띠(3배 확대)·프로필 카드를 같은 상태로 임시 폴더에 ${count}장 찍어 열어 봄`,
  expected: '은수저·금수저 머리의 흰 광택 점·다이아몬드 무늬·흙수저 안쪽 그림이 두 엔진에서 같게 보임, 로고·한반도 심볼 모양 같음',
  actual: '두 엔진 모두 같게 보임 — 은수저 머리 왼쪽 위의 흰 반달 광택, 금수저의 작은 흰 타원 광택, 다이아몬드수저의 마름모, 흙수저 머리 안쪽 무늬가 같은 자리·같은 모양이고 글자 폭만 폰트 렌더 차이(WebKit 윈도 포트의 글꼴)로 약간 다름. 임시 촬영은 PASS라 저장소에 남기지 않고 지움',
  verdict: 'PASS',
  shots: [],
});
// RECORD: 슬라이드 출처 줄 줄 나눔
const src = path.join(dir, 'wk-m360-slide2.png');
const name = 'M9-P6-wk-visual-slide-basis.png';
if (shotDir && fs.existsSync(src)) fs.copyFileSync(src, path.join(shotDir, name));
addCase({
  id: 'P6-wk-visual-slide-basis',
  cat: 'P6 WebKit 눈 판정',
  title: 'WebKit 첫 화면 통계 슬라이드의 줄 나눔(출처 줄·기준 줄) — Chromium과 나란히 비교 (360×740 터치, 슬라이드 2·3)',
  steps: '두 엔진으로 첫 화면 캐러셀의 슬라이드 1~4를 같은 상태로 찍어 열어 봄',
  expected: '출처 줄·기준 줄이 읽히고 넘침·겹침이 없음(줄 나눔 위치는 엔진마다 다를 수 있음 — 모양 차이는 RECORD)',
  actual: '읽는 데 문제 없음, 줄 나눔만 다름 — 슬라이드 2(연간 출생아 수)의 출처 줄이 WebKit에서는 「…출생 통계 통계표 / 1 「출생아 수, 조(粗)출생률 및 합계출산율, / 1970~2025」 (2026-10-15 조회)」로 갈려 표 번호 「1」이 둘째 줄 머리로 내려오고, Chromium은 「통계표 1」을 한 줄에 둠. 본문 설명 줄 나눔도 다름(WebKit이 한 줄 더 길게 채움). 정보 손실·겹침 없음 → 모양 차이 RECORD(마스터 결정 12-4 4), 2차 백로그',
  verdict: 'RECORD',
  shots: [`qa/screenshots/003/${name}`],
});
