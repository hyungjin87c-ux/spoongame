// QA-003 M9: 실시간 완주(1배속 자동·수동·건너뛰기)를 한 브라우저의 컨텍스트 여러 개로 병렬 실행한다.
// m8-hold-run.mjs(한 판 = 브라우저 한 개)와 같은 진행 로직을 함수로 옮긴 것이다 — 이 PC의 여유 메모리가 작아(약 2.7GB) 브라우저 프로세스 8개를 따로 띄우지 않으려고 컨텍스트로 묶었다.
// 사용: node qa/scripts/m9-hold-multi.mjs <preset: h1 | p1 | h2a | h2b>
//   h1  = M8 2회차 h1과 같은 8판(360×740 터치, 1배속: 자동 6 · 수동 1 · 건너뛰기 1) → hold/<tag>.json
//   p1  = P1 데스크톱 우선 1배속 자동 완주 4판(지금 1280×800 · 지난 1920×1080 · 다가올 1280×800 · 지난 360×740 터치) → p1/<tag>.json
//   h2a/h2b = M8 2회차 h2의 첫/둘째 묶음(2·4·8배속) → hold/<tag>.json
import path from 'node:path';
import { launch, freshCtx, PROD, toRoulette, skipToBirth, birthToLife, readSave, sleep, writeOut, SHOT_DIR, SHOT_PREFIX } from './m8-lib.mjs';

const D = { w: 1280, h: 800 };
const PRESETS = {
  h1: [
    { era: 'past', seed: 11, speed: 1, mode: 'auto', tag: 'a1x-past-11' },
    { era: 'past', seed: 21, speed: 1, mode: 'auto', tag: 'a1x-past-21' },
    { era: 'present', seed: 12, speed: 1, mode: 'auto', tag: 'a1x-present-12' },
    { era: 'present', seed: 22, speed: 1, mode: 'auto', tag: 'a1x-present-22' },
    { era: 'future', seed: 13, speed: 1, mode: 'auto', tag: 'a1x-future-13' },
    { era: 'future', seed: 23, speed: 1, mode: 'auto', tag: 'a1x-future-23' },
    { era: 'present', seed: 61, speed: 1, mode: 'manual', tag: 'm1x-present-61' },
    { era: 'future', seed: 71, speed: 1, mode: 'skip', tag: 's1x-future-71' },
  ],
  p1: [
    { era: 'present', seed: 141, speed: 1, mode: 'auto', tag: 'p1-present-1280x800', vp: D, touch: false, dir: 'p1' },
    { era: 'past', seed: 142, speed: 1, mode: 'auto', tag: 'p1-past-1920x1080', vp: { w: 1920, h: 1080 }, touch: false, dir: 'p1' },
    { era: 'future', seed: 143, speed: 1, mode: 'auto', tag: 'p1-future-1280x800', vp: D, touch: false, dir: 'p1' },
    { era: 'past', seed: 144, speed: 1, mode: 'auto', tag: 'p1-past-360x740-touch', vp: { w: 360, h: 740 }, touch: true, dir: 'p1' },
  ],
  smoke: [
    { era: 'present', seed: 5, speed: 8, mode: 'auto', tag: 'smoke-d', vp: D, touch: false, dir: '_smoke' },
    { era: 'future', seed: 6, speed: 8, mode: 'auto', tag: 'smoke-m', dir: '_smoke' },
  ],
  h2a: [
    { era: 'present', seed: 31, speed: 2, mode: 'auto', tag: 'a2x-present-31' },
    { era: 'past', seed: 41, speed: 4, mode: 'auto', tag: 'a4x-past-41' },
    { era: 'present', seed: 81, speed: 8, mode: 'skip', tag: 's8x-present-81' },
    { era: 'past', seed: 101, speed: 8, mode: 'auto', tag: 'a8x-past-101' },
    { era: 'present', seed: 111, speed: 8, mode: 'auto', tag: 'a8x-present-111' },
    { era: 'future', seed: 121, speed: 8, mode: 'auto', tag: 'a8x-future-121' },
  ],
  h2b: [
    { era: 'past', seed: 102, speed: 8, mode: 'auto', tag: 'a8x-past-102' },
    { era: 'present', seed: 112, speed: 8, mode: 'auto', tag: 'a8x-present-112' },
    { era: 'future', seed: 122, speed: 8, mode: 'auto', tag: 'a8x-future-122' },
    { era: 'past', seed: 103, speed: 8, mode: 'auto', tag: 'a8x-past-103' },
    { era: 'present', seed: 113, speed: 8, mode: 'auto', tag: 'a8x-present-113' },
    { era: 'future', seed: 123, speed: 8, mode: 'auto', tag: 'a8x-future-123' },
  ],
};

