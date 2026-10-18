// QA-003 M7e 엔딩 새 화면: 저장(ending-*)을 prod 엔딩 화면에 열어 머리·사망 줄·출발선 막대·범례·문장·최종 순자산·연표를 읽고,
// 「막대 = 문장」을 화면 글자에서 독립적으로 푼 기대값(띠 [low, high], 마지막 점수, 방향)과 그려진 픽셀 위치로 대조한다.
// 사용: node qa/scripts/m7e-ending.mjs [이름 정규식 기본 ^ending-] [viewport m360|d1280]   결과: qa/results/m7e/ending-table.json (+ 케이스 요약은 stdout)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, SHOT_DIR, shot, SHOT_PREFIX } from './m7e-lib.mjs';

const filter = new RegExp(process.argv[2] || '^ending-');
const vpName = process.argv[3] || 'm360';
const outName = process.env.OUT_NAME || 'ending-table.json';
const SETTINGS = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const SAVES = path.join(OUT, 'saves');
const names = fs.readdirSync(SAVES).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).filter((n) => filter.test(n)).sort();
const SHOT_SET = new Set((process.env.SHOT_NAMES || '').split(',').filter(Boolean));

import { READ, judge, parseBand, parseEnd, expectMovement, MV_TEXT, ERA_LABEL } from './m7e-ending-lib.mjs';

const meta = fs.existsSync(path.join(OUT, 'saves-manifest.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'saves-manifest.json'), 'utf8')) : {};
const table = [];
let browser = await launch();
let opened = 0;
for (const name of names) {
  if (opened++ % 12 === 11) {
    await browser.close();
    browser = await launch();
  }
  const raw = fs.readFileSync(path.join(SAVES, name + '.json'), 'utf8');
  const ctx = await mkctx(browser, vpName === 'm360' ? { viewport: VP.m360, ...TOUCH } : { viewport: VP[vpName] ?? VP.d1280 });
  await seedStorage(ctx, { [GAME_KEY]: raw, [SETTINGS_KEY]: SETTINGS });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
  const rec = { name, meta: meta[name] ?? null };
  try {
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="ending-screen"]', { timeout: 15000 });
    await sleep(350);
    const d = await p.evaluate(READ);
    rec.d = { era: d.era, span: d.span, death: d.death, journey: d.journey, movement: d.movement, legend: d.legend, gradeRange: d.gradeRange, label: d.bar?.label ?? null, finalNetValue: d.finalNetValue, finalNetBasis: d.finalNetBasis, finalLooks: d.finalLooks, bandRect: d.bar?.band, endRect: d.bar?.end, trackRect: d.bar?.track };
    const j = judge(name, meta, d);
    rec.fail = j.f;
    rec.notes = j.notes;
    rec.mv = j.mv;
    rec.band = j.band;
    if (SHOT_SET.has(name)) {
      await p.evaluate(() => window.scrollTo(0, 0));
      await sleep(150);
      await p.screenshot({ path: path.join(SHOT_DIR, `${SHOT_PREFIX}-E-${name}-top.png`) });
      await p.evaluate(() => document.querySelector('[data-testid="ending-journey-section"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
      await sleep(200);
      await p.screenshot({ path: path.join(SHOT_DIR, `${SHOT_PREFIX}-E-${name}-journey.png`) });
      rec.shots = [`qa/screenshots/003/${SHOT_PREFIX}-E-${name}-top.png`, `qa/screenshots/003/${SHOT_PREFIX}-E-${name}-journey.png`];
    }
  } catch (e) {
    rec.err = String(e.message).slice(0, 200);
  }
  rec.errors = errs;
  table.push(rec);
  console.log(`${rec.err ? 'ERR ' : rec.fail.length ? 'FAIL' : 'ok  '} ${name} ${rec.fail?.join(' / ') ?? rec.err}${rec.notes?.length ? ' [note: ' + rec.notes.join('; ') + ']' : ''}`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, outName), JSON.stringify(table, null, 1));
const nf = table.filter((r) => r.err || r.fail.length).length;
console.log(`\n총 ${table.length} 상태, 실패 ${nf}, 메모 ${table.filter((r) => r.notes?.length).length}`);
