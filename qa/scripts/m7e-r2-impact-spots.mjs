// QA-003 M7e 2회차 효과가 바뀐 선택지의 영향 줄(화면 글자) 확인: middle-home-loan/shrink(건강 +1 → 건강 ▲)·youth-startup/start(지식 +2, planner 10절 R-380)·youth-housing/return(새 선택지)
// 사용: QA_OUT=qa/results/m7e/r2 QA_SHOT_PREFIX=M7e-r2 node qa/scripts/m7e-r2-impact-spots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7E, runCase, shot } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
await runCase({ id: 'M7e-E02', cat: '바뀐 곳', title: '효과가 바뀐 선택지의 영향 줄: 「집을 줄여 옮긴다」(건강 +1 → 건강 ▲), 「사업을 시작한다」(youth-startup, 지식 ▲), 「부모님 집으로 돌아간다」(새 선택지)가 화면에 새 효과대로 표시된다', steps: '카드 저장 3종(middle-home-loan·youth-startup·youth-housing)을 prod에 열어 선택지별 영향 줄·읽히는 이름을 읽는다', expected: 'shrink에 건강 ▲, start에 지식 ▲(자산 ▼▼·행복 ▼·건강 ▼ 유지), return에 자산 ▲ 관계 ▲ 행복 ▼' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const [name, check] of [
    ['card-middle-home-loan-present', (cs) => { const c = cs.find((x) => x.id === 'shrink'); if (!c) return '「집을 줄여 옮긴다」 선택지 없음'; const ln = c.impact.join(' '); return /건강▲/.test(ln.replace(/\s+/g, '')) ? null : `shrink 영향 줄에 건강▲ 없음: ${ln}`; }],
    ['card-youth-startup-future', (cs) => { const c = cs.find((x) => x.id === 'start'); if (!c) return '「사업을 시작한다」 선택지 없음'; const ln = c.impact.join(' ').replace(/\s+/g, ''); return /지식▲/.test(ln) && /건강▼/.test(ln) && /행복▼/.test(ln) ? null : `start 영향 줄: ${c.impact.join(' ')}`; }],
    ['card-youth-housing-rent', (cs) => { const c = cs.find((x) => x.id === 'return'); if (!c) return '「부모님 집으로 돌아간다」 선택지 없음'; const ln = c.impact.join(' ').replace(/\s+/g, ''); return /자산▲/.test(ln) && /관계▲/.test(ln) && /행복▼/.test(ln) ? null : `return 영향 줄: ${c.impact.join(' ')}`; }],
  ]) {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', name + '.json'), 'utf8'), [SETTINGS_KEY]: SPEED8 });
    await ctx.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
    const page = await ctx.newPage();
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
    await sleep(300);
    const d = await page.evaluate(() => window.__readDash());
    const msg = check(d.choices);
    if (msg) bad.push(`${name}: ${msg}`);
    rows.push(`${name.replace('card-', '')}: ${d.choices.map((c) => `${c.id}「${c.label}」[${c.impact.join(' ')}]`).join(' ')}`);
    shots.push(await shot(page, 'E02', name.replace('card-', '')));
    await ctx.close();
  }
  await browser.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | ').slice(0, 900), shots };
});
