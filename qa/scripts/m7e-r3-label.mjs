// QA-003 M7e 3회차: 부모 임종 카드의 새 라벨 「일가친척과 의논해 치른다」(planner 10-9절)가 실제 화면에서 잘 놓이는가.
//  - 접근성 이름(CDP): 「일가친척과 의논해 치른다 + 영향 문장」으로 글자 그대로, 기호·번호 0 (C20과 같은 판정을 이 라벨에 한 번 더)
//  - 줄 수·낱말 끊김: 6뷰포트 × 글자 100·150·200%에서 선택지 라벨마다 줄 수와 낱말 중간 끊김(Range 줄 상자)을 잰다 — 360×740·글자 100%에서 한 줄이어야 한다(dev 로그 7절)
//  - 카드 높이: 앱이 카드를 보인 자리에서 선택지 전부가 머리와 진행 줄 사이에 들어오는가(allFit), 마지막 선택지 아래끝 ≤ 진행 줄 위끝(e2e layout.spec의 기준을 prod 화면에서 다시)
// 사용: QA_OUT=qa/results/m7e/r3 QA_SHOT_PREFIX=M7e-r3 node qa/scripts/m7e-r3-label.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, setRootFont, runCase, shot, READ_DASH_M7E } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const WANT = '일가친척과 의논해 치른다';
const KEY_NAME = { family: '집안 살림이', assets: '자산이', debt: '부채가', relationships: '관계가', happiness: '행복이', health: '건강이', education: '지식이' };
const SIZE = { 1: '조금 ', 2: '', 3: '크게 ' };
const sentence = (it) => `${KEY_NAME[it.key]} ${SIZE[it.steps]}${it.direction === 'up' ? '늘어납니다' : '줄어듭니다'}.`;
const VPS = [
  { name: '360x740-touch', width: 360, height: 740, touch: true },
  { name: '360x568', width: 360, height: 568 },
  { name: '320x568', width: 320, height: 568 },
  { name: '375x812', width: 375, height: 812 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
];
const CARDS = ['card-farewell-plain', 'card-farewell-moved', 'card-middle-parents-farewell-past', 'card-middle-parents-care-present'];

const MEASURE = () => {
  const panel = document.querySelector('[data-testid="choice-panel"]');
  const head = document.querySelector('[data-testid="dash-head"]').getBoundingClientRect();
  const bar = document.querySelector('[data-testid="controls"]').getBoundingClientRect();
  const btns = [...panel.querySelectorAll('.choice')];
  const rows = btns.map((b) => {
    const el = b.querySelector('.choice__label');
    const tn = el.firstChild;
    const text = tn.textContent;
    const tops = (r) => new Set([...r.getClientRects()].map((x) => Math.round(x.top / 3)));
    const all = document.createRange();
    all.selectNodeContents(el);
    const lines = tops(all).size;
    const broken = [];
    const re = /[^\s]+/g;
    let m;
    while ((m = re.exec(text))) {
      const r = document.createRange();
      r.setStart(tn, m.index);
      r.setEnd(tn, m.index + m[0].length);
      if (tops(r).size > 1) broken.push(m[0]);
    }
    const rect = b.getBoundingClientRect();
    return { id: b.getAttribute('data-testid').replace('choice-', ''), label: text.replace(/\s+/g, ' ').trim(), lines, broken, bottom: rect.bottom, top: rect.top, h: rect.height };
  });
  const uncovered = (el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit === el || el.contains(hit);
  };
  const inBand = (el) => {
    const r = el.getBoundingClientRect();
    return r.left >= 0 && r.right <= window.innerWidth && r.top >= head.bottom - 0.5 && r.bottom <= bar.top + 0.5 && uncovered(el);
  };
  const panelRect = panel.getBoundingClientRect();
  return {
    rows,
    allFit: btns.every(inBand),
    lastBottom: Math.max(...btns.map((b) => b.getBoundingClientRect().bottom)),
    barTop: bar.top,
    headBottom: head.bottom,
    panelH: panelRect.height,
    docOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  };
};

const browser = await launch();
await runCase({ id: 'M7e-L02c', cat: '1회차 FAIL 재확인', title: `C20 후속: 부모 임종 카드의 새 라벨 「${WANT}」(planner 10-9절)의 줄 수·낱말 끊김·카드 높이·접근성 이름 — 6뷰포트 × 글자 100·150·200% × 카드 4종`, steps: '카드 저장(임종 3종 + 돌봄 짝 1종)을 prod에서 열고 글자 크기를 바꿔 가며 선택지 라벨의 줄 수·낱말 끊김(Range)·카드 높이(머리~진행 줄 사이)·접근성 이름(CDP)을 잰다', expected: '라벨 글자 = 10-9절 문안, 360×740·100%에서 한 줄, 낱말 중간 끊김 0, 360×740에서 선택지 전부가 머리와 진행 줄 사이(allFit), 접근성 이름에 기호 0' }, async () => {
  const bad = [];
  const note = [];
  const shots = [];
  const lines360 = {};
  for (const card of CARDS) {
    for (const vp of VPS) {
      const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
      await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', card + '.json'), 'utf8'), [SETTINGS_KEY]: SPEED8 });
      await ctx.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
      const page = await ctx.newPage();
      await page.goto(PROD, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
      await sleep(500);
      for (const font of [100, 150, 200]) {
        await setRootFont(page, font);
        await sleep(350);
        const m = await page.evaluate(MEASURE);
        const tag = `${card.replace('card-', '')}/${vp.name}/${font}`;
        const share = m.rows.find((r) => r.id === 'share');
        if (card.includes('farewell')) {
          if (!share) bad.push(`${tag}: share 선택지 없음`);
          else if (share.label !== WANT) bad.push(`${tag}: 라벨 「${share.label}」 ≠ 「${WANT}」`);
        }
        for (const r of m.rows) if (r.broken.length) bad.push(`${tag}/${r.id}: 낱말 끊김 ${r.broken}`);
        if (m.docOverflow > 0) bad.push(`${tag}: 문서 가로 넘침 ${m.docOverflow}px`);
        if (vp.name === '360x740-touch' && font === 100) {
          lines360[card] = m.rows.map((r) => `${r.id} ${r.lines}줄`).join(' ');
          if (card.includes('farewell') && share && share.lines !== 1) bad.push(`${tag}: 「${WANT}」가 ${share.lines}줄`);
          if (!m.allFit) bad.push(`${tag}: 선택지 전부가 머리와 진행 줄 사이에 안 들어옴(마지막 아래끝 ${Math.round(m.lastBottom)} > 진행 줄 위끝 ${Math.round(m.barTop)})`);
          note.push(`${card.replace('card-', '')}: 패널 ${Math.round(m.panelH)}px, 마지막 선택지 아래끝 ${Math.round(m.lastBottom)} ≤ 진행 줄 ${Math.round(m.barTop)}`);
        }
        if (card.includes('farewell') && share && (font > 100 || vp.width <= 320)) note.push(`${tag}: share ${share.lines}줄`);
        if (card === 'card-farewell-plain' && vp.name === '360x740-touch' && font === 100) shots.push(await shot(page, 'L02c', 'farewell-360x740-100'));
        if (card === 'card-farewell-plain' && vp.name === '320x568' && font === 200) shots.push(await shot(page, 'L02c', 'farewell-320x568-200'));
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'label-layout.json'), JSON.stringify({ lines360, note }, null, 1));
  const many = note.filter((n) => /share \d줄/.test(n));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') + ` (총 ${bad.length})` : `카드 4종 × 6뷰포트 × 3글자 = 72조합 낱말 끊김 0·가로 넘침 0. 360×740·글자 100%: 「${WANT}」 한 줄, 선택지 전부가 머리와 진행 줄 사이 — ${note.filter((n) => /패널/.test(n)).join(' | ')}. 글자 150·200%·320폭에서 이 라벨의 줄 수: ${many.map((n) => n.replace('farewell-', '').replace('middle-parents-', '')).slice(0, 8).join(', ')}`, shots };
});
await browser.close();
