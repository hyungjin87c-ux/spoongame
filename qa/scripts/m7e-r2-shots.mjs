// QA-003 M7e 2회차 증거 스크린샷(데이터로 판정한 케이스의 화면 증거): 수확한 판의 최종 저장을 prod 엔딩 화면에 열어 연표의 해당 줄을 찍는다.
//  T03c-return   「부모님 집으로 돌아간다」를 고른 판의 연표 줄(결과 문장) — 새 선택지의 실제 기록
//  T03b-family   부모님과 한집에 살다 독립하지 않은 미혼 판의 연표 — 「혼자 맞는 명절」 줄이 없다
//  T03b-control  같은 모양인데 독립(월세) 판의 연표 — 「혼자 맞는 명절」 줄이 있다(대조)
//  S01-changed   바뀐 문장(기록 줄)을 화면에서 읽는 모습 — 「조부모님이 낮 동안 아이를 맡으셨습니다」 등 높임 줄이 있는 판
// 사용: QA_OUT=qa/results/m7e/r2 QA_SHOT_PREFIX=M7e-r2 node qa/scripts/m7e-r2-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, SHOT_DIR, SHOT_PREFIX } from './m7e-lib.mjs';

const SETTINGS = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const lives = [];
for (const f of fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[a-z]\d?\.jsonl$/.test(f))) for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').split(String.fromCharCode(10))) { if (!line.trim()) continue; const r = JSON.parse(line); if (r.final) lives.push(r); }

const pick = {
  'T03c-return': lives.find((l) => l.final.history.some((h) => h.eventId === 'youth-housing' && h.choice === '부모님 집으로 돌아간다') && !l.final.flags.includes('married')),
  'T03b-family': lives.find((l) => !l.final.flags.includes('married') && l.final.flags.includes('lives_with_parents') && !l.final.history.some((h) => h.eventId === 'middle-lonely-holiday') && l.final.history.some((h) => h.eventId === 'middle-parents-farewell' || h.kind === 'stage')),
  'T03b-control': lives.find((l) => !l.final.flags.includes('married') && l.final.flags.includes('renting') && l.final.history.some((h) => h.eventId === 'middle-lonely-holiday')),
  'S01-changed': lives.find((l) => l.final.history.some((h) => /조부모님이 낮 동안 아이를 맡으셨습니다/.test(h.text))),
};
const rowMatch = {
  'T03c-return': /짐을 싸 부모님 집으로 돌아갔습니다/,
  'T03b-family': /중년 · 40~64세/,
  'T03b-control': /혼자 명절을 보냈습니다/,
  'S01-changed': /조부모님이 낮 동안 아이를 맡으셨습니다/,
};
const browser = await launch();
const done = [];
for (const [tag, life] of Object.entries(pick)) {
  if (!life) { console.log('없음', tag); continue; }
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: JSON.stringify({ version: 8, data: life.final }), [SETTINGS_KEY]: SETTINGS });
  const p = await ctx.newPage();
  await p.goto(PROD, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="ending-timeline"]', { timeout: 20000 });
  await sleep(400);
  const found = await p.evaluate((src) => {
    const re = new RegExp(src);
    const tl = document.querySelector('[data-testid="ending-timeline"]');
    const all = [...tl.querySelectorAll('*')].filter((e) => re.test(e.textContent));
    const row = all.filter((e) => ![...e.children].some((c) => re.test(c.textContent)))[0];
    if (row) { row.scrollIntoView({ block: 'center', behavior: 'instant' }); return row.textContent.replace(/\s+/g, ' ').slice(0, 140); }
    tl.scrollIntoView({ block: 'start', behavior: 'instant' });
    return null;
  }, rowMatch[tag].source);
  await sleep(300);
  const name = `${SHOT_PREFIX}-${tag}.png`;
  await p.screenshot({ path: path.join(SHOT_DIR, name) });
  console.log(name, life.era, life.seed, found ? '줄: ' + found : '줄 못 찾음(연표 첫머리 촬영)');
  done.push(name);
  await ctx.close();
}
await browser.close();
