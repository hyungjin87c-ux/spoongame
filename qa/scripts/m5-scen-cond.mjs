// QA-003 M5(r4 변경 확인): youth-return-school 조건(순자산 ≥ 0)과 youth-gig-work 영향 줄(juggle 관계 ▲·settle 자산 ▼·행복 ▼)을 실제 화면에서 본다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, OUT, GAME_KEY, sleep, shot, runCase, READ_DASH_M5, editSave } from './m5-lib.mjs';
const crafted = JSON.parse(fs.readFileSync(path.join(OUT, 'craft-saves.json'), 'utf8'));
const browser = await launch();
async function firstEvent(raw) {
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await seedStorage(ctx, { [GAME_KEY]: raw });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
  const age0 = JSON.parse(raw).data.age;
  // 선택지 카드가 뜨거나(그 해의 선택 이벤트) 한 해가 지나갈 때까지
  await page.waitForFunction(
    ([k, a]) => {
      if (document.querySelector('[data-testid="choice-panel"]')) return true;
      try {
        return JSON.parse(localStorage.getItem(k)).data.age > a;
      } catch {
        return false;
      }
    },
    [GAME_KEY, age0],
    { timeout: 15000, polling: 30 },
  );
  const d = await page.evaluate(() => window.__readDash());
  const save = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  const shotPath = d.choices.length ? await shot(page, 'E10', 'card') : null;
  await ctx.close();
  return { title: d.choiceTitle, key: d.choiceKey, choices: d.choices, pendingEvent: save.pending?.eventId ?? null, age: save.age, shotPath };
}
await runCase({ id: 'M5-D10', cat: '부채·자금', title: 'youth-return-school(r4 R-355): 순자산 ≥ 0일 때만 열린다 — 같은 바탕·같은 난수에서 순자산만 0 / +5,000 / −1(부채 1)로 바꿔 한 해를 돌린다', steps: '다음 해에 이 이벤트가 나오게 맞춘 저장(순자산 0)을 개발 서버(시간 배율 60)에서 열고, 같은 저장의 순자산을 +5,000·−1로 바꾼 것도 연다', expected: '0·+5,000: 「return-school」 카드(선택지 return·stay), −1: 이 이벤트가 안 열림(다른 이벤트나 조용한 해)' }, async () => {
  const bad = [];
  const rows = [];
  const base = crafted['return-zero'].raw;
  for (const [name, net, want] of [['0', 0, true], ['+5,000', 5000, true], ['−1', -1, false]]) {
    const raw = editSave(base, (d) => {
      d.assets.net = net;
      d.assets.debt = Math.max(0, -net);
    });
    const r = await firstEvent(raw);
    const got = r.pendingEvent === 'youth-return-school';
    rows.push(`순자산 ${name}: ${got ? `「${r.title}」 카드 ${r.choices.map((c) => c.id).join('/')}` : `이 이벤트 안 열림(${r.pendingEvent ?? '조용한 해'}, ${r.age}세)`}`);
    if (got !== want) bad.push(`순자산 ${name}: 열림=${got} 기대=${want}`);
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots: [] };
});
await runCase({ id: 'M5-E10', cat: '표기=실제', title: 'youth-gig-work(r4 R-352): juggle 관계 ▲, settle 행복 ▼·지식 ▲(순자산 −800이지만 취업 파생 소득으로 자산 표기는 문서화된 예외) — 표기와 고른 뒤 결과', steps: '순자산 800·소득 600 저장(다음 해에 이 이벤트)에서 카드를 열어 영향 줄을 읽고 세 선택지를 각각 눌러 결과 저장을 비교', expected: 'juggle에 관계 ▲(실제로 settle보다 관계가 높음), settle에 행복 ▼·지식 ▲, settle의 자산 표기 방향이 실제 소득 변화와 맞음' }, async () => {
  const bad = [];
  const base = editSave(crafted['gig-rent'].raw, (d) => (d.paused = false));
  const out = {};
  let lines = null;
  for (const cid of ['juggle', 'settle', 'learn']) {
    const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
    await seedStorage(ctx, { [GAME_KEY]: base });
    const page = await ctx.newPage();
    await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
    await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'));
    await page.locator('[data-testid="pause"]').click();
    const d = await page.evaluate(() => window.__readDash());
    lines = d.choices.map((c) => `${c.id}: ${c.impact.map((i) => i.shown).join(' · ') || '(없음)'}`);
    const pre = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
    await page.locator(`[data-testid="choice-${cid}"]`).click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="choice-panel"]'));
    await sleep(300);
    const post = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
    out[cid] = { stats: post.stats, assets: post.assets, pre: pre.stats, preAssets: pre.assets, flags: post.flags.filter((f) => !pre.flags.includes(f)) };
    await ctx.close();
  }
  const line = (cid) => lines.find((l) => l.startsWith(cid + ':')) ?? '';
  // 문서(economy-model.md 5-C 2번, r4)가 정한 모양: juggle = 관계 ▲·소득 +600이라 자산 ▲·건강 ▼·행복 ▼, settle = 순자산 −800이지만 has_career 파생 소득으로 자산 ▲(문서화된 부호 예외)·행복 ▼·지식 ▲
  if (!line('juggle').includes('관계▲')) bad.push('juggle에 관계 ▲ 없음');
  if (!line('settle').includes('행복▼')) bad.push('settle에 행복 ▼ 없음');
  if (!line('settle').includes('지식▲')) bad.push('settle에 지식 ▲ 없음');
  if (!(out.juggle.stats.relationships - out.settle.stats.relationships >= 1)) bad.push('juggle의 관계가 settle보다 안 높음');
  // settle의 자산 표기 방향이 실제 소득 변화와 맞는가: ▲이면 settle의 소득이 juggle·learn보다 커야 한다(has_career 파생)
  const settleUp = line('settle').includes('자산▲');
  if (settleUp && !(out.settle.assets.income > out.learn.assets.income)) bad.push('settle 자산 ▲인데 소득이 learn보다 크지 않음');
  const record = settleUp ? ' (settle의 「자산 ▲」는 문서화된 부호 예외 5-C 2번: 순자산 −800이지만 취업 상태 파생 소득이 큼)' : '';
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `표기 ${lines.join(' | ')} → 결과 관계 juggle ${out.juggle.stats.relationships} / settle ${out.settle.stats.relationships}, 순자산 juggle ${out.juggle.assets.net} · settle ${out.settle.assets.net} · learn ${out.learn.assets.net}, 소득 juggle ${out.juggle.assets.income} · settle ${out.settle.assets.income} · learn ${out.learn.assets.income}${record}`, shots: [] };
});
await browser.close();
