// QA-003 M4 정상 플로우: 한 세상의 전 과정(첫 화면 → 룰렛 → 출생신고 → 대시보드 0세~사망 → 엔딩 → 다시 태어나기)을 사람처럼(8배속, 선택지는 첫 선택지) 돌며 매 해 대시보드 값을 기록한다.
// 사용: node qa/scripts/m4-journey.mjs <era> <seed> [viewport: m360|d1280]
// 결과: qa/results/m4/samples-journey-<era>-<seed>.jsonl (표본), journey-<era>-<seed>.json (요약), 케이스 M4-N01<era>·M4-N05<era>…
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, readBirth, readDash, shot, sleep, runCase, con, OUT, PROD, TOUCH, VP, waitGuard } from './m4-lib.mjs';

const era = process.argv[2] || 'present';
const seed = Number(process.argv[3] || 229);
const vpName = process.argv[4] || 'm360';
const tag = `${era}-${seed}-${vpName}`;
const sampleFile = path.join(OUT, `samples-journey-${tag}.jsonl`);
fs.writeFileSync(sampleFile, '');

const browser = await launch();
const ctx = await mkctx(browser, vpName === 'm360' ? { viewport: VP.m360, ...TOUCH } : { viewport: VP.d1280 });
await cleanStorageOnce(ctx);
await fixSeed(ctx, seed);
// 진행률 바·나이 변화 기록기 (DOM 변경 묶음마다 나이 글자와 바 너비를 함께 읽는다 — 새 나이 + 이전 해 100%가 같은 묶음에 보이면 깜빡임)
await ctx.addInitScript(() => {
  window.__tl = [];
  const read = () => {
    const age = document.querySelector('[data-testid="life-age"] b');
    const fill = document.querySelector('[data-testid="year-progress-fill"]');
    if (!age || !fill) return;
    const w = parseFloat(fill.style.width);
    const a = parseInt(age.textContent, 10);
    const last = window.__tl[window.__tl.length - 1];
    if (!last || last.a !== a || Math.abs(last.w - w) > 0.001) window.__tl.push({ t: Math.round(performance.now()), a, w: Math.round(w * 100) / 100 });
  };
  const start = () => new MutationObserver(read).observe(document.documentElement, { subtree: true, attributes: true, childList: true, characterData: true });
  document.documentElement ? start() : document.addEventListener('DOMContentLoaded', start);
});
const p = await ctx.newPage();

