// QA-003 M3 2회차 — m3r2-a11y1.mjs의 뷰포트별 요약(a11y1-summary-*.json)을 모아 M3-C10(CM10 포커스 가림)·M3-C11(CM11 가로 넘침)·M3-L01(QM2-10 구분 기호)·M3-B02(띠 측정)를 판정한다.
import fs from 'node:fs';
import path from 'node:path';
import { runCase, OUT } from './m3r2-lib.mjs';

const files = fs.readdirSync(OUT).filter((f) => /^a11y1-summary-.*\.json$/.test(f));
const S = files.map((f) => ({ f, ...JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) }));
const sum = (k) => S.reduce((a, s) => a + (s.counts[k] || 0), 0);
const rowsFiles = fs.readdirSync(OUT).filter((f) => /^a11y1-rows-.*\.jsonl$/.test(f));
const rows = rowsFiles.flatMap((f) => fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
const tabStops = [...new Set(S.flatMap((s) => s.counts.tabStops))];
const cm10 = S.flatMap((s) => s.cm10);
const cm11 = S.flatMap((s) => s.cm11);
const line = S.flatMap((s) => s.line);
const bar = S.flatMap((s) => s.bar);
const released = S.flatMap((s) => s.released);
const lineChars = sum('lineChars');
const combos = sum('combos');
const steps = sum('steps');
const maxBarRatio = rows.reduce((m, r) => Math.max(m, r.bar?.ratio ?? 0, r.ov?.bar?.ratio ?? 0), 0);
const maxOverflowPx = rows.reduce((m, r) => Math.max(m, r.ov?.px ?? 0), 0);
console.log(JSON.stringify({ vps: S.length, combos, steps, lineChars, tabStops, cm10: cm10.length, cm11: cm11.length, line: line.length, bar: bar.length, released: released.length, maxBarRatio, maxOverflowPx }));

await runCase(
  { id: 'M3-C10', cat: '접근성', title: 'CM10(포커스 가림) 2회차: 11뷰포트 × 글자 100·200% × 12상태 Tab·Shift+Tab 순회에서 포커스 링이 고정 요소에 가려지지 않음', steps: '뷰포트 11종 × 글자 100·200% × 상태 12(출생신고 7변형·룰렛 결과 4변형·회전 중)에서 Tab 한 바퀴 + Shift+Tab마다 링 상자·화면 안·가운데 점 클릭 대상·스크롤 컨테이너 잘림을 잰다(1회차 독립 측정기 그대로)', expected: '가려진 포커스 0, 순회에서 포커스 받은 요소 0개인 상태 0(공허 통과 방지)' },
  async () => ({ verdict: cm10.length || S.length !== 11 ? 'FAIL' : 'PASS', severity: '높음(접근성)', actual: cm10.length || S.length !== 11 ? `뷰포트 ${S.length}/11 · ${cm10.slice(0, 5).join(' / ')}` : `${combos}조합·포커스 측정 ${steps}회(조작 요소 ${tabStops.join('·')}): 가려짐·화면 밖·미도달 0`, shots: [] }),
);
await runCase(
  { id: 'M3-C11', cat: '접근성', title: 'CM11(글자 확대 가로 넘침·잘림·버튼) 2회차: 11뷰포트 × 글자 100·150·200% × 12상태, 새 컨테이너 질의 포함', steps: '요소 단위 가로 넘침(문서 scrollWidth > clientWidth·화면 밖 요소·overflow 잘림)·하단 버튼 높이 ≥ 44px·클릭 가능을 잰다', expected: '넘침 0px, 잘림 0, 버튼 ≥ 44px·클릭 가능' },
  async () => ({ verdict: cm11.length ? 'FAIL' : 'PASS', severity: '높음(접근성)', actual: cm11.length ? cm11.slice(0, 5).join(' / ') : `${combos}조합(+회전 중 22) 가로 넘침 최대 ${maxOverflowPx}px·잘림 0·하단 버튼 ≥ 44px·눌림 가능. 고정 띠 최대 ${Math.round(maxBarRatio * 100)}%`, shots: [] }),
);
await runCase(
  { id: 'M3-L01', cat: '접근성', title: 'QM2-10 구분 기호 2회차: 줄 끝의 「· / — (」·줄 첫머리의 「· / — ) , .」·구분 기호 홀로 한 줄·숫자와 단위 분리 0', steps: '모든 보이는 글자를 글자 하나씩 Range로 줄로 나눠 줄 끝·첫머리를 점검(11뷰포트 × 글자 100·150·200% × 12상태)', expected: '위반 0(낱말 끊김은 M3-L02가 새 독립 측정기로 판정)' },
  async () => ({ verdict: line.length ? 'FAIL' : 'PASS', severity: '중간', actual: line.length ? line.slice(0, 5).map((x) => x.problem || JSON.stringify(x)).join(' / ') : `글자 ${lineChars.toLocaleString('en')}자 줄 끝·첫머리·단독·숫자 단위 위반 0`, shots: [] }),
);
await runCase(
  { id: 'M3-B02', cat: '접근성', title: 'QM2-12 띠 측정 2회차: 고정 띠가 화면 높이의 절반을 넘으면 풀리고 풀린 띠 규칙(문서 끝·마지막 줄과 겹침 없음) — 11뷰포트 × 글자 100·150·200% × 12상태', steps: '띠 위치·높이·bar-released·문서 끝 좌표를 잰다', expected: '고정 띠 ≤ 50%, 풀리면 클래스·문서 끝·겹침 규칙 충족' },
  async () => ({ verdict: bar.length ? 'FAIL' : 'PASS', severity: '중간', actual: bar.length ? bar.slice(0, 5).join(' / ') : `띠 위반 0 (풀린 조합 ${released.length}, 고정 띠 최대 ${Math.round(maxBarRatio * 100)}%)`, shots: [] }),
);
