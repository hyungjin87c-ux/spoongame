// SPEC-005 QA 1 정상 플레이: 처음부터 사람처럼 눌러 엔딩까지 완주하며 감사한다. 프로덕션 빌드(4391) 기본.
// 사용: node qa/scripts/q005-play.mjs --id N01 --era present --vp d1280 --speed 4 [--engine chromium|webkit] [--base prod|dev] [--seed 1]
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, RES, sleep, record, shot, readSave, readSettings, overflowOf, logAges, nonIncreasing, ok, bad, note } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const ID = arg('id', 'N01');
const ERA = arg('era', 'present');
const VPN = arg('vp', 'd1280');
const SPEED = Number(arg('speed', '4'));
const ENGINE = arg('engine', 'chromium');
const TS = arg('ts', '');
const BASE = arg('base', 'prod') === 'dev' ? DEV + '/?__guard=0' + (TS ? `&__timescale=${TS}` : '') : PROD + '/';
const SEED = Number(arg('seed', '7'));
const MAX_MIN = Number(arg('maxmin', '40'));
const MAX_SKIPS = Number(arg('skips', '6'));
const touch = !!VP[VPN].hasTouch;

const rnd = (() => {
  let a = SEED >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
const watch = new Watch(ID).attach(ctx);
const page = await ctx.newPage();

// 인-페이지 관찰기: 부모 카드·결정 카드·기록 줄 순서를 놓치지 않게 DOM 변화마다 훑는다
await page.addInitScript(() => {
  const w = window;
  w.__qa = { cards: [], picks: [], audits: [], notes: [], lastAge: -1, lastPc: null, lastCh: null };
  const t0 = performance.now();
  const ageNow = () => Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0;
  const scan = () => {
    const q = w.__qa;
    const pc = document.querySelector('[data-testid="parent-card"]');
    const key = pc ? pc.getAttribute('data-key') : null;
    if (pc && key !== q.lastPc) {
      const a = document.activeElement;
      q.cards.push({
        t: Math.round(performance.now() - t0),
        key,
        by: pc.getAttribute('data-by'),
        age: ageNow(),
        chip: pc.querySelector('[data-testid="parent-chip"]')?.innerText ?? null,
        stamp: pc.querySelector('[data-testid="parent-stamp"]')?.innerText ?? null,
        label: pc.querySelector('[data-testid="parent-label"]')?.innerText ?? null,
        title: pc.querySelector('[data-testid="parent-title"]')?.innerText ?? null,
        hint: !!pc.querySelector('[data-testid="parent-hint"]'),
        buttons: pc.querySelectorAll('button').length,
        impact: pc.querySelector('.impact, [data-testid="impact"]')?.innerText?.slice(0, 120) ?? null,
        modal: !!pc.closest('[role="dialog"]'),
        focusIn: !!(a && pc.contains(a)),
        focusTag: a ? `${a.tagName}${a.dataset?.testid ? '#' + a.dataset.testid : ''}` : null,
        aboveLog: (() => { const l = document.querySelector('[data-testid="log"]'); return l ? pc.getBoundingClientRect().bottom <= l.getBoundingClientRect().top + 1 : null; })(),
      });
    }
    q.lastPc = key;
    const ch = document.querySelector('[data-testid="choice-panel"]');
    const ck = ch ? ch.getAttribute('data-key') : null;
    if (ch && ck !== q.lastCh) {
      q.picks.push({ t: Math.round(performance.now() - t0), key: ck, age: ageNow(), mode: ch.getAttribute('data-mode'), title: ch.querySelector('[data-testid="choice-title"]')?.innerText ?? '', n: ch.querySelectorAll('.choices-list button.choice').length });
    }
    q.lastCh = ck;
    const age = ageNow();
    if (age !== q.lastAge && document.querySelector('[data-testid="life-screen"]')) {
      q.lastAge = age;
      const rows = [...document.querySelectorAll('[data-testid="log-row"]')].map((li) => {
        const m = /^\s*(\d+)\s*세/.exec(li.innerText ?? '');
        return m ? Number(m[1]) : -1;
      });
      const inc = rows.every((v, i) => i === 0 || rows[i - 1] >= v);
      const root = document.documentElement;
      q.audits.push({ age, rows: rows.length, ordered: inc, first: rows[0], over: root.scrollWidth - root.clientWidth, topPx: document.querySelector('[data-testid="log-list"]')?.scrollTop ?? null });
    }
  };
  const start = () => {
    new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    scan();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
});

const out = { id: ID, era: ERA, vp: VPN, speed: SPEED, engine: ENGINE, selfPicks: [], notesSkipped: 0, skips: 0, started: new Date().toISOString() };
const t0 = Date.now();
await page.goto(BASE);
await page.getByTestId('title-screen').waitFor({ timeout: 90000 });
// 첫 화면: 세상 고르기 → 태어나기 → (룰렛은 한 번은 끝까지 보지 않고 건너뛴다) → 출생신고 → 살아가기
const click = async (loc) => (touch ? loc.tap() : loc.click());
const pressTid = async (id) => {
  const loc = page.getByTestId(id);
  await loc.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); return e && e.getAttribute('aria-disabled') !== 'true'; }, id, { timeout: 30000 });
  await click(loc);
};
if (ERA !== 'present') {
  await page.waitForFunction(() => { const e = document.querySelector('[data-testid="start-birth"]'); return e && e.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 30000 });
  const radio = page.getByTestId(`era-${ERA}`);
  await radio.scrollIntoViewIfNeeded();
  await radio.check();
}
await pressTid('start-birth');
await page.getByTestId('roulette-screen').waitFor();
if ((await page.getByTestId('roulette-screen').getAttribute('data-state')) === 'spinning') await pressTid('skip-roulette');
await page.waitForFunction(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state') === 'result');
await pressTid('to-birth');
await page.getByTestId('birth-screen').waitFor();
out.birthText = await page.getByTestId('birth-screen').innerText();
await pressTid('next-life');
await page.getByTestId('life-screen').waitFor();
// 배속
if (SPEED !== 1) await click(page.locator(`[data-speed="${SPEED}"]`));
out.afterStart = Date.now() - t0;

let lastAge = -1;
let lastProgress = Date.now();
let guard = 0;
while (Date.now() - t0 < MAX_MIN * 60000) {
  guard++;
  const scr = await page.evaluate(() => (document.querySelector('[data-testid="ending-screen"]') ? 'ending' : document.querySelector('[data-testid="life-screen"]') ? 'life' : 'other'));
  if (scr === 'ending') break;
  if (scr !== 'life') {
    out.problem = 'screen=' + scr;
    break;
  }
  // 기록 카드 시트(생각 남기기 권유) → 건너뛰기
  const sheet = await page.locator('[data-testid="note-sheet"]').count();
  if (sheet > 0) {
    const skip = page.getByTestId('note-skip');
    if ((await skip.count()) > 0) {
      await sleep(600 + rnd() * 800);
      await click(skip).catch(() => {});
      out.notesSkipped++;
    }
  }
  // 사람이 고르는 결정 카드
  const ch = page.getByTestId('choice-panel');
  if ((await ch.count()) > 0) {
    const info = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="choice-panel"]');
      const btns = [...p.querySelectorAll('.choices-list button.choice')].map((b) => ({ id: b.getAttribute('data-testid'), label: b.innerText.trim().slice(0, 60), dis: b.getAttribute('aria-disabled') === 'true' }));
      return { key: p.getAttribute('data-key'), btns, age: Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0 };
    });
    await sleep(900 + rnd() * 1400);
    const pick = info.btns[Math.floor(rnd() * info.btns.length)];
    const loc = page.getByTestId(pick.id);
    await page.waitForFunction((tid) => { const e = document.querySelector(`[data-testid="${tid}"]`); return e && e.getAttribute('aria-disabled') !== 'true'; }, pick.id, { timeout: 15000 }).catch(() => {});
    await click(loc).catch((e) => (out.clickErr = String(e).slice(0, 120)));
    out.selfPicks.push({ key: info.key, age: info.age, pick: pick.id, n: info.btns.length });
    lastProgress = Date.now();
    await sleep(300);
    continue;
  }
  // 가끔 「다음 결정으로」 (사람이 지루할 때) — 2~3번에 한 번
  const age = await page.evaluate(() => Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0);
  if (age !== lastAge) {
    lastAge = age;
    lastProgress = Date.now();
    if (age > 0 && age % 9 === 0 && out.skips < MAX_SKIPS) {
      const sk = page.getByTestId('skip');
      if ((await sk.getAttribute('aria-disabled')) !== 'true') {
        await click(sk).catch(() => {});
        out.skips++;
      }
    }
  }
  if (Date.now() - lastProgress > 120000) {
    out.problem = '120초 동안 나이가 안 바뀜 age=' + age;
    break;
  }
  await sleep(250);
}
out.elapsedSec = Math.round((Date.now() - t0) / 1000);

