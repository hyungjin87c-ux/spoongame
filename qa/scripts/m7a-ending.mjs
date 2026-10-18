// QA-003 M7a 엔딩: ① 영유아 때 사망하는 엔딩(마일스톤·선택·사망이 한 해에 겹침) 연표·최종 순자산 자리·출발선 문장 ② 세 시대 × 재력 1~5단계 엔딩의 출발선 문장 표.
// 사용: node qa/scripts/m7a-ending.mjs     결과: cases.jsonl (M7a-N06·N07), ending-journey.json, 스크린샷 M7a-N06-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, runCase, shot, con } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const SAVES = path.join(OUT, RP + 'saves');
const SETTINGS = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
async function open(state, vp = VP.m360, touch = true) {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
  const raw = fs.readFileSync(path.join(SAVES, `${state}.json`), 'utf8');
  await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('s', '1'); } } catch {} }, [GAME_KEY, raw, SETTINGS_KEY, SETTINGS]);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="ending-screen"]', { timeout: 15000 });
  await sleep(400);
  return { ctx, page, raw: JSON.parse(raw).data };
}
const readEnding = (page) => page.evaluate(() => {
  const tx = (s) => (document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, ' ').trim() : null);
  return {
    name: tx('[data-testid="ending-name"]'),
    born: tx('[data-testid="ending-born"]'),
    death: tx('[data-testid="ending-death"]'),
    journey: tx('[data-testid="ending-journey"]'),
    movement: tx('[data-testid="ending-movement"]'),
    finalNet: tx('[data-testid="final-net"]'),
    finalNone: tx('[data-testid="final-net-none"]'),
    timeline: [...document.querySelectorAll('[data-testid="timeline-entry"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    meters: [...document.querySelectorAll('[role="meter"]')].map((m) => `${m.getAttribute('aria-label')}=${m.getAttribute('aria-valuenow')}`),
    bodyNaN: /NaN|undefined|Infinity/.test(document.body.innerText),
  };
});

await runCase({ id: 'M7a-N06', cat: '정상', title: '영유아 사망 엔딩 6종(세 시대 × 0·1세): 마일스톤·선택 결과·사망이 한 해에 겹친 연표가 순서대로 남고, 20세 전 최종 순자산 자리 문구·출발선 문장이 정상', steps: '건강을 낮춘 0·1세 저장을 코어로 돌려 만든 영유아 사망 엔딩 저장을 prod 엔딩 화면에 연다 → 연표·최종 순자산 줄·출발선 문장·meter·NaN 검사', expected: '연표 줄 = 저장 줄(출생·마일스톤·선택·사망 순), 「스무 살이 되기 전이라 자산을 세지 않았습니다」, 출발선 문장 있음, NaN·undefined 0, 콘솔 0' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  const names = fs.readdirSync(SAVES).filter((f) => f.startsWith('ending-infant-death-')).map((f) => f.replace('.json', ''));
  for (const st of names) {
    const { ctx, page, raw } = await open(st);
    const e = await readEnding(page);
    const hist = raw.history;
    if (e.timeline.length !== hist.length) bad.push(`${st}: 연표 ${e.timeline.length} ≠ 저장 ${hist.length}`);
    const kinds = hist.map((h) => h.kind);
    if (kinds[kinds.length - 1] !== 'death') bad.push(`${st}: 마지막 줄이 사망이 아님`);
    if (!e.finalNone || !/스무 살이 되기 전/.test(e.finalNone)) bad.push(`${st}: 최종 순자산 자리 문구 「${e.finalNone}」`);
    if (!e.journey) bad.push(`${st}: 출발선 문장 없음`);
    if (e.bodyNaN) bad.push(`${st}: NaN/undefined 글자`);
    if (e.meters.length !== 4) bad.push(`${st}: meter ${e.meters.length}개`);
    rows.push(`${st.replace('ending-infant-death-', '')}: 사망 ${raw.age}세 · 연표 ${e.timeline.length}줄(${kinds.map((k) => k[0]).join('')}) · 출발선 「${(e.journey ?? '').slice(0, 30)}…」`);
    if (st.includes('present-age0') || st.includes('future-age1')) {
      await page.evaluate(() => document.querySelector('[data-testid="ending-timeline"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
      await sleep(200);
      shots.push(await shot(page, 'N06', st.replace('ending-infant-death-', '')));
    }
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 4).join(' / ') : `${names.length}종 모두 정상. ${rows.slice(0, 3).join(' | ')}`, shots };
});

await runCase({ id: 'M7a-N07', cat: '정상', title: '엔딩 출발선 문장 15종(세 시대 × 재력 1~5단계): 구간 표현이 줄바꿈으로 쪼개지지 않게 묶이고(nowrap 조각) 글(textContent)이 그대로이며 320×568·글자 200%에서 상자 안', steps: '재력별 엔딩 저장 15개를 320×568 터치에서 열고 글자 200%로 키워 출발선 문장의 글·nowrap 조각·문장 상자 대비 넘침을 잰다', expected: '넘침 0, 순위 덩어리(숫자 구간+사이의)가 줄머리에서 「의」 혼자 남지 않음' }, async () => {
  const bad = [];
  const table = [];
  const shots = [];
  for (const era of ['past', 'present', 'future']) {
    for (const tier of [1, 2, 3, 4, 5]) {
      const st = `ending-${era}-t${tier}`;
      const ctx = await mkctx(browser, { viewport: { width: 320, height: 568 } });
      const raw = fs.readFileSync(path.join(SAVES, `${st}.json`), 'utf8');
      await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('s', '1'); } } catch {} }, [GAME_KEY, raw, SETTINGS_KEY, SETTINGS]);
      const page = await ctx.newPage();
      await page.goto(PROD, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="ending-screen"]');
      await sleep(300);
      await page.evaluate(() => { const s = document.createElement('style'); s.textContent = 'html{font-size:200% !important}'; document.head.appendChild(s); });
      await sleep(300);
      const r = await page.evaluate(() => {
        const j = document.querySelector('[data-testid="ending-journey"]');
        const box = j.getBoundingClientRect();
        const pieces = [...j.querySelectorAll('.nowrap')].map((n) => {
          const b = n.getBoundingClientRect();
          return { text: n.textContent, left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) };
        });
        // 줄머리 글자: 조각 안의 「의」 같은 한 글자가 줄 맨 앞에 혼자 오는가를 Range 줄 나눔으로
        const text = j.textContent;
        const out = pieces.filter((p) => p.right > Math.ceil(box.right) + 0.5 || p.left < Math.floor(box.left) - 0.5);
        return { text: text.replace(/\s+/g, ' ').trim(), boxW: Math.round(box.width), pieces, outside: out.map((o) => o.text), docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, movement: document.querySelector('[data-testid="ending-movement"]')?.textContent.trim() ?? null };
      });
      if (r.outside.length) bad.push(`${st}: 조각이 문장 상자 밖 ${r.outside}`);
      if (r.docOverflow > 0) bad.push(`${st}: 문서 가로 넘침 ${r.docOverflow}px`);
      table.push({ st, text: r.text, pieces: r.pieces.map((p) => `${p.text}(${p.w}px)`).join(' · '), boxW: r.boxW });
      if (['ending-past-t1', 'ending-present-t3', 'ending-future-t5'].includes(st)) {
        await page.evaluate(() => document.querySelector('[data-testid="ending-journey-section"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
        await sleep(200);
        shots.push(await shot(page, 'N07', `${st}-m320-200`));
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, RP + 'ending-journey.json'), JSON.stringify(table, null, 1));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `15종 모두 상자 안(문장 상자 폭 ${table[0].boxW}px), 문서 넘침 0. 구간 조각 예 「${table.find((t) => /사이의/.test(t.text))?.pieces ?? ''}」`, shots };
});
await browser.close();
