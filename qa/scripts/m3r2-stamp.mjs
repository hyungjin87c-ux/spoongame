// 장식 도장 「접수」가 본문 글자를 가리는가(겹침). 11뷰포트 × 글자 100·150·200% × 출생신고 표본 4. 사용: node qa/scripts/m3r2-stamp.mjs
import { launch, runCase, shot, sleep, STD_VIEWPORTS, setRootFont } from './m3r2-lib.mjs';
import { openState, VARIANTS } from './m3r2-a11ylib.mjs';

const browser = await launch();
const OVERLAP = () => {
  const stamp = document.querySelector('.stamp');
  if (!stamp) return { none: true };
  const s = stamp.getBoundingClientRect();
  // 회전한 도장의 바깥 사각형이 아니라 실제 원(지름 = 가로·세로 중 작은 값)
  const cx = s.left + s.width / 2;
  const cy = s.top + s.height / 2;
  const rad = Math.min(s.width, s.height) / 2;
  const hits = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (!n.textContent.trim() || stamp.contains(n)) continue;
    const pe = n.parentElement;
    const cs = getComputedStyle(pe);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue;
      const px = Math.max(r.left, Math.min(cx, r.right));
      const py = Math.max(r.top, Math.min(cy, r.bottom));
      const d = Math.hypot(px - cx, py - cy);
      if (d < rad - 6) hits.push(`${n.textContent.trim().slice(0, 10)}(${Math.round(rad - d)}px 안쪽)`);
    }
  }
  return { hits, stamp: [Math.round(s.left), Math.round(s.top), Math.round(s.width), Math.round(s.height)] };
};
const V = (id) => VARIANTS.find((v) => v.id === id);
const picks = [V('present-4242-silver'), V('present-229-diamond-honam'), V('present-5-dirt-changwon'), V('past-155-dirt')];
await runCase(
  { id: 'M3-S01', cat: '레이아웃', title: '장식 도장 「접수」가 본문 글자를 가리지 않는다(출생신고 서류 오른쪽 위, 회전한 원과 글자 줄 상자의 겹침)', steps: '11뷰포트 × 글자 100·150·200% × 표본 4(이름 3글자)에서 도장 원과 다른 모든 글자 줄 상자의 겹침을 잰다(줄 상자 모서리가 원 경계를 6px 넘어 들어와야 겹침 — 3px 안쪽 접촉은 줄 상자 여백이고 글자 잉크가 아님을 스크린샷으로 확인)', expected: '겹침 0' },
  async () => {
    const bad = [];
    let n = 0;
    const shots = [];
    for (const vp of STD_VIEWPORTS) {
      for (const v of picks) {
        const { ctx, p } = await openState(browser, vp, v, 'birth');
        for (const font of [100, 150, 200]) {
          await setRootFont(p, font);
          await sleep(220);
          await p.evaluate(() => window.scrollTo(0, 0));
          const r = await p.evaluate(OVERLAP);
          n++;
          if (r.none) bad.push(`${vp.name}/${font}%/${v.id}: 도장 없음`);
          else if (r.hits.length) {
            bad.push(`${vp.name}/${font}%/${v.id}: ${r.hits.slice(0, 2).join(',')}`);
            if (shots.length < 4) shots.push(await shot(p, 'S01', `${vp.name}-${font}-${v.id}-FLAG`));
          }
        }
        await ctx.close();
      }
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? `${bad.length}건: ${bad.slice(0, 5).join(' / ')}` : `${n}조합 도장과 글자의 겹침 0`, shots };
  },
);
await browser.close();
