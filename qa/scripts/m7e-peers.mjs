// QA-003 M7e 또래 칸 「다시 일하는 사람」: 개발 서버(시간 배율)에서 한 판을 끝까지 돌며 나이가 바뀔 때마다 또래 4명의 이름·라벨을 모두 기록하고(빠짐 없이: 나이마다 DOM이 바뀔 때 읽는다),
// 화면 글자만으로 규칙을 대조한다 — ① 은퇴 뒤의 일하는 모습은 「다시 일하는 사람」이어야 한다 ② 「다시 일하는 사람」은 앞선 해에 「은퇴」가 있었던 또래에게만 나온다 ③ 그 밖의 낯선 라벨이 없다.
// 사용: node qa/scripts/m7e-peers.mjs <era> <seedStart> <count> [scale=60]   결과: qa/results/m7e/peers-<era>.json
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, toRoulette, skipToBirth, birthToLife, waitGuard, DEV, OUT } from './m7e-lib.mjs';

const era = process.argv[2] || 'present';
const seedStart = Number(process.argv[3] || 1);
const count = Number(process.argv[4] || 6);
const scale = Number(process.argv[5] || 60);
const KNOWN = ['어린 시절', '학교에 다님', '일하는 사람', '다시 일하는 사람', '구직 중', '돌봄', '은퇴'];

const DRIVER = async () => {
  const q = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { byAge: {}, ended: false };
  const grab = () => {
    const age = q('[data-testid="life-age"] b') ? parseInt(q('[data-testid="life-age"] b').textContent, 10) : null;
    if (age === null) return;
    const items = [...document.querySelectorAll('[data-testid="peers-now-card"] [data-testid="peer-now"]')].map((e) => ({ name: e.querySelector('[data-testid="peer-now-name"]')?.textContent.trim(), label: e.querySelector('[data-testid="peer-now-label"]')?.textContent.trim() }));
    if (items.length) out.byAge[age] = items; // 같은 나이의 마지막 값(그 나이 동안 화면에 있던 값)
  };
  const mo = new MutationObserver(grab);
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: false });
  const t0 = performance.now();
  while (performance.now() - t0 < 170000) {
    if (q('[data-testid="ending-screen"]')) {
      out.ended = true;
      break;
    }
    const panel = q('[data-testid="choice-panel"]');
    if (panel) {
      const btns = [...panel.querySelectorAll('.choice')];
      if (btns.length && btns.every((b) => b.getAttribute('aria-disabled') !== 'true')) {
        btns[0].click();
        await wait(60);
        continue;
      }
    }
    grab();
    await wait(8);
  }
  mo.disconnect();
  return out;
};

const browser = await launch();
const results = [];
for (let i = 0; i < count; i++) {
  const seed = seedStart + i;
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  try {
    await p.goto(`${DEV}?__timescale=${scale}`, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
    await toRoulette(p, era);
    await skipToBirth(p);
    await birthToLife(p);
    await waitGuard(p, 'pause');
    await p.locator('[data-speed="8"]').click();
    const res = await p.evaluate(DRIVER);
    const ages = Object.keys(res.byAge).map(Number).sort((a, b) => a - b);
    // 대조
    const viol = [];
    const names = new Set();
    for (const a of ages) for (const it of res.byAge[a]) names.add(it.name);
    const missingAges = [];
    for (let a = ages[0]; a <= ages[ages.length - 1]; a++) if (!res.byAge[a]) missingAges.push(a);
    let nReturn = 0;
    let nRetired = 0;
    for (const nm of names) {
      let sawRetired = false;
      for (const a of ages) {
        const it = res.byAge[a].find((x) => x.name === nm);
        if (!it) continue;
        if (!KNOWN.includes(it.label)) viol.push(`${nm} ${a}세 낯선 라벨 「${it.label}」`);
        if (it.label === '은퇴') { sawRetired = true; nRetired++; }
        if (it.label === '다시 일하는 사람') { nReturn++; if (!sawRetired) viol.push(`${nm} ${a}세 「다시 일하는 사람」인데 앞선 해에 은퇴 없음`); }
        if (it.label === '일하는 사람' && sawRetired) viol.push(`${nm} ${a}세 은퇴 뒤인데 「일하는 사람」 (「다시 일하는 사람」이어야 함)`);
      }
    }
    results.push({ era, seed, ended: res.ended, ages: [ages[0], ages[ages.length - 1]], nAges: ages.length, missingAges, nNames: names.size, nReturn, nRetired, viol });
    console.log(`${era} seed ${seed}: 나이 ${ages[0]}~${ages[ages.length - 1]} (${ages.length}개, 빠진 ${missingAges.length}), 또래 ${names.size}명, 은퇴 줄 ${nRetired}, 다시 일하는 사람 줄 ${nReturn}, 위반 ${viol.length}${viol.length ? ' ' + viol.slice(0, 2).join(' | ') : ''}`);
    fs.appendFileSync(path.join(OUT, `samples-peers-${era}.jsonl`), JSON.stringify({ era, seed, byAge: res.byAge }) + '\n');
  } catch (e) {
    console.log(`${era} seed ${seed}: 실패 ${String(e.message).slice(0, 120)}`);
    results.push({ era, seed, failed: String(e.message).slice(0, 200) });
  }
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, `peers-${era}${process.env.TAG ? '-' + process.env.TAG : ''}.json`), JSON.stringify(results, null, 1));
await browser.close();
