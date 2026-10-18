// QA-003 M7a 2회차 공격 보충: 1세 한 해 여러 마일스톤을 가진 저장을 변조한다(마일스톤 한쪽만 기록, 둘 다 기록, 둘 다 잘못된 나이, 기록 줄만 있고 seen 없음).
// 사용: QA_RP=r2- QA_SHOT_PREFIX=M7a-r2 node qa/scripts/m7a-attack3.mjs   결과: r2-cases.jsonl (M7a-A03f), 스크린샷 M7a-r2-A03f-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, RP, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7A, runCase, shot } from './m7a-lib.mjs';

const craft = JSON.parse(fs.readFileSync(path.join(OUT, `${RP}craft-saves.json`), 'utf8'));
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
const gameOf = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);
const STEPS = { age: 1, kind: 'event', title: '첫 걸음마', text: '아이가 붙잡고 서더니 처음으로 혼자 몇 걸음을 걸었습니다. 모두가 숨을 죽였습니다.', eventId: 'infant-first-steps' };
const WORD = { age: 1, kind: 'event', title: '첫 말', text: '아이가 처음으로 낱말 하나를 말했습니다. 곁에 있던 어른들이 한참을 웃었습니다.', eventId: 'infant-first-word' };
const VAX = { age: 0, kind: 'event', title: '첫 예방접종', text: '첫 예방 주사를 맞던 날, 아이는 크게 울었습니다. 어른들은 아이를 안아 달랜 뒤 집으로 돌아왔습니다.', eventId: 'infant-vaccine' };
const VARIANTS = [
  ['a 걸음마만 기록(seen·줄) → 첫 말은 이번 해에 한 번만', (d) => { d.seen = { 'infant-vaccine': 0, 'infant-first-steps': 1 }; d.history = [d.history[0], VAX, STEPS]; }, { steps: 1, word: 1 }],
  ['b 첫 말만 기록 → 걸음마는 이번 해에 한 번만', (d) => { d.seen = { 'infant-vaccine': 0, 'infant-first-word': 1 }; d.history = [d.history[0], VAX, WORD]; }, { steps: 1, word: 1 }],
  ['c 둘 다 기록 → 다시 나오지 않음', (d) => { d.seen = { 'infant-vaccine': 0, 'infant-first-steps': 1, 'infant-first-word': 1 }; d.history = [d.history[0], VAX, STEPS, WORD]; }, { steps: 1, word: 1 }],
  ['d 줄만 있고 seen 없음(기록 조작) → 한 번 더 나옴(변조 한정, 기록)', (d) => { d.seen = { 'infant-vaccine': 0 }; d.history = [d.history[0], VAX, STEPS, WORD]; }, 'record'],
  ['e 둘 다 seen이 0세(창 밖 나이) → 다시 나오지 않음', (d) => { d.seen = { 'infant-vaccine': 0, 'infant-first-steps': 0, 'infant-first-word': 0 }; d.history = [d.history[0], VAX]; }, { steps: 0, word: 0 }],
];
await runCase({ id: 'M7a-A03f', cat: '공격', title: '1세 한 해 여러 마일스톤 변조 5종: 한쪽만 기록·둘 다 기록·줄만 있고 seen 없음·창 밖 나이', steps: '1세 서술 사건 저장(코어로 마일스톤 둘이 겹치게 고른 난수)의 seen·연표를 변조해 prod에서 한 해를 진행시키고 1세 마일스톤 줄 수를 센다', expected: '멈춤 0, 걸음마·첫 말 줄이 각 한 번을 넘지 않음(seen에 있으면 다시 안 나옴)', verdict: 'PASS' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  let record = false;
  for (const [name, fn, expect] of VARIANTS) {
    const env = JSON.parse(craft['y1narr-present'].raw);
    fn(env.data);
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    await seedStorage(ctx, { [GAME_KEY]: JSON.stringify(env), [SETTINGS_KEY]: SPEED8 });
    const page = await ctx.newPage();
    await page.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 100)));
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"]', { timeout: 15000 });
    const t0 = Date.now();
    let g;
    for (;;) {
      g = await gameOf(page).catch(() => null);
      if (g && g.age >= 2) break;
      const d = await page.evaluate(() => window.__readDash()).catch(() => null);
      if (d && d.choices.length && d.choices.every((c) => c.aria !== 'true')) await page.locator(`[data-testid="choice-${d.choices[0].id}"]`).click({ timeout: 2000 }).catch(() => {});
      if (Date.now() - t0 > 25000) break;
      await sleep(80);
    }
    await sleep(300);
    const steps = g.history.filter((h) => h.eventId === 'infant-first-steps').length;
    const word = g.history.filter((h) => h.eventId === 'infant-first-word').length;
    if (errs.length) bad.push(`${name}: 페이지 오류 ${errs}`);
    if (g.age < 2) bad.push(`${name}: 멈춤(나이 ${g.age})`);
    if (expect === 'record') {
      record = true;
      notes.push(`${name} → 걸음마 ${steps}·첫 말 ${word}줄`);
    } else {
      if (steps !== expect.steps || word !== expect.word) bad.push(`${name}: 걸음마 ${steps}·첫 말 ${word}줄(기대 ${expect.steps}·${expect.word})`);
      notes.push(`${name} → ${steps}·${word}`);
    }
    if (name.startsWith('c ') || name.startsWith('d ')) shots.push(await shot(page, 'A03f', name.slice(0, 1)));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : record ? 'RECORD' : 'PASS', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
});
await browser.close();
