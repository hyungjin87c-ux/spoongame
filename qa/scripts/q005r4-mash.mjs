// SPEC-005 r4 QA 4: 자동 고르기 버튼 연타 정밀 측정 — 전환 시각과 이후 입력이 닿은 곳(data-testid)·경과 시간을 기록한다.
// 사용: node qa/scripts/q005r4-mash.mjs [--gap 35] [--n 12] [--engine webkit]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, sleep, readSave, seedPage, DEFAULT_SETTINGS, pendingState, writeJson } from './q005r4-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const GAP = Number(arg('gap', '35'));
const N = Number(arg('n', '12'));
const ENGINE = arg('engine', 'chromium');
const VPN = arg('vp', 'd1280');
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const st = await pendingState(dev, 'youth-startup');
const MANUAL = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false };

const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
const w = new Watch('mash').attach(ctx);
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__rec = [];
  window.__mode = [];
  document.addEventListener(
    'click',
    (e) => {
      const b = e.target instanceof Element ? e.target.closest('button, a') : null;
      window.__rec.push({ t: Math.round(performance.now()), id: b ? b.getAttribute('data-testid') || b.tagName : '비버튼', guard: b ? b.getAttribute('aria-disabled') : null });
    },
    true,
  );
  const scan = () => {
    const m = document.querySelector('[data-testid="choice-panel"]')?.getAttribute('data-mode') ?? 'none';
    const last = window.__mode[window.__mode.length - 1];
    if (!last || last.m !== m) window.__mode.push({ t: Math.round(performance.now()), m });
  };
  const start = () => {
    new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    scan();
  };
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start);
});
await seedPage(page, { game: st, settings: MANUAL });
await page.goto(PROD + '/');
await page.getByTestId('choice-panel').waitFor({ timeout: 60000 });
await sleep(900);
await page.waitForFunction(() => document.querySelector('[data-testid="auto-on-btn"]')?.getAttribute('aria-disabled') !== 'true');
await page.getByTestId('auto-on-btn').scrollIntoViewIfNeeded();
await sleep(250);
const box = await page.getByTestId('auto-on-btn').boundingBox();
const x = box.x + box.width / 2;
const y = box.y + box.height / 2;
const before = (await readSave(page))?.data?.history?.filter((h) => h.kind === 'choice' && h.by === undefined).length;
const clickTimes = [];
for (let i = 0; i < N; i++) {
  await page.mouse.click(x, y);
  clickTimes.push(await page.evaluate(() => Math.round(performance.now())));
  await sleep(GAP);
}
await sleep(1200);
const rec = await page.evaluate(() => window.__rec);
const modes = await page.evaluate(() => window.__mode);
const s = await readSave(page);
const after = s?.data?.history?.filter((h) => h.kind === 'choice' && h.by === undefined).length;
const tSwitch = modes.find((m) => m.m === 'inline')?.t ?? null;
const under = await page.evaluate(([px, py]) => {
  const e = document.elementFromPoint(px, py);
  const b = e?.closest('button');
  return b ? b.getAttribute('data-testid') : e?.tagName;
}, [x, y]);
console.log(JSON.stringify({ gap: GAP, n: N, tSwitch, modes, clicks: rec.map((r) => ({ dt: tSwitch ? r.t - tSwitch : null, id: r.id, guard: r.guard })), choicesBefore: before, choicesAfter: after, underPointerAfter: under, vp: VPN }, null, 0));
writeJson(`mash-${ENGINE}-${VPN}-${GAP}x${N}.json`, { tSwitch, modes, rec, before, after });
console.log(JSON.stringify(w.take()));
await browser.close();
await devB.close();