async function runHold(browser, spec) {
  const { era, seed, speed, mode, tag } = spec;
  const readMs = spec.readMs ?? 1500;
  const dir = spec.dir || 'hold';
  const t0 = Date.now();
  const vp = spec.vp ? { width: spec.vp.w, height: spec.vp.h } : { width: 360, height: 740 };
  const touch = spec.touch === undefined ? true : spec.touch;
  const ctx = await freshCtx(browser, { seed, settings: { era, speed, autoMode: mode === 'auto', noteCards: mode === 'auto' }, vp, touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + String(e.message).slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text().slice(0, 200));
  });
  const ext = [];
  page.on('request', (r) => {
    try {
      const h = new URL(r.url()).hostname;
      if (h !== '127.0.0.1' && h !== 'localhost' && !/^(data|blob|about):/.test(r.url())) ext.push(r.url());
    } catch {}
  });

  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
  await toRoulette(page, era);
  await skipToBirth(page);
  await birthToLife(page);

  const state = () =>
    page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const b = q('[data-testid="life-age"] b');
      const btn = q('[data-testid="choice-panel"] button[data-testid^="choice-"]:not([aria-disabled="true"])');
      return {
        ending: !!q('[data-testid="ending-screen"]'),
        life: !!q('[data-testid="life-screen"]'),
        age: b ? parseInt(b.textContent, 10) : null,
        card: !!q('[data-testid="choice-panel"]'),
        btn: btn ? btn.getAttribute('data-testid') : null,
        err: !!q('[data-testid="error-screen"]') || !!q('[data-testid="superseded-screen"]'),
      };
    });

  const deadline = Date.now() + 50 * 60 * 1000;
  let waitedAge = null;
  let skipClicks = 0;
  const skipMs = [];
  while (Date.now() < deadline) {
    const s = await state();
    if (s.ending || s.err) break;
    if (mode === 'manual' || mode === 'skip') {
      if (s.card && s.btn) {
        await sleep(readMs);
        const s2 = await state();
        if (s2.card && s2.btn) {
          await page.locator(`[data-testid="${s2.btn}"]`).click({ timeout: 4000 }).catch(() => {});
          waitedAge = s2.age + 1;
          await sleep(120);
        }
        continue;
      }
      if (mode === 'skip' && s.life && !s.card) {
        if (waitedAge !== null && s.age !== waitedAge) {
          const before = Date.now();
          const ok = await page.evaluate(() => {
            const b = document.querySelector('[data-testid="skip"]');
            if (!b || b.getAttribute('aria-disabled') === 'true') return false;
            b.click();
            return true;
          });
          if (ok) {
            skipClicks++;
            await page.waitForFunction(() => !!document.querySelector('[data-testid="choice-panel"]') || !!document.querySelector('[data-testid="ending-screen"]'), null, { timeout: 15000, polling: 10 }).catch(() => {});
            skipMs.push(Date.now() - before);
            waitedAge = null;
          }
          continue;
        }
        if (waitedAge === null) {
          const ok = await page.evaluate(() => {
            const b = document.querySelector('[data-testid="skip"]');
            if (!b || b.getAttribute('aria-disabled') === 'true') return false;
            b.click();
            return true;
          });
          if (ok) {
            skipClicks++;
            const before = Date.now();
            await page.waitForFunction(() => !!document.querySelector('[data-testid="choice-panel"]') || !!document.querySelector('[data-testid="ending-screen"]'), null, { timeout: 15000, polling: 10 }).catch(() => {});
            skipMs.push(Date.now() - before);
            waitedAge = -1;
          }
          continue;
        }
      }
    }
    await sleep(mode === 'auto' ? 1500 : 40);
  }
  await sleep(400);
  const events = await page.evaluate(() => window.__ev);
  const lat = await page.evaluate(() => window.__lat);
  const save = await readSave(page);
  const endText = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const t = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    return { block: t('[data-testid="ending-playtime"]'), value: t('[data-testid="ending-playtime-value"]'), note: t('[data-testid="ending-playtime-note"]'), hold: t('[data-testid="ending-playtime-hold"]'), decide: t('[data-testid="ending-playtime-decide"]'), choices: t('[data-testid="ending-choices"]'), death: t('[data-testid="ending-death"]'), datetime: q('[data-testid="ending-playtime-value"]')?.getAttribute('dateTime') ?? q('[data-testid="ending-playtime-value"]')?.getAttribute('datetime') ?? null };
  });
  const overflow = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await page.screenshot({ path: path.join(SHOT_DIR, `${SHOT_PREFIX}-hold-${tag}-ending.png`) }).catch(() => {});
  const out = { era, seed, speed, mode, readMs, tag, vp: `${vp.width}x${vp.height}${touch ? '-touch' : ''}`, wallSec: Math.round((Date.now() - t0) / 1000), events, lat, save: save && save.data ? save.data : save, endText, errors, ext, skipClicks, skipMs, overflow };
  writeOut(`${dir}/${tag}.json`, out);
  console.log(`[done] ${tag} ${out.vp} era=${era} seed=${seed} x${speed} ${mode} wall=${out.wallSec}s ending=${events.some((e) => e.k === 'ending')} age=${save?.data?.age} play=${JSON.stringify(save?.data?.play)} errors=${errors.length} ext=${ext.length}`);
  await ctx.close();
}

const preset = process.argv[2] || 'h1';
const specs = PRESETS[preset];
if (!specs) throw new Error('알 수 없는 묶음 ' + preset);
const browser = await launch();
console.log(`[start] ${preset} ${specs.length}판 ${new Date().toISOString()}`);
await Promise.all(specs.map((s) => runHold(browser, s).catch((e) => console.log(`[ERROR] ${s.tag} ${String(e && e.stack ? e.stack : e).slice(0, 400)}`))));
await browser.close();
console.log(`[all done] ${preset} ${new Date().toISOString()}`);
