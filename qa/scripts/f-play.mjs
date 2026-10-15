// 정상 플레이 한 판 (사람처럼 화면 버튼으로). 시간 배율 쿼리를 쓰지 않는다(실시간).
// 인자: --id F-N01 --era present --mobile 1|0 --speed 1 --mode manual|skip|auto --pick first|rotate --base dev|prod --after rebirth|none
import fs from 'node:fs';
import path from 'node:path';
import { DEV, PROD, FIN, launch, mkctx, MOBILE, DESKTOP, shot, snap, readChoice, waitScreen, con, sleep, readSave, readSettings, runCase } from './f-lib.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
    return acc;
  }, []),
);
const id = args.id || 'F-NXX';
const era = args.era || 'present';
const mobile = (args.mobile ?? '1') === '1';
const speed = Number(args.speed || 1);
const mode = args.mode || 'manual';
const pick = args.pick || 'first';
const base = args.base === 'prod' ? PROD : DEV;
const maxMs = Number(args.maxms || 40 * 60 * 1000);
const SPEC = mobile ? MOBILE : DESKTOP;

const BANNED = [
  ['등급명', /(흙|동|은|금|다이아)\s*수저/],
  ['느낌표', /[!！]/],
  ['이모지', /\p{Extended_Pictographic}/u],
];

const browser = await launch();
const ctx = await mkctx(browser, SPEC);
const page = await ctx.newPage();
const press = (loc) => (mobile ? loc.tap() : loc.click());
const rep = { id, era, mobile, speed, mode, pick, base, shots: [], choices: [], timeline: [], notes: [], overflow: [], texts: {}, gaps: 0 };
const S = async (suffix, full = false) => rep.shots.push(await shot(page, id, suffix, { full }));
let last = Date.now();
const hb = setInterval(() => {
  const n = Date.now();
  if (n - last > 5000) rep.gaps = Math.max(rep.gaps, n - last);
  last = n;
}, 1000);

