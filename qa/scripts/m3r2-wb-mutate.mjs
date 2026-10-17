// 독립 측정기가 정말 잡는지(눈먼 측정기 방지): 앱 코드는 그대로 두고 브라우저에서 CSS·DOM만 덮어써서 1회차에 나왔던 결함을 되살려 본다.
// 사용: node qa/scripts/m3r2-wb-mutate.mjs   결과: qa/results/m3r2/wb-mutate.json + 케이스 M3-L02m
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, openTitle, toRoulette, waitGuard, sleep, runCase, shot, OUT, TOUCH, setRootFont } from './m3r2-lib.mjs';
import { WB_AUDIT, H1_AUDIT } from './m3r2-wb.mjs';

const browser = await launch();
const INTENDED = ['다이아몬드수저'];

async function open(vp, era, seed, to) {
  const ctx = await mkctx(browser, { viewport: { width: vp.w, height: vp.h }, ...(vp.touch ? TOUCH : {}) });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  await openTitle(p);
  await toRoulette(p, era);
  await waitGuard(p, 'skip-roulette');
  await p.getByTestId('skip-roulette').click();
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 3000 });
  await sleep(400);
  if (to === 'birth') {
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 4000 });
    await sleep(400);
  }
  return { ctx, p };
}

const MUT = [
  {
    id: 'MU1 서류 격자 1열 쌓기 무력화(어머니·아버지 반쪽 칸으로)',
    vp: { w: 320, h: 568 },
    font: 200,
    era: 'present',
    seed: 5,
    to: 'birth',
    css: '.doc__grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .doc__grid .span-2 { grid-column: span 2 !important; }',
    wantBroken: ['단순노무직', '서비스직'],
  },
  {
    id: 'MU2 제목 글자 크기 상한 제거',
    vp: { w: 320, h: 568 },
    font: 200,
    era: 'present',
    seed: 229,
    to: 'result',
    css: '.roulette__lead .t-title { font-size: var(--fs-2xl) !important; }',
    wantH1Broken: ['정해졌습니다'],
  },
  {
    id: 'MU3 비교 카드 쌓기(컨테이너 질의) 무력화 — 표 칸 안 출처 줄',
    vp: { w: 667, h: 375 },
    font: 200,
    era: 'present',
    seed: 229,
    to: 'birth',
    css: '.card--cmp { container-type: normal !important; }',
    wantBroken: ['초중고사교육비조사'],
  },
  {
    id: 'MU4 <wbr> 제거 + 허용 목록 비움 → 릴 칸 「다이아몬드수저」가 중간에서 끊김',
    vp: { w: 320, h: 568 },
    font: 100,
    era: 'present',
    seed: 229,
    to: 'result',
    js: () => document.querySelectorAll('wbr').forEach((w) => w.remove()),
    wantBroken: ['다이아몬드수저'],
  },
  {
    id: 'MU5 허용 목록을 비우면(= <wbr> 지점이 intended가 아니라 broken) 「다이아몬드수저」가 잡힌다',
    vp: { w: 320, h: 568 },
    font: 100,
    era: 'present',
    seed: 229,
    to: 'result',
    intendedEmpty: true,
    wantBroken: ['다이아몬드수저'],
  },
  {
    id: 'MU6 서류 본문 컨테이너 쌓기 무력화 + 칸 폭 강제(반쪽 칸) — 1열 규칙이 실제로 단순노무직을 살리고 있음',
    vp: { w: 360, h: 740, touch: true },
    font: 200,
    era: 'present',
    seed: 5,
    to: 'birth',
    css: '.doc__body { container-type: normal !important; } .doc__grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }',
    wantBroken: ['단순노무직'], // 360폭 · 글자 200%의 반쪽 칸(약 127px)에서 4글자 「서비스직」(128px 미만)은 들어가고 5글자 「단순노무직」만 끊긴다
  },
];

const results = [];
for (const m of MUT) {
  const { ctx, p } = await open(m.vp, m.era, m.seed, m.to);
  await setRootFont(p, m.font);
  await sleep(250);
  // 변조 전(정상)
  const before = await p.evaluate(WB_AUDIT, { intended: m.intendedEmpty ? [] : INTENDED });
  const beforeH1 = await p.evaluate(H1_AUDIT);
  if (m.css) await p.addStyleTag({ content: m.css });
  if (m.js) await p.evaluate(m.js);
  await sleep(300);
  const after = await p.evaluate(WB_AUDIT, { intended: m.id.startsWith('MU4') ? [] : m.intendedEmpty ? [] : INTENDED });
  const afterH1 = await p.evaluate(H1_AUDIT);
  const brokenWords = [...new Set(after.broken.map((x) => x.word))];
  const h1Broken = [];
  for (const r of afterH1.rows) for (const w of r.wrows) if (w.lines !== 1) h1Broken.push(w.word);
  const beforeBroken = [...new Set(before.broken.map((x) => x.word))];
  const beforeH1Broken = [];
  for (const r of beforeH1.rows) for (const w of r.wrows) if (w.lines !== 1) beforeH1Broken.push(w.word);
  let ok = true;
  if (m.wantBroken) {
    // MU5는 변조 전(허용 목록 비움)부터 잡혀야 하고, 나머지는 변조 전 0 → 변조 후 잡힘
    const got = m.intendedEmpty ? beforeBroken : brokenWords;
    ok = m.wantBroken.every((w) => got.includes(w));
    if (!m.intendedEmpty && !m.id.startsWith('MU4')) ok = ok && m.wantBroken.every((w) => !beforeBroken.includes(w));
  }
  if (m.wantH1Broken) ok = m.wantH1Broken.every((w) => h1Broken.includes(w)) && m.wantH1Broken.every((w) => !beforeH1Broken.includes(w));
  const shotName = await shot(p, 'L02m', m.id.slice(0, 3));
  results.push({ id: m.id, ok, before: { broken: beforeBroken, h1Broken: beforeH1Broken }, after: { broken: after.broken.map((x) => `${x.word}(${x.shape})`), unavoidable: after.unavoidable.map((x) => x.word), intended: after.intended.map((x) => x.word), h1Broken }, shot: shotName });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${m.id}: 변조 전 broken ${JSON.stringify(beforeBroken)}/제목 ${JSON.stringify(beforeH1Broken)} → 후 broken ${JSON.stringify(after.broken.map((x) => x.shape))} 제목 ${JSON.stringify(h1Broken)}`);
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, 'wb-mutate.json'), JSON.stringify(results, null, 1));

await runCase(
  {
    id: 'M3-L02m',
    cat: '측정기 검증',
    title: '독립 측정기 눈먼 통과 방지: 1회차에 실제로 나왔던 결함(반쪽 칸 직업 라벨·제목 「다」 홀로·표 칸 안 출처 줄·<wbr> 없는 릴 칸)을 CSS·DOM 덮어쓰기로 되살려 측정기가 잡는지',
    steps: '앱 코드는 그대로, 브라우저에서 스타일·DOM만 바꿔(1회차와 같은 폭·글자 크기) 측정기를 다시 돌린다',
    expected: '변조 전 0건 → 변조 후 해당 낱말이 broken(또는 제목 끊김)으로 잡힘',
  },
  async () => {
    const bad = results.filter((r) => !r.ok).map((r) => r.id);
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '측정기', actual: bad.length ? `못 잡은 변조: ${bad.join(' / ')}` : `${results.length}개 변조 모두 잡힘(${results.map((r) => r.id.slice(0, 3)).join('·')})`, shots: results.map((r) => r.shot) };
  },
);
await browser.close();
