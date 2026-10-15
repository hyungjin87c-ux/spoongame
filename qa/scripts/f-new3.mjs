// 엔딩·시대 선택 화면의 좁은 폭·200% 확대·가로 모드 레이아웃 (실제 엔딩 저장 사용)
import fs from 'node:fs';
import path from 'node:path';
import { DEV, FIN, GAME_KEY, launch, mkctx, MOBILE, shot, snap, waitScreen, sleep, readSave, runCase, envelope, inject } from './f-lib.mjs';

const base = JSON.parse(fs.readFileSync(path.join(FIN, 'base-endings.json'), 'utf8'));
const browser = await launch();
const VPS = [
  ['320x568', 320, 568, 1],
  ['280x500', 280, 500, 1],
  ['200% 확대(360px의 절반 = 180x370, 배율 2)', 180, 370, 2],
  ['가로 667x375', 667, 375, 1],
  ['가로 740x360', 740, 360, 1],
  ['태블릿 768x1024', 768, 1024, 1],
  ['데스크톱 1920x1080', 1920, 1080, 1],
];
await runCase({ id: 'F-AU13', cat: '#24 레이아웃', title: '엔딩 화면(긴 연표·구간 문장)의 좁은 폭·확대·가로 모드: 가로 넘침·글자 잘림 없음, 「다시 태어나기」까지 스크롤로 닿음', steps: '실제 엔딩 저장(지난·지금·다가올 세상)을 주입하고 여러 뷰포트에서 문서 폭·요소 폭·마지막 버튼 도달을 측정, 스크린샷', expected: '가로 스크롤 없음, 요소가 화면 밖으로 잘리지 않음, 버튼에 닿음', ts: false }, async () => {
  const fails = [];
  const det = [];
  const shots = [];
  for (const [label, w, h, dpr] of VPS) {
    for (const era of ['present', 'past']) {
      const ctx = await mkctx(browser, { viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: true, isMobile: w < 800 });
      const page = await ctx.newPage();
      const st = JSON.parse(JSON.stringify(base[era]));
      st.character.parentWealth = era === 'present' ? 2 : 3;
      st.stats.wealth = 60;
      await inject(page, DEV, st);
      await waitScreen(page, 'ending-screen');
      await sleep(500);
      const m = await page.evaluate(() => {
        const root = document.documentElement;
        const bad = [];
        for (const el of document.querySelectorAll('main *')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > root.clientWidth + 1 || r.left < -1)) bad.push(`${el.tagName}.${el.className}`);
        }
        const btn = document.querySelector('[data-testid="rebirth"]');
        btn.scrollIntoView();
        const br = btn.getBoundingClientRect();
        return { scrollW: root.scrollWidth, clientW: root.clientWidth, overflowX: root.scrollWidth > root.clientWidth, outside: bad.slice(0, 4), btnVisible: br.top >= 0 && br.bottom <= innerHeight + 1, docH: root.scrollHeight };
      });
      if (m.overflowX || m.outside.length || !m.btnVisible) fails.push(`${label}/${era}: ${JSON.stringify(m)}`);
      det.push(`${label}/${era}: 폭 ${m.clientW} 높이 ${m.docH}px`);
      if (era === 'present') {
        await page.evaluate(() => window.scrollTo(0, 0));
        shots.push(await shot(page, 'F-AU13', `${w}x${h}-x${dpr}`));
      }
      await ctx.close();
    }
  }
  return { verdict: fails.length ? 'FAIL' : 'PASS', actual: fails.length ? fails.join(' / ') : det.join(' | '), shots };
});
await browser.close();
console.log('done');