con.take();
await page.goto(base + '/');
await waitScreen(page, 'title-screen');
await sleep(500);
await S('title');
rep.texts.title = await page.locator('main').innerText();
await press(page.getByRole('button', { name: '시작' }));
await waitScreen(page, 'era-screen');
await sleep(500);
await S('era-default');
rep.texts.era = await page.locator('main').innerText();
if (era !== 'present') {
  await press(page.locator(`[data-era="${era}"]`));
  await sleep(300);
  await S(`era-${era}`);
}
await press(page.getByTestId('confirm-era'));
await waitScreen(page, 'birth-screen');
await sleep(500);
await S('birth', true);
rep.texts.birth = await page.locator('main[data-testid="birth-screen"]').innerText();
rep.birthName = await page.getByTestId('birth-name').innerText();
await press(page.getByTestId('next-life'));
await waitScreen(page, 'life-screen');
const tLife = Date.now();
await sleep(600);
await S('life-enter');
if (speed !== 1) {
  await press(page.locator(`[data-speed="${speed}"]`));
  await sleep(200);
  await S(`speed-${speed}`);
}
if (mode === 'auto') {
  await press(page.getByTestId('auto'));
  await sleep(200);
  await S('auto-on');
}
let lastAge = null;
let choiceN = 0;
let skipClicks = 0;
let ended = false;
let shotAges = new Set();
while (Date.now() - tLife < maxMs) {
  const s = await snap(page);
  if (s.overflowX) rep.overflow.push({ age: s.age, screen: s.screen, scrollW: s.scrollW, clientW: s.clientW });
  if (s.screen !== 'life-screen' && s.screen !== 'ending-screen') {
    rep.notes.push(`예상 밖 화면 ${s.screen} @${s.age}`);
    await S(`unexpected-${s.screen}`);
    break;
  }
  if (s.screen === 'ending-screen') {
    ended = true;
    break;
  }
  if (s.age !== lastAge) {
    rep.timeline.push([s.age, Date.now() - tLife, s.hasChoice ? 'choice' : '']);
    lastAge = s.age;
    const a = Number(String(s.age).replace('세', ''));
    for (const t of [5, 15, 30, 55, 80]) {
      if (a >= t && !shotAges.has(t) && !s.hasChoice) {
        shotAges.add(t);
        await S(`life-age${a}`);
      }
    }
  }
  if (s.hasChoice) {
    choiceN++;
    const c = await readChoice(page);
    const rec = { n: choiceN, age: s.age, key: c.key, title: c.title, text: c.text, labels: c.choices.map((x) => x.label), shownAt: Date.now() - tLife };
    rep.choices.push(rec);
    if (choiceN <= 3 || choiceN % 6 === 0) await S(`choice-${choiceN}`);
    if (mode === 'auto') {
      const t0 = Date.now();
      await page.waitForFunction((k) => !document.querySelector(`[data-testid="choice-panel"][data-key="${k}"]`), c.key, { timeout: 30000 }).catch(() => rep.notes.push('자동 모드 선택 지연'));
      rec.autoShownMs = Date.now() - t0;
      continue;
    }
    const idx = pick === 'rotate' ? (choiceN - 1) % c.choices.length : 0;
    rec.picked = idx;
    await sleep(500); // 입력 가드 0.4초를 사람처럼 넘긴다(선택지 읽는 시간은 넣지 않는다: 순수 연출 시간 측정)
    await press(page.locator('.choice-list button').nth(idx));
    rec.pickedAt = Date.now() - tLife;
    await sleep(250);
    if (choiceN <= 3 || choiceN % 6 === 0) await S(`after-choice-${choiceN}`);
    continue;
  }
  if (mode === 'skip') {
    // 선택지가 없고 자동 모드가 아니면 "다음 결정으로"
    const sk = page.getByTestId('skip');
    if ((await sk.getAttribute('aria-disabled')) !== 'true') {
      await sk.click({ timeout: 5000 }).catch(() => {});
      skipClicks++;
      await sleep(150);
      continue;
    }
  }
  await sleep(100);
}
const tEnd = Date.now();
rep.totalMs = tEnd - tLife;
rep.ended = ended;
rep.settings = await readSettings(page);
if (ended) {
  await sleep(700);
  await S('ending');
  await S('ending-full', true);
  const g = async (t) => (await page.getByTestId(t).count()) ? (await page.getByTestId(t).innerText()).trim() : null;
  rep.ending = {
    name: await g('ending-name'),
    born: await g('ending-born'),
    death: await g('ending-death'),
    choices: await g('ending-choices'),
    journey: await g('ending-journey'),
    movement: await g('ending-movement'),
    note: await g('ending-note'),
    timelineEntries: await page.getByTestId('timeline-entry').count(),
    docHeight: await page.evaluate(() => document.documentElement.scrollHeight),
  };
  rep.texts.ending = await page.locator('main').innerText();
  const save = await readSave(page);
  rep.save = save && save.data ? { phase: save.data.phase, age: save.data.age, name: save.data.character.name, era: save.data.era, birthYear: save.data.character.birthYear, gender: save.data.character.gender, pw: save.data.character.parentWealth, stats: save.data.stats, birthStats: save.data.birthStats, flags: save.data.flags, history: save.data.history } : null;
  // 새로고침해도 같은 엔딩
  await page.reload();
  await waitScreen(page, 'ending-screen');
  await sleep(500);
  rep.endingAfterReload = (await g('ending-name')) === rep.ending.name && (await g('ending-journey')) === rep.ending.journey;
  await S('ending-reload');
  if ((args.after || 'rebirth') === 'rebirth') {
    await page.getByTestId('rebirth').scrollIntoViewIfNeeded();
    await sleep(500);
    await S('rebirth-btn');
    await press(page.getByTestId('rebirth'));
    await waitScreen(page, 'era-screen');
    await sleep(500);
    await S('rebirth-era-select');
    rep.rebirth = {
      eraDefaultOn: await page.locator('[data-era][aria-pressed="true"]').getAttribute('data-era'),
      settings: await readSettings(page),
      saveAfter: await (async () => { const s2 = await readSave(page); return s2 && s2.data ? { phase: s2.data.phase, era: s2.data.era, seedChanged: s2.data.seed !== save.data.seed, histLen: s2.data.history.length } : null; })(),
    };
    // 자동 모드가 켜진 채 새 판이면 인생 화면에서 곧바로 자동 진행(기록만)
    if (mode === 'auto') {
      await press(page.getByTestId('confirm-era'));
      await waitScreen(page, 'birth-screen');
      await sleep(400);
      await S('rebirth-birth');
      rep.rebirth.newName = await page.getByTestId('birth-name').innerText();
      await press(page.getByTestId('next-life'));
      await waitScreen(page, 'life-screen');
      const a0 = (await snap(page)).age;
      await sleep(15000);
      const s3 = await snap(page);
      rep.rebirth.autoNewGame = { auto: s3.auto, speed: s3.speed, ageAfter15s: s3.age, ageAtEnter: a0, hasChoice: s3.hasChoice };
      await S('rebirth-life-auto');
    }
  }
}
clearInterval(hb);
// 금지어 점검 (화면 텍스트)
const problems = [];
const strip = (t) => t.replace(/\d{4}년[,~]/g, '').replace(/\d{4}~\d{4}년생/g, '').replace(/\d{4}년, /g, '');
for (const [k, t] of Object.entries(rep.texts)) for (const [name, re] of BANNED) if (re.test(strip(t))) problems.push(`${k}: ${name}`);
for (const c of rep.choices) for (const [name, re] of BANNED) if (re.test(c.title + c.text + c.labels.join(' '))) problems.push(`choice ${c.n}: ${name}`);
if (rep.save) for (const h of rep.save.history) for (const [name, re] of BANNED) if (re.test(strip((h.title || '') + (h.text || '') + (h.choice || '')))) problems.push(`history ${h.age}: ${name}`);
rep.problems = problems;
rep.console = con.take();
const qtypes = rep.console.filter((c) => c.type !== 'requestfailed');
fs.writeFileSync(path.join(FIN, `${id}-report.json`), JSON.stringify(rep, null, 1));
console.log(JSON.stringify({ id, ended, totalSec: Math.round(rep.totalMs / 1000), choices: choiceN, skipClicks, overflow: rep.overflow.length, notes: rep.notes, problems, console: qtypes.length, gaps: rep.gaps, ending: rep.ending && { j: rep.ending.journey, m: rep.ending.movement, d: rep.ending.death } }));
await browser.close();
