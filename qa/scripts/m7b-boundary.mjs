// QA-003 M7b P01: 지난 세상 인용의 연도 경계 — 출생 연도별로 school-early-work·school-exam(c-100·c-101, 1980년 값)과 기타 지난 세상 인용이 게임 속 연도(출생 연도 + 나이)보다 미래 값을 보이지 않는지.
// 카드가 대기 중인 지난 세상 저장의 출생 연도만 고쳐(나이는 그대로) 「경계 직전·직후」를 직접 만든다. 사용: node qa/scripts/m7b-boundary.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, DEV, findCardState, evalCore, shot, runCase, readCard, cardReady, GAME_KEY, SETTINGS_KEY, settingsEnvelope, SET_MANUAL, TOUCH } from './m7b-lib.mjs';

const browser = await launch();
const oracle = await (await mkctx(browser)).newPage();
await oracle.goto(DEV, { waitUntil: 'load' });
await oracle.waitForSelector('[data-testid="title-screen"]');

// [카드, 인용 id, 보이기 시작하는 연도(validFromYear)]
const RULES = [
  ['school-early-work', 'c-100', 1980],
  ['school-exam', 'c-101', 1980],
  ['school-family-priority', 'c-097', 1970],
  ['youth-first-job', 'c-091', 1985],
  ['youth-marriage', 'c-098', 1980],
  ['youth-child', 'c-099', 1971],
  ['infant-new-sibling', 'c-033', null],
];

async function openWith(state) {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
  await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('__qa_seeded')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('__qa_seeded', '1'); } } catch {} window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); }, [GAME_KEY, JSON.stringify({ version: 8, data: state }), SETTINGS_KEY, settingsEnvelope(SET_MANUAL)]);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4899/spoongame/', { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
  await cardReady(page);
  const c = await readCard(page);
  return { ctx, page, c };
}

/** 카드가 대기 중이고 (출생 연도 + 나이)가 [target-2, target+2]인 지난 세상 저장을 시드를 훑어 연도별로 하나씩 모은다(출생 연도는 그대로 둔다 — 지어낸 값이 아니라 게임이 만든 상태) */
async function collect(ev, target, extra = []) {
  return evalCore(oracle, `
    const out = {};
    const want = new Set(arg.years);
    for (let seed = 1; seed < 9000 && want.size > 0; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), "past")));
      for (let guard = 0; guard < 80 && s.phase === "life"; guard++) {
        s = core.advanceUntilDecision(s).state;
        if (s.phase !== "life" || s.pending === null) break;
        if (s.pending.eventId === arg.ev && s.pending.choiceIds.length >= 2) {
          const y = s.character.birthYear + s.age;
          if (want.has(y)) { out[y] = s; want.delete(y); }
          break;
        }
        s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
      }
    }
    return out;`, { ev, years: [...new Set([target - 2, target - 1, target, target + 1, target + 2, ...extra])] });
}

await runCase({ id: 'P01', cat: '정상', title: '지난 세상 인용 연도 경계(validFromYear): 경계 직전 해에는 인용 없음, 경계 해부터 있음, 어느 출생 연도에서도 게임 속 연도보다 미래 연도의 값이 보이지 않는다', steps: '카드별로 시드를 훑어 「게임 속 연도 = 경계 −2 … +2」인 지난 세상 저장(게임이 만든 상태)을 모아 prod에서 열고 인용 유무·인용 id·본문의 연도를 읽는다', expected: '경계 해 전: 인용 없음, 경계 해부터: 해당 인용(c-100 등), 게임 속 연도보다 미래 연도의 값 0, 연구(c-033)는 모든 연도에서 「지금의 연구로는」' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  let opened = 0;
  for (const [ev, cid, from] of RULES) {
    if (from === null) continue;
    const found = await collect(ev, from);
    const seen = [];
    for (const y of Object.keys(found).map(Number).sort((a, b) => a - b)) {
      const st = found[y];
      const { ctx, page, c } = await openWith(st);
      opened++;
      const cite = c.cite;
      const wantShown = y >= from;
      const yrs = cite ? [...cite.text.matchAll(/(d{4})년/g)].map((m) => Number(m[1])) : [];
      const future = cite && cite.kind === '통계' ? yrs.filter((v) => v > y) : [];
      const okShown = !!cite === wantShown;
      seen.push(`${y}년(${st.character.birthYear}생 ${st.age}세): ${cite ? cite.id : '없음'}${okShown ? '' : ' ✗'}`);
      if (!okShown) bad.push(`${ev} ${y}년(출생 ${st.character.birthYear}): 인용 ${cite ? cite.id : '없음'} (기대 ${wantShown ? cid : '없음'})`);
      if (cite && cite.id !== cid) bad.push(`${ev} ${y}년: 엉뚱한 인용 ${cite.id}`);
      if (future.length) bad.push(`${ev} ${y}년: 미래 연도 ${future.join(',')} 노출 「${cite.text.slice(0, 40)}」`);
      if ((ev === 'school-early-work' || ev === 'school-exam') && (y === from - 1 || y === from)) shots.push(await shot(page, 'P01', `${ev}-year${y}-birth${st.character.birthYear}`));
      await ctx.close();
    }
    const missing = [-2, -1, 0, 1, 2].filter((d) => !found[from + d]).map((d) => from + d);
    rows.push(`${ev}(${cid} ≥${from}): ${seen.join(' · ')}${missing.length ? ' [못 찾은 연도 ' + missing.join(',') + ']' : ''}`);
  }
  // 연구 인용 c-033은 연도 제한이 없다: 출생 1950~1989 전체에서 「지금의 연구로는」
  const sib = await collect('infant-new-sibling', 1960, [1955, 1965, 1970, 1975, 1980, 1985, 1990]);
  const sseen = [];
  for (const y of Object.keys(sib).map(Number).sort((a, b) => a - b)) {
    const { ctx, page, c } = await openWith(sib[y]);
    opened++;
    sseen.push(`${y}: ${c.cite ? c.cite.id + (c.cite.text.startsWith('지금의 연구로는') ? ' 머리말 있음' : ' 머리말 없음 ✗') : '없음 ✗'}`);
    if (!c.cite || !c.cite.text.startsWith('지금의 연구로는')) bad.push(`infant-new-sibling ${y}년: 연구 인용/머리말 이상`);
    await ctx.close();
  }
  rows.push(`infant-new-sibling(c-033 연구): ${sseen.join(' · ')}`);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') + ' || ' + rows.join(' | ') : `저장 ${opened}개 확인. ` + rows.join(' | '), shots };
});
await browser.close();
