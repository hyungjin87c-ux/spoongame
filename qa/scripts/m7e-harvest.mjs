// QA-003 M7e 표본 수확(전 생애): 개발 서버(시간 배율)에서 실제 화면으로 0세~사망까지 돌며
//  - 결정 카드마다 제목·본문·선택지(라벨·영향 줄·이름)·안내 줄·자산 카드·또래 칸·가족 카드를 읽고, 정책대로 하나를 눌러 계속한다
//  - 저장이 쓰일 때마다 얇은 스냅샷(나이·플래그·주거·순자산·대기 카드·연표 길이)을 모으고(모순 분석의 상태 근거)
//  - 끝나면 최종 저장의 연표(history, 화면에 나온 사건·결과 문장 전부)와 엔딩 화면의 글을 남긴다
// 사용: node qa/scripts/m7e-harvest.mjs <era> <seedStart> <count> [pick: rot|first|last|mix] [scale=60] [tag]
// 결과: qa/results/m7e/samples-harvest-<era>[-tag].jsonl (한 판이 한 줄) — 무시 목록에 있는 대량 원자료
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, toRoulette, skipToBirth, birthToLife, readBirth, waitGuard, DEV, OUT, GAME_KEY, READ_DASH_M7E } from './m7e-lib.mjs';

const era = process.argv[2] || 'present';
const seedStart = Number(process.argv[3] || 1);
const count = Number(process.argv[4] || 5);
const pickMode = process.argv[5] || 'mix';
const scale = Number(process.argv[6] || 60);
const tag = process.argv[7] || '';
const outFile = path.join(OUT, `samples-harvest-${era}${tag ? '-' + tag : ''}.jsonl`);

const DRIVER = async ({ pickMode, seed }) => {
  const SAVE = 'suzeo-game:save';
  const q = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { years: {}, decisions: [], errors: [], ended: false, endingText: null };
  let lastAge = -1;
  let n = 0;
  const t0 = performance.now();
  const snap = () => {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE)).data;
      return { age: d.age, flags: d.flags, dwelling: d.assets ? d.assets.dwelling : null, net: d.assets ? d.assets.net : null, debt: d.assets ? d.assets.debt : null, income: d.assets ? d.assets.income : null, tier: d.character ? d.character.parentWealth : null, order: d.birthReport ? d.birthReport.birthOrder : null, familyFund: d.familyFund, stats: d.stats, pending: d.pending ? d.pending.key : null };
    } catch {
      return null;
    }
  };
  while (performance.now() - t0 < 170000) {
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
      out.years[s.age] = snap();
    }
    if (s.choices.length && s.choices.every((c) => c.aria !== 'true')) {
      let idx;
      if (pickMode === 'first') idx = 0;
      else if (pickMode === 'last') idx = s.choices.length - 1;
      else if (pickMode.startsWith('prefer:') && s.choices.some((c) => c.id === pickMode.slice(7))) idx = s.choices.findIndex((c) => c.id === pickMode.slice(7)); // r2: 그 선택지가 보이면 항상 고른다(없으면 mix)
      else idx = (seed * 7 + n * 5 + s.age) % s.choices.length;
      n++;
      const st = snap();
      out.decisions.push({
        age: s.age,
        key: s.choiceKey,
        title: s.choiceTitle,
        text: s.choiceText,
        choices: s.choices.map((c) => ({ id: c.id, label: c.label, impact: c.impact, name: c.name })),
        hint: s.hint,
        assetsCard: s.assetsCard,
        peersNow: s.peersNow,
        family: s.family,
        siblings: s.siblings,
        st,
        picked: s.choices[idx].id,
      });
      document.querySelector(`[data-testid="choice-${s.choices[idx].id}"]`).click();
      await wait(60);
      continue;
    }
    await wait(10);
  }
  await wait(250);
  out.endingText = q('[data-testid="ending-screen"]') ? document.body.innerText : null;
  out.snaps = window.__snaps ?? [];
  out.final = (() => {
    try {
      return JSON.parse(localStorage.getItem(SAVE)).data;
    } catch {
      return null;
    }
  })();
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
    await p.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
    // 저장이 쓰일 때마다 (나이·플래그·주거·순자산·대기 카드·연표 길이) 얇은 스냅샷을 모은다 — 모순 분석의 상태 근거(해마다 눈으로 읽는 것보다 빠짐이 없다)
    await p.addInitScript(() => {
      window.__snaps = [];
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'suzeo-game:save') {
          try {
            const d = JSON.parse(v).data;
            const sn = { age: d.age, ph: d.phase, fl: d.flags, dw: d.assets ? d.assets.dwelling : null, net: d.assets ? d.assets.net : null, pe: d.pending ? d.pending.key : null, hl: d.history.length };
            const sig = [sn.age, sn.ph, sn.fl.join(','), sn.dw, sn.pe, sn.hl].join('|');
            const last = window.__snaps[window.__snaps.length - 1];
            if (!last || last.sig !== sig) {
              sn.sig = sig;
              window.__snaps.push(sn);
            }
          } catch {}
        }
        return orig.apply(this, arguments);
      };
    });
    await p.goto(`${DEV}?__timescale=${scale}`, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
    await toRoulette(p, era);
    await skipToBirth(p);
    const birth = await readBirth(p);
    await birthToLife(p);
    await waitGuard(p, 'pause');
    await p.locator('[data-speed="8"]').click();
    const t0 = Date.now();
    const res = await p.evaluate(DRIVER, { pickMode, seed });
    const rec = {
      era,
      seed,
      pickMode,
      ms: Date.now() - t0,
      errors: [...errors, ...res.errors],
      birth: { sentence: birth.sentence, fields: Object.fromEntries(Object.entries(birth.fields).map(([k, v]) => [k, v.value])) },
      ...res,
    };
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    console.log(`${era} seed ${seed}: 결정 ${res.decisions.length}, 사망 ${res.final && res.final.death ? res.final.death.age : '?'}, ${Date.now() - t0}ms, 오류 ${rec.errors.length}`);
  } catch (e) {
    console.log(`${era} seed ${seed}: 실패 ${String(e.message).slice(0, 150)}`);
    fs.appendFileSync(outFile, JSON.stringify({ era, seed, pickMode, failed: String(e.message).slice(0, 300), errors }) + '\n');
  }
  await ctx.close();
}
await browser.close();
