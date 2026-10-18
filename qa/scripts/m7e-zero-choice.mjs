// QA-003 M7e 선택 0번 엔딩: 영유아 사망 저장에서 선택 줄을 지워 「선택을 내려야 하는 순간이 오기 전이었습니다.」 문장을 본다
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, editSave, runCase, shot } from './m7e-lib.mjs';
const b = await launch();
await runCase({ id: 'M7e-N05b', cat: '정상', title: '선택 0번으로 끝난 엔딩(영유아 사망): 「선택을 내려야 하는 순간이 오기 전이었습니다.」(합쇼체, 윗줄 「세상을 떠났습니다」를 되풀이하지 않음)', steps: '영유아 사망 저장에서 선택 줄을 뺀 저장을 엔딩 화면에 연다', expected: '선택 수 줄 = 새 문장, 출발선 문장은 「…의 집에서 태어났습니다.」, 최종 순자산 줄 = 20세 전 안내' }, async () => {
  const bad = [];
  const shots = [];
  for (const era of ['present', 'past', 'future']) {
    const raw = editSave(fs.readFileSync(path.join(OUT, 'saves', `ending-infant-death-${era}-age0-two.json`), 'utf8'), (d) => {
      d.history = d.history.filter((h) => h.kind !== 'choice');
      d.seen = Object.fromEntries(Object.entries(d.seen).filter(([id]) => d.history.some((h) => h.eventId === id)));
      d.lastChoiceAge = null;
    });
    const ctx = await mkctx(b, {});
    await seedStorage(ctx, { [GAME_KEY]: raw });
    const p = await ctx.newPage();
    await p.goto(PROD, { waitUntil: 'load' });
    const ok = await p.waitForSelector('[data-testid="ending-screen"]', { timeout: 8000 }).then(() => true).catch(() => false);
    if (!ok) { bad.push(`${era}: 엔딩 화면이 안 열림(변조로 거부됨)`); await ctx.close(); continue; }
    const r = await p.evaluate(() => ({ choices: document.querySelector('[data-testid="ending-choices"]').textContent.trim(), death: document.querySelector('[data-testid="ending-death"]').textContent.trim(), journey: document.querySelector('[data-testid="ending-journey"]').textContent.trim(), none: document.querySelector('[data-testid="final-net-none"]')?.textContent.trim() }));
    if (r.choices !== '선택을 내려야 하는 순간이 오기 전이었습니다.') bad.push(`${era}: 선택 수 줄 「${r.choices}」`);
    if (!/태어났습니다\.$/.test(r.journey)) bad.push(`${era}: 출발선 문장 「${r.journey}」`);
    if (r.none !== '스무 살이 되기 전이라 자산을 세지 않았습니다.') bad.push(`${era}: 최종 순자산 줄 「${r.none}」`);
    if (era === 'present') shots.push(await shot(p, 'N05b', 'zero-choice-top'));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : '세 시대 모두 「선택을 내려야 하는 순간이 오기 전이었습니다.」 + 출발선 「…의 집에서 태어났습니다.」 + 「스무 살이 되기 전이라 자산을 세지 않았습니다.」', shots };
});
await b.close();
