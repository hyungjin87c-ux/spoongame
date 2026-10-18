// QA-003 M7e 수확에서 못 만난 결과 문장 3개를 카드 저장으로 직접 읽는다: infant-moving/buy · infant-early-lessons/english · senior-estranged-child/letter
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, runCase, shot, ROOT } from './m7e-lib.mjs';
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const m7a = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa', 'results', 'm7a', 'craft-saves.json'), 'utf8'));
const jobs = [
  ['infant-moving', 'buy', fs.readFileSync(path.join(OUT, 'saves', 'card-infant-moving-present-t3.json'), 'utf8')],
  ['infant-early-lessons', 'english', fs.readFileSync(path.join(OUT, 'saves', 'card-infant-early-lessons-present-t5.json'), 'utf8')],
  ['senior-estranged-child', 'letter', fs.readFileSync(path.join(OUT, 'saves', 'card-senior-estranged-child-present.json'), 'utf8')],
];
const b = await launch();
await runCase({ id: 'M7e-T09', cat: '문장 품질', title: '수확 표본에 안 나온 결과 문장 3개(infant-moving/buy·infant-early-lessons/english·senior-estranged-child/letter)를 화면에서 읽는다', steps: '카드 저장을 열어 해당 선택지를 누르고 인생 기록 줄을 읽는다', expected: '합쇼체·숫자 없음·인용 부호 없음' }, async () => {
  const bad = [];
  const rows = [];
  for (const [ev, ch, raw] of jobs) {
    const ctx = await mkctx(b, { viewport: VP.m360, ...TOUCH });
    await seedStorage(ctx, { [GAME_KEY]: raw, [SETTINGS_KEY]: SPEED8 });
    const p = await ctx.newPage();
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((x) => x.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
    const ids = await p.evaluate(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((x) => x.getAttribute('data-testid').replace('choice-', '')));
    if (!ids.includes(ch)) { bad.push(`${ev}: 「${ch}」 선택지가 안 보임 ${ids}`); await ctx.close(); continue; }
    await p.locator(`[data-testid="choice-${ch}"]`).click();
    await sleep(700);
    const g = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);
    const h = g.history.find((x) => x.eventId === ev);
    const sents = (h?.text ?? '').split(/(?<=[.])\s+/);
    if (!sents.every((s) => /니다\.$/.test(s))) bad.push(`${ev}/${ch}: 합쇼체 아님`);
    if (/[0-9"'「」]/.test(h?.text ?? '')) bad.push(`${ev}/${ch}: 숫자·인용 부호`);
    rows.push(`${ev}/${ch}: 「${h?.text}」`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots: [] };
});
await b.close();
