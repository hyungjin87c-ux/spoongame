// SPEC-005 r4 QA 5 보충: 사람이 고르는 결정 카드 전부를 360×740(터치)로 열어 첫 선택지가 시트 안에서 스크롤 없이 보이는지·가로 넘침·시트 맨 끝 자동 고르기 버튼 도달을 센다.
// 사용: node qa/scripts/q005r4-scan.mjs [--h 740] [--limit 999]
import { launchChromium, Watch, PROD, DEV, run, ok, bad, note, sleep, seedPage, DEFAULT_SETTINGS, oracle, pendingState, writeJson } from './q005r4-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const H = Number(arg('h', '740'));
const LIMIT = Number(arg('limit', '999'));
const b = await launchChromium();
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const cards = await oracle(
  dev,
  `const mod = await import('/src/data/events/index.ts');
  const out = [];
  for (const ev of mod.EVENT_POOL.events) {
    if (ev.choices === undefined) continue;
    if (!core.possibleAgesOf(ev).some((a) => core.decisionFor(ev.id, a) === 'self')) continue;
    const era = (ev.eras ?? ['present']).includes('present') ? 'present' : ev.eras[0];
    out.push({ id: ev.id, era });
  }
  return out;`,
);
console.log('cards', cards.length);
const MANUAL = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false };
const ctx = await b.newContext({ viewport: { width: 360, height: H }, hasTouch: true, isMobile: true, locale: 'ko-KR', deviceScaleFactor: 1 });
const watch = new Watch('scan').attach(ctx);
const rows = [];
for (const c of cards.slice(0, LIMIT)) {
  const st = await pendingState(dev, c.id, { era: c.era });
  if (!st) { rows.push({ id: c.id, skip: true }); continue; }
  const page = await ctx.newPage();
  await seedPage(page, { game: st, settings: MANUAL });
  await page.goto(PROD + '/');
  await page.getByTestId('choice-panel').waitFor({ timeout: 30000 }).catch(() => null);
  await sleep(350);
  const r = await page.evaluate(() => {
    const sheet = document.querySelector('[data-testid="choice-panel"]');
    if (!sheet) return null;
    const sr = sheet.getBoundingClientRect();
    const ch = [...document.querySelectorAll('.choice')].map((c) => c.getBoundingClientRect());
    const root = document.documentElement;
    // 시트 맨 끝으로 스크롤해 자동 고르기 버튼이 닿는지
    sheet.scrollTop = sheet.scrollHeight;
    const ab = document.querySelector('[data-testid="auto-on-btn"]')?.getBoundingClientRect();
    return { first: ch[0] ? ch[0].bottom <= sr.bottom + 0.5 : null, firstPeek: ch[0] ? ch[0].top < sr.bottom : null, n: ch.length, over: root.scrollWidth - root.clientWidth, autoReach: ab ? ab.bottom <= innerHeight + 0.5 && ab.top >= 0 : null, hasAsk: !!document.querySelector('[data-testid="choice-ask"]') };
  });
  rows.push({ id: c.id, ...(r ?? { missing: true }) });
  await page.close();
}
const sum = (f) => rows.filter(f).length;
const got = rows.filter((r) => !r.skip && !r.missing);
const w = watch.take();
const res = { h: H, total: rows.length, measured: got.length, skipped: rows.filter((r) => r.skip || r.missing).map((r) => r.id), firstVisible: sum((r) => r.first), firstNotVisible: got.filter((r) => !r.first).map((r) => r.id), peeking: got.filter((r) => !r.first && r.firstPeek).length, overflow: got.filter((r) => r.over !== 0).map((r) => r.id), autoNotReached: got.filter((r) => !r.autoReach).map((r) => r.id), noAsk: got.filter((r) => !r.hasAsk).map((r) => r.id), console: w.console.length, external: w.external.length };
writeJson(`scan-${H}.json`, { res, rows });
console.log(JSON.stringify(res));
await run({ id: `C-SCAN-${H}`, area: '시트 높이', title: `360×${H} 터치: 사람이 고르는 결정 카드 ${got.length}장 전수 — 첫 선택지 보임·넘침·자동 고르기 버튼 도달`, steps: '카드마다 시트를 열어 측정 후 시트 맨 끝으로 스크롤', expected: H === 740 ? '첫 선택지 전부 보임(e2e FLOOR 90/90 불변), 넘침 0, 버튼 도달 전부, 질문 줄 전부' : '넘침 0, 버튼 도달 전부(첫 선택지 보임 수는 기록)' }, async () => {
  const good = res.overflow.length === 0 && res.autoNotReached.length === 0 && res.noAsk.length === 0 && res.console === 0 && (H !== 740 || res.firstNotVisible.length === 0);
  return (good ? (H === 740 ? ok : note) : bad)(JSON.stringify({ measured: res.measured, firstVisible: res.firstVisible, firstNotVisible: H === 740 ? res.firstNotVisible : res.firstNotVisible.length, peeking: res.peeking, overflow: res.overflow, autoNotReached: res.autoNotReached, noAsk: res.noAsk, console: res.console }));
});
await b.close();
await devB.close();