const snap = () =>
  p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const stats = {};
    for (const m of document.querySelectorAll('[data-stat]')) stats[m.getAttribute('data-stat')] = (m.querySelector('[data-testid^="stat-"]')?.textContent || '').trim();
    const meters = [...document.querySelectorAll('[data-stat] [role="meter"], [data-stat] meter')].map((m) => m.getAttribute('aria-valuenow'));
    return {
      t: Math.round(performance.now()),
      screen: ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown',
      age: q('[data-testid="life-age"] b') ? parseInt(q('[data-testid="life-age"] b').textContent, 10) : null,
      name: tx('[data-testid="life-name"]'),
      pct: tx('[data-testid="year-pct"]'),
      speed: q('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') ?? null,
      face: q('[data-testid="profile-card"] [data-testid="face"]')?.getAttribute('data-age-group') ?? null,
      edu: tx('[data-testid="profile-edu"]'),
      looks: tx('[data-testid="profile-looks"]'),
      home: tx('[data-testid="profile-home"]'),
      stats,
      meters,
      assets: tx('[data-testid="assets-note"]'),
      mother: tx('[data-testid="family-mother"]'),
      father: tx('[data-testid="family-father"]'),
      siblings: [...document.querySelectorAll('[data-testid="family-sibling"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
      spouse: tx('[data-testid="family-spouse"]'),
      child: tx('[data-testid="family-child"]'),
      peers: [...document.querySelectorAll('[data-testid="peer-now"]')].map((li) => ({
        name: li.querySelector('[data-testid="peer-now-name"]')?.textContent.trim(),
        grade: (/(흙|동|은|금|다이아몬드)수저/.exec(li.textContent) || [])[0] ?? null,
        label: li.querySelector('[data-testid="peer-now-label"]')?.textContent.trim(),
      })),
      peersTitle: tx('#peers-now-t'),
      peersSub: tx('[data-testid="peers-now-card"] .card__sub'),
      logRows: document.querySelectorAll('[data-testid="log-row"]').length,
      logFirst: tx('[data-testid="log-row"]'),
      logLast: [...document.querySelectorAll('[data-testid="log-row"]')].slice(-1).map((e) => e.textContent.replace(/\s+/g, ' ').trim())[0] ?? null,
      pin: tx('[data-testid="log-pin"]'),
      hasChoice: !!q('[data-testid="choice-panel"]'),
      choiceTitle: tx('[data-testid="choice-title"]'),
      choices: [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

const summary = { era, seed, vpName, birth: null, shots: [], errors: [] };

// ---------- 첫 화면 → 룰렛 → 출생신고 ----------
await openTitle(p, PROD);
await toRoulette(p, era);
await skipToBirth(p);
summary.birth = await readBirth(p);
const birthShot = await shot(p, `N01${era}`, `birth-${vpName}`);
await shot(p, `N01${era}`, `birth-full-${vpName}`, { full: true });
summary.birthNextLabel = await p.evaluate(() => document.querySelector('[data-testid="next-life"]')?.textContent.trim());
await birthToLife(p);
await sleep(150);

// ---------- 대시보드 0세 ----------
const first = await snap();
summary.first = first;
summary.shots.push(await shot(p, `N01${era}`, `dash-age0-${vpName}`));
summary.shots.push(await shot(p, `N01${era}`, `dash-age0-full-${vpName}`, { full: true }));
await waitGuard(p, 'pause');
await p.locator('[data-speed="8"]').click();

const SHOT_AGES = [4, 10, 16, 30, 55];
const shotDone = new Set();
let last = first;
let choicesTaken = 0;
let pendingShot = false;
const t0 = Date.now();
const lines = [];
const writeSample = (s) => fs.appendFileSync(sampleFile, JSON.stringify(s) + '\n');
writeSample(first);
let iter = 0;
for (;;) {
  const s = await snap();
  iter++;
  if (s.screen === 'ending-screen') break;
  if (s.screen !== 'life-screen') {
    summary.errors.push(`뜻밖의 화면 ${s.screen} (age ${last.age})`);
    break;
  }
  if (s.age !== last.age || s.logRows !== last.logRows || s.hasChoice !== last.hasChoice || iter % 8 === 0) writeSample(s);
  if (s.overflow) summary.errors.push(`가로 넘침 age ${s.age}`);
  if (s.age !== null && SHOT_AGES.includes(s.age) && !shotDone.has(s.age)) {
    shotDone.add(s.age);
    summary.shots.push(await shot(p, `N05${era}`, `dash-age${s.age}-${vpName}`));
  }
  if (s.hasChoice) {
    if (!pendingShot && s.age >= 12) {
      pendingShot = true;
      summary.shots.push(await shot(p, `N11${era}`, `decision-card-${vpName}`));
      summary.shots.push(await shot(p, `N11${era}`, `decision-card-full-${vpName}`, { full: true }));
      summary.decisionCard = { age: s.age, title: s.choiceTitle, choices: s.choices };
    }
    try {
      await p.waitForFunction(() => {
        const b = document.querySelector('[data-testid="choice-panel"] .choice');
        return b && b.getAttribute('aria-disabled') !== 'true';
      }, null, { timeout: 3000 });
      await p.locator('[data-testid="choice-panel"] .choice').first().click({ timeout: 3000 });
      choicesTaken++;
    } catch (e) {
      lines.push(`선택 실패 age ${s.age}: ${String(e.message).slice(0, 80)}`);
    }
    await sleep(60);
  } else {
    await sleep(110);
  }
  last = s;
  if (Date.now() - t0 > 900000) {
    summary.errors.push('시간 초과(15분)');
    break;
  }
}
summary.choicesTaken = choicesTaken;
summary.elapsedSec = Math.round((Date.now() - t0) / 1000);
summary.tl = await p.evaluate(() => window.__tl);

// ---------- 엔딩 ----------
if ((await snap()).screen === 'ending-screen') {
  await sleep(500);
  const end = await p.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const f = q('[data-testid="ending-screen"] [data-testid="face"], [data-testid="ending-screen"] .face');
    const r = f ? f.getBoundingClientRect() : null;
    return {
      h1: tx('h1'),
      header: !!q('header [role="img"], header svg'),
      headerText: tx('header'),
      face: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
      body: document.body.innerText,
      stats: tx('[data-testid="ending-stats"]'),
      looksNum: /외모\s*\d+\s*점/.test(document.body.innerText) || /외모\s*\d+(?!\s*%)/.test(document.body.innerText),
      rebirth: !!q('[data-testid="rebirth"]'),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  summary.ending = end;
  summary.shots.push(await shot(p, `N12${era}`, `ending-top-${vpName}`));
  summary.shots.push(await shot(p, `N12${era}`, `ending-full-${vpName}`, { full: true }));
  await waitGuard(p, 'rebirth').catch(() => {});
  await p.getByTestId('rebirth').click().catch(() => {});
  await sleep(500);
  summary.afterRebirth = await p.evaluate(() => ({ title: !!document.querySelector('[data-testid="title-screen"]'), start: !!document.querySelector('[data-testid="start-birth"]') }));
  summary.shots.push(await shot(p, `N12${era}`, `after-rebirth-${vpName}`));
}
summary.console = con.take();
summary.requests = con.takeRequests().filter((u) => { try { const h = new URL(u).hostname; return !(h === '127.0.0.1' || h === 'localhost'); } catch { return true; } });
fs.writeFileSync(path.join(OUT, `journey-${tag}.json`), JSON.stringify(summary));
console.log('DONE', tag, 'elapsed', summary.elapsedSec, 's choices', choicesTaken, 'errors', summary.errors.length, 'console', summary.console.length, 'ext', summary.requests.length);
await browser.close();
