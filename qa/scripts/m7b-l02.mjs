// QA-003 M7b L02: 폭 320 · 글자 200%에서 infant-noise(긴 기관 이름)·senior-grandchildren(국민노후보장패널조사) 출처 줄 — 시트·인라인 스크린샷과 줄 모양
import fs from 'node:fs';
import { launch, sleep, shot, runCase, cardReady } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';
import { WB_AUDIT } from './m3r2-wb.mjs';
const b = await launch();
await runCase({ id: 'L02', cat: '레이아웃', title: '폭 320 · 글자 200%: infant-noise·senior-grandchildren 출처 줄(시트·인라인) — 가로 넘침 없음, 낱말이 낱말 중간에서 끊기지 않음(한 줄보다 긴 낱말은 예외로 기록)', steps: '320×568 prod, html 글자 200%에서 카드 5장(infant-noise 지금, senior-grandchildren 지금·다가올, 가장 긴 연구 인용 infant-new-sibling 지난 세상·infant-screen 다가올 세상) × {시트, 인라인}의 인용 박스를 화면에 가져와 줄 모양을 읽고 스크린샷', expected: '넘침 0, 결함 끊김 0(한 줄보다 긴 낱말은 기록)' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const name of ['noise-present', 'grandchildren-present', 'grandchildren-future', 'sibling-past', 'c02-infant-screen-future']) {
    for (const mode of ['sheet', 'inline']) {
      const { ctx, page } = await openCard(b, name, mode, { vp: VPS[0], font: 200, hidden: true });
      await cardReady(page);
      await page.evaluate(() => document.querySelector('[data-testid="cite"]').scrollIntoView({ block: 'center' }));
      await sleep(300);
      const info = await page.evaluate(() => {
        const cite = document.querySelector('[data-testid="cite"]');
        const R = cite.getBoundingClientRect();
        const src = cite.querySelector('[data-testid="cite-src"]');
        const lines = (el) => {
          const out = [];
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          let cur = { y: null, t: '' };
          while ((n = w.nextNode())) {
            for (let i = 0; i < n.textContent.length; i++) {
              const rg = document.createRange();
              rg.setStart(n, i); rg.setEnd(n, i + 1);
              const rs = rg.getClientRects();
              if (!rs.length) continue;
              const y = Math.round(rs[0].top);
              if (cur.y === null || Math.abs(y - cur.y) > 6) { if (cur.y !== null) out.push(cur.t); cur = { y, t: '' }; }
              cur.t += n.textContent[i];
            }
          }
          if (cur.y !== null) out.push(cur.t);
          return out;
        };
        return { citeL: Math.round(R.left), citeR: Math.round(R.right), vw: innerWidth, srcLines: lines(src), textLines: lines(cite.querySelector('[data-testid="cite-text"]')), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, srcScrollW: src.scrollWidth, srcClientW: src.clientWidth };
      });
      const wb = await page.evaluate(WB_AUDIT, { intended: [] });
      const scoped = wb.broken.filter((x) => /cite|choice|decision/.test(x.where));
      const un = wb.unavoidable.filter((x) => /cite|choice|decision/.test(x.where));
      rows.push(`${name}/${mode}: 출처 ${info.srcLines.length}줄 [${info.srcLines.map((l) => l.trim()).join(' / ')}] 결함끊김 ${scoped.length}·한줄보다긴낱말 ${un.map((x) => x.word + '[' + x.natural + '>' + x.lineW + ']').join(',') || 0}·넘침 ${info.overflow}·출처 scrollW ${info.srcScrollW}/${info.srcClientW}`);
      if (scoped.length) bad.push(`${name}/${mode}: 결함 끊김 ${scoped.map((x) => x.word + '(' + x.shape + ')').join(',')}`);
      if (info.overflow || info.srcScrollW > info.srcClientW + 1) bad.push(`${name}/${mode}: 가로 넘침 ${info.srcScrollW}>${info.srcClientW}`);
      if (info.citeR > info.vw + 1 || info.citeL < -1) bad.push(`${name}/${mode}: 인용 박스가 화면 밖 ${info.citeL}~${info.citeR}`);
      shots.push(await shot(page, 'L02', `${name}-${mode}-320x568-200`));
      await ctx.close();
    }
  }
  fs.writeFileSync('qa/results/m7b/l02-lines.txt', rows.join('\n'));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + rows.join(' | '), shots };
});
await b.close();
