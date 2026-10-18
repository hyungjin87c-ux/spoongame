// QA-003 M7a 표본 수확: 개발 서버(시간 배율)에서 실제 화면으로 0~8세를 돌며 인생 기록·결정 카드·가족 카드를 기록한다(문장 품질·모순·수저 차이·동생 정합 분석의 원자료).
// 사용: node qa/scripts/m7a-harvest.mjs <era> <seedStart> <count> [pick: rot|first|last|mix] [scale=60] [stopAge=8]
// 결과: qa/results/m7a/samples-harvest-<era>.jsonl (한 판이 한 줄) — 무시 목록에 있는 대량 원자료
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, readBirth, waitGuard, DEV, OUT, sleep, READ_DASH_M7A, GAME_KEY } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const era = process.argv[2] || 'present';
const seedStart = Number(process.argv[3] || 1);
const count = Number(process.argv[4] || 5);
const pickMode = process.argv[5] || 'mix';
const scale = Number(process.argv[6] || 60);
const stopAge = Number(process.argv[7] || 8);
const outFile = path.join(OUT, `samples-${RP}harvest-${era}.jsonl`);

const DRIVER = async ({ pickMode, seed, stopAge }) => {
  const q = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { years: {}, decisions: [], logSeq: [], errors: [], ended: false };
  let lastAge = -1;
  let lastRows = 0;
  let n = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 90000) {
    if (q('[data-testid="ending-screen"]')) {
      out.ended = true;
      break;
    }
    if (q('[data-testid="error-screen"]') || q('[data-testid="superseded-screen"]')) {
      out.errors.push('뜻밖의 화면');
      break;
    }
    const s = window.__readDash();
    if (s.screen !== 'life-screen') {
      await wait(20);
      continue;
    }
    if (s.age !== lastAge) {
      lastAge = s.age;
      out.years[s.age] = { family: s.family, sib: s.siblings };
    }
    if (s.logRows.length !== lastRows) {
      out.logSeq.push({ age: s.age, added: s.logRows.slice(lastRows) });
      lastRows = s.logRows.length;
    }
    if (s.choices.length) {
      if (s.choices.every((c) => c.aria !== 'true')) {
        let idx;
        if (pickMode === 'first') idx = 0;
        else if (pickMode === 'last') idx = s.choices.length - 1;
        else idx = (seed * 7 + n * 5 + s.age) % s.choices.length;
        n++;
        out.decisions.push({ age: s.age, key: s.choiceKey, title: s.choiceTitle, text: s.choiceText, choices: s.choices.map((c) => ({ id: c.id, label: c.label, impact: c.impact, name: c.name })), picked: s.choices[idx].id });
        document.querySelector(`[data-testid="choice-${s.choices[idx].id}"]`).click();
        await wait(60);
        continue;
      }
    }
    if (s.age >= stopAge && !s.choices.length) {
      await wait(40);
      const s2 = window.__readDash();
      if (s2.logRows.length !== lastRows) {
        out.logSeq.push({ age: s2.age, added: s2.logRows.slice(lastRows) });
        lastRows = s2.logRows.length;
      }
      out.finalRows = s2.logRows;
      break;
    }
    await wait(10);
  }
  return out;
};

const browser = await launch();
for (let i = 0; i < count; i++) {
  const seed = seedStart + i;
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200));
  });
  try {
    await p.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
    await p.goto(`${DEV}?__timescale=${scale}`, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
    await toRoulette(p, era);
    await skipToBirth(p);
    const birth = await readBirth(p);
    await birthToLife(p);
    await waitGuard(p, 'pause');
    await p.locator('[data-speed="8"]').click();
    const t0 = Date.now();
    const res = await p.evaluate(DRIVER, { pickMode, seed, stopAge });
    const raw = await p.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    let game = null;
    try {
      game = JSON.parse(raw).data;
    } catch {}
    const rec = {
      era,
      seed,
      pickMode,
      ms: Date.now() - t0,
      errors: [...errors, ...res.errors],
      birth: { sentence: birth.sentence, fields: Object.fromEntries(Object.entries(birth.fields).map(([k, v]) => [k, v.value])) },
      character: game && { tier: game.character.parentWealth, parenting: game.character.parenting, gender: game.character.gender },
      report: game && { order: game.birthReport.birthOrder, mAge: game.birthReport.mother.age, fAge: game.birthReport.father.age, housing: game.birthReport.housing, mJob: game.birthReport.mother.job, fJob: game.birthReport.father.job },
      age: game && game.age,
      flags: game && game.flags,
      seen: game && game.seen,
      history: game && game.history,
      familyFund: game && game.familyFund,
      ...res,
    };
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    console.log(`${era} seed ${seed}: 결정 ${res.decisions.length}, 나이 ${rec.age}, ${Date.now() - t0}ms, 오류 ${rec.errors.length}`);
  } catch (e) {
    console.log(`${era} seed ${seed}: 실패 ${String(e.message).slice(0, 150)}`);
    fs.appendFileSync(outFile, JSON.stringify({ era, seed, pickMode, failed: String(e.message).slice(0, 300), errors }) + '\n');
  }
  await ctx.close();
}
await browser.close();