// ---- 엔딩 감사 ----
const ending = (await page.getByTestId('ending-screen').count()) > 0;
if (ending) {
  await sleep(800);
  out.ending = await page.evaluate(() => {
    const t = (s) => document.querySelector(`[data-testid="${s}"]`)?.innerText?.replace(/\s+/g, ' ').trim() ?? null;
    const entries = [...document.querySelectorAll('[data-testid="timeline-entry"]')].map((li) => ({ kind: li.getAttribute('data-kind'), text: li.innerText.replace(/\s+/g, ' ').slice(0, 160), picked: li.querySelector('[data-testid="timeline-picked"]')?.getAttribute('data-by') ?? null }));
    const groups = [...document.querySelectorAll('[data-testid^="timeline-"][data-testid$="y"], [data-testid^="timeline-infant"], [data-testid^="timeline-school"], [data-testid^="timeline-youth"], [data-testid^="timeline-middle"], [data-testid^="timeline-senior"]')].map((g) => g.getAttribute('data-testid'));
    return {
      name: t('ending-name'), span: t('ending-span'), death: t('ending-death'), choices: t('ending-choices'), delegated: t('ending-delegated'), order: t('ending-timeline-order'), gentle: t('ending-gentle'), playtime: t('ending-playtime'), playtimeNote: t('ending-playtime-note'),
      entries: entries.length, pickedBy: { parent: entries.filter((e) => e.picked === 'parent').length, child: entries.filter((e) => e.picked === 'child').length, self: entries.filter((e) => e.kind === 'choice' && !e.picked).length },
      groups, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      firstEntries: entries.slice(0, 3), sample: entries.filter((e) => e.picked).slice(0, 4),
    };
  });
  out.endingOver = await overflowOf(page);
}
out.qa = await page.evaluate(() => window.__qa).catch(() => null);
out.save = await readSave(page);
if (out.save && out.save.data) {
  const d = out.save.data;
  out.final = { phase: d.phase, age: d.age, play: d.play ?? null, histLen: d.history?.length, byCounts: { parent: d.history.filter((h) => h.by === 'parent').length, child: d.history.filter((h) => h.by === 'child').length, self: d.history.filter((h) => h.kind === 'choice' && !h.by).length }, gentleUsed: d.gentleUsed ?? null };
  out.choiceEvents = d.history.filter((h) => h.kind === 'choice').map((h) => ({ age: h.age, by: h.by ?? 'self', eventId: h.eventId ?? null }));
  out.era = d.era;
}
out.watch = watch.take();
fs.writeFileSync(path.join(RES, `play-${ID}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ id: ID, elapsedSec: out.elapsedSec, problem: out.problem ?? null, ending: out.ending ? { choices: out.ending.choices, delegated: out.ending.delegated, order: out.ending.order, death: out.ending.death } : null, cards: out.qa?.cards.length, selfPicks: out.selfPicks.length, audits: out.qa?.audits.length, console: out.watch.console.length, external: out.watch.external.length }));
await browser.close();
