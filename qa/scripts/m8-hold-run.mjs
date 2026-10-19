// QA-003 M8 Q1·Q2: 배포 번들(prod, 시간 배율 없음)의 실제 시계로 한 판을 끝까지 돌며 연출 대기를 잰다.
// 사용: node qa/scripts/m8-hold-run.mjs <era> <seed> <speed 1|2|4|8> <mode auto|manual|skip> <tag> [readMs=1500] [mode: short30|long60 저장 변조]
//  - auto: 자동 모드로 끝까지(자동 선택은 3초 고정이라 읽는 시간이 섞이지 않는다) / manual: 카드가 뜬 뒤 readMs 뒤 첫 선택지 / skip: 결과 대기가 끝나면 「다음 결정으로」
// 결과: qa/results/m8/hold/<tag>.json (관찰 사건, 타이머 지연, 마지막 저장, 엔딩 글)
import path from 'node:path';
import { launch, freshCtx, PROD, toRoulette, skipToBirth, birthToLife, readSave, sleep, writeOut, SHOT_DIR, SHOT_PREFIX } from './m8-lib.mjs';

const [era = 'present', seedS = '1', speedS = '1', mode = 'auto', tag = 'run', readS = '1500'] = process.argv.slice(2);
const seed = Number(seedS);
const speed = Number(speedS);
const readMs = Number(readS);
const t0 = Date.now();

const browser = await launch();
const ctx = await freshCtx(browser, { seed, settings: { era, speed, autoMode: mode === 'auto', noteCards: mode === 'auto' } });
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
let lastCardKey = null;
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
        waitedAge = s2.age + 1; // 고르면 나이가 곧바로 +1 되고 결과 대기가 시작된다 — 그 대기가 끝나(나이가 한 번 더 바뀌어) 야 「다음 결정으로」를 누른다
        await sleep(120);
      }
      continue;
    }
    if (mode === 'skip' && s.life && !s.card) {
      // 결과 대기가 끝나(나이가 바뀌어) 다음 대기가 막 시작된 순간에 「다음 결정으로」
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
        // 첫 카드까지: 시작하자마자 한 번 건너뛴다
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
await page.screenshot({ path: path.join(SHOT_DIR, `${SHOT_PREFIX}-hold-${tag}-ending.png`) }).catch(() => {});
const out = { era, seed, speed, mode, readMs, tag, wallSec: Math.round((Date.now() - t0) / 1000), events, lat, save: save && save.data ? save.data : save, endText, errors, ext, skipClicks, skipMs };
writeOut(`hold/${tag}.json`, out);
console.log(`[done] ${tag} era=${era} seed=${seed} x${speed} ${mode} wall=${out.wallSec}s ending=${events.some((e) => e.k === 'ending')} age=${save?.data?.age} play=${JSON.stringify(save?.data?.play)} errors=${errors.length} ext=${ext.length}`);
await browser.close();
