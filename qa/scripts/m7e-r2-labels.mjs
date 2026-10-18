// QA-003 M7e 2회차 L02 라벨 전수: 이벤트 JSON의 모든 선택지 라벨(고유 문자열 전부)을 실제 결정 카드의 첫 선택지 라벨 칸에 번갈아 넣고,
// 11개 표준 뷰포트 × 글자 150·200%에서 낱말이 줄 중간에서 끊기는지(Range 줄 상자로 실제 렌더 판정)를 잰다 — 카드를 만들지 않고도 풀 전체 라벨을 같은 CSS로 본다.
// 분류: broken = 한 줄 전체(선택지 버튼 안쪽 폭)보다 좁은 낱말이 중간에서 끊김(결함, QM3-1) / unavoidable = 한 줄 전체보다 넓은 낱말(허용).
// 사용: QA_OUT=qa/results/m7e/r2 QA_SHOT_PREFIX=M7e-r2 node qa/scripts/m7e-r2-labels.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, STD_VIEWPORTS, setRootFont, runCase, shot, ROOT } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const labels = new Map();
for (const f of ['infant', 'school', 'youth', 'middle', 'senior']) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'events', f + '.json'), 'utf8'));
  for (const e of Array.isArray(j) ? j : j.events) for (const c of e.choices ?? []) (labels.get(c.label) ?? labels.set(c.label, []).get(c.label)).push(`${e.id}/${c.id}`);
}
const list = [...labels.keys()];
const OLD = ['무리해서라도 뒷바라지한다', '무리해서라도 다녀온다']; // 1회차의 라벨 — 측정기가 옛 라벨을 잡는지 대조(자체 시험)

const MEASURE = (all) => {
  const panel = document.querySelector('[data-testid="choice-panel"]');
  const btn = panel.querySelector('.choice');
  const el = btn.querySelector('.choice__label');
  const cs = getComputedStyle(btn);
  const lineW = btn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const blockW = el.clientWidth;
  const orig = el.textContent;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + getComputedStyle(el).font + ';letter-spacing:' + getComputedStyle(el).letterSpacing + ';';
  document.body.appendChild(probe);
  const res = [];
  for (const label of all) {
    el.textContent = label;
    const tn = el.firstChild;
    const text = tn.textContent;
    const re = /[^\s]+/g;
    let m;
    while ((m = re.exec(text))) {
      const r = document.createRange();
      r.setStart(tn, m.index);
      r.setEnd(tn, m.index + m[0].length);
      const tops = new Set([...r.getClientRects()].map((x) => Math.round(x.top / 3)));
      if (tops.size > 1) {
        // 가운뎃점·쉼표 뒤에서 줄이 바뀐 것은 의도된 끊김 지점이라 조각별로 다시 본다
        const parts = m[0].split(/(?<=[·,])/);
        let broke = false;
        if (parts.length > 1) {
          let off = m.index;
          for (const part of parts) {
            const rr = document.createRange();
            rr.setStart(tn, off);
            rr.setEnd(tn, off + part.length);
            if (new Set([...rr.getClientRects()].map((x) => Math.round(x.top / 3))).size > 1) broke = true;
            off += part.length;
          }
        } else broke = true;
        if (!broke) continue;
        probe.textContent = m[0];
        const nat = probe.getBoundingClientRect().width;
        res.push({ label, word: m[0], natural: Math.round(nat), lineW: Math.round(lineW), blockW: Math.round(blockW), kind: nat > lineW + 0.5 ? 'unavoidable' : 'broken' });
      }
    }
  }
  el.textContent = orig;
  probe.remove();
  return { res, lineW: Math.round(lineW), blockW: Math.round(blockW) };
};

const browser = await launch();
await runCase({ id: 'M7e-L02b', cat: '1회차 FAIL 재확인', title: `L02 라벨 전수: 이벤트 JSON의 선택지 라벨 ${list.length}개 전부를 11개 표준 뷰포트 × 글자 150·200%의 실제 선택지 칸에서 렌더해 낱말 중간 끊김(결함) 0`, steps: '결정 카드 저장을 열고 첫 선택지 라벨 칸에 라벨을 하나씩 넣어 낱말마다 Range 줄 상자가 둘 이상인지 본다. 측정기 자체 시험: 1회차의 옛 라벨 2개를 넣으면 320 · 글자 200%에서 끊김으로 잡히는가', expected: '결함 끊김 0, 옛 라벨은 잡힘(측정기가 살아 있음)' }, async () => {
  const bad = [];
  const note = [];
  let total = 0;
  let unav = 0;
  const byCombo = {};
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', 'card-youth-housing-rent.json'), 'utf8'), [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await sleep(500);
  const shots = [];
  for (const vp of STD_VIEWPORTS) {
    for (const font of [150, 200]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setRootFont(page, font);
      await sleep(120);
      const { res, lineW, blockW } = await page.evaluate(MEASURE, list);
      const old = await page.evaluate(MEASURE, OLD);
      total += list.length;
      const b = res.filter((x) => x.kind === 'broken');
      const u = res.filter((x) => x.kind === 'unavoidable');
      unav += u.length;
      byCombo[`${vp.name}/${font}`] = { lineW, blockW, broken: b.length, unavoidable: u.length, oldCaught: old.res.length };
      for (const x of b) bad.push(`${vp.name}/${font}: 「${x.label}」 ${x.word} 끊김(자연 ${x.natural}px < 줄 ${x.lineW}px)`);
      if (vp.name === '320x568' && font === 200) {
        if (old.res.length < 2) bad.push(`측정기 자체 시험 실패: 320×568·200%에서 옛 라벨 ${old.res.length}/2만 잡힘`);
        else note.push(`옛 라벨 ${old.res.length}개 낱말 끊김으로 잡힘(「${old.res[0].word}」 자연 ${old.res[0].natural}px · 라벨 칸 ${old.blockW}px · 줄 ${old.lineW}px)`);
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'labels-combos.json'), JSON.stringify({ labels: list.length, byCombo }, null, 1));
  // 한 줄보다 넓은 낱말(unavoidable)은 허용(글자 150·200%)
  await setRootFont(page, 100);
  await ctx.close();
  await browser.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') + ` (총 ${bad.length})` : `라벨 ${list.length}개 × 22조합(${total.toLocaleString('ko-KR')}번 렌더) 결함 끊김 0, 한 줄보다 넓은 낱말 ${unav}건. ${note.join(' / ')}. 320×568 · 글자 200%에서 라벨 칸 ${byCombo['320x568/200'].blockW}px·줄 ${byCombo['320x568/200'].lineW}px`, shots };
});
