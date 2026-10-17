// QA-003 M3 키보드 전용 전체 플로우 + 접근성 트리·라이브 영역. 사용: node qa/scripts/m3-kbd.mjs
import { launch, mkctx, fixSeed, runCase, shot, openTitle, waitGuard, sleep, VP, TOUCH, saveJson, whichScreen, readRoulette, readBirth, lifeInfo } from './m3-lib.mjs';

const browser = await launch();

const active = (p) =>
  p.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { id: 'body' };
    const cs = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    return { id: a.getAttribute('data-testid') || a.getAttribute('aria-label') || a.tagName, tag: a.tagName, type: a.type || null, outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, outlineOffset: cs.outlineOffset, boxShadow: cs.boxShadow !== 'none', top: Math.round(r.top), bottom: Math.round(r.bottom), name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 20) };
  });

await runCase(
  { id: 'M3-X01', cat: '접근성', title: '키보드만으로 전체 플로우: 첫 화면(세상 라디오 방향키) → 태어나기 → 룰렛 건너뛰기 → 출생신고 보기 → 살아가기 → 인생', steps: '마우스·터치 없이 Tab·Shift+Tab·방향키·Enter·Space만. 지난 세상을 방향키로 고르고, 태어나기까지 Tab 횟수를 센다. 각 화면 도착 때 포커스 위치와 포커스 링을 기록', expected: '전 구간이 키보드로 닿고 실행되며, 화면이 바뀔 때 포커스가 제목(또는 같은 자리 버튼)에 놓이고 링이 보인다. 지난 세상 선택이 룰렛·출생신고에 반영' },
  async () => {
    const bad = [];
    const notes = [];
    const shots = [];
    const ctx = await mkctx(browser, { viewport: VP.d1280 });
    await fixSeed(ctx, 777);
    const p = await ctx.newPage();
    await openTitle(p);
    await sleep(500);
    // Tab으로 era 라디오에 닿기
    let tabs = 0;
    let seq = [];
    for (let i = 0; i < 40; i++) {
      await p.keyboard.press('Tab');
      tabs++;
      await sleep(40);
      const a = await active(p);
      seq.push(a.id + (a.type === 'radio' ? ':radio' : ''));
      const inEra = await p.evaluate(() => !!document.activeElement?.closest('[data-testid="era-group"]'));
      if (inEra) break;
    }
    notes.push(`era 라디오까지 Tab ${tabs}번`);
    const a1 = await active(p);
    if (!(a1.type === 'radio')) bad.push(`era 라디오에 닿지 못함: ${a1.id}`);
    // 기본(지금 세상)에서 ↑로 지난 세상
    await p.keyboard.press('ArrowUp');
    await sleep(200);
    const checked = await p.evaluate(() => document.querySelector('[data-testid="era-group"] input:checked')?.value);
    if (checked !== 'past') bad.push(`방향키(↑)로 지난 세상이 선택되지 않음: ${checked}`);
    notes.push(`방향키 후 선택 ${checked}`);
    shots.push(await shot(p, 'X01', '1-era-past-by-arrow'));
    // 태어나기까지 Tab
    let t2 = 0;
    for (let i = 0; i < 80; i++) {
      await p.keyboard.press('Tab');
      t2++;
      await sleep(30);
      const a = await active(p);
      if (a.id === 'start-birth') {
        notes.push(`태어나기 포커스 링 ${a.outline} off ${a.outlineOffset}`);
        if (!/^[1-9]/.test(a.outline) && !a.boxShadow) bad.push('태어나기에 포커스 링 없음');
        break;
      }
    }
    const a2 = await active(p);
    if (a2.id !== 'start-birth') bad.push(`태어나기에 닿지 못함(${a2.id})`);
    notes.push(`라디오 이후 태어나기까지 Tab ${t2}번`);
    await waitGuard(p, 'start-birth');
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-testid="roulette-screen"]', { timeout: 4000 });
    await sleep(300);
    const f1 = await active(p);
    notes.push(`룰렛 도착 포커스 ${f1.id}`);
    if (f1.id !== 'roulette-heading') bad.push(`룰렛 도착 시 포커스 ${f1.id} (제목 기대)`);
    // Tab → 건너뛰기
    await p.keyboard.press('Tab');
    await sleep(80);
    const f2 = await active(p);
    notes.push(`룰렛 Tab 1번 → ${f2.id}`);
    if (f2.id !== 'skip-roulette') bad.push(`룰렛에서 Tab 한 번 뒤 포커스 ${f2.id} (skip-roulette 기대)`);
    shots.push(await shot(p, 'X01', '2-roulette-focus-skip'));
    await waitGuard(p, 'skip-roulette');
    await p.keyboard.press('Space');
    await p.waitForSelector('[data-testid="to-birth"]', { timeout: 3000 });
    await sleep(150);
    const f3 = await active(p);
    notes.push(`건너뛰기 뒤 포커스 ${f3.id}`);
    if (f3.id !== 'to-birth') bad.push(`건너뛰기 뒤 포커스 ${f3.id} (to-birth 기대)`);
    const r = await readRoulette(p);
    const sv = await saveJson(p);
    if (sv?.data?.era !== 'past') bad.push(`저장 era ${sv?.data?.era} (past 기대)`);
    await waitGuard(p, 'to-birth');
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 3000 });
    await sleep(350);
    const f4 = await active(p);
    notes.push(`출생신고 도착 포커스 ${f4.id}`);
    if (f4.id !== 'birth-heading') bad.push(`출생신고 도착 시 포커스 ${f4.id} (제목 기대)`);
    const b = await readBirth(p);
    if (!/19[5-8]\d년/.test(b.fields.month.value)) bad.push(`지난 세상인데 출생 연월 ${b.fields.month.value}`);
    await p.keyboard.press('Tab');
    await sleep(80);
    const f5 = await active(p);
    notes.push(`출생신고 Tab 1번 → ${f5.id}`);
    if (f5.id !== 'next-life') bad.push(`출생신고에서 Tab 한 번 뒤 ${f5.id} (next-life 기대)`);
    shots.push(await shot(p, 'X01', '3-birth-focus-next'));
    await waitGuard(p, 'next-life');
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-testid="life-screen"]', { timeout: 4000 });
    await sleep(400);
    const f6 = await active(p);
    notes.push(`인생 도착 포커스 ${f6.id}`);
    const li = await lifeInfo(p);
    if (li.name !== b.name) bad.push(`인생 이름 ${li.name} ≠ ${b.name}`);
    shots.push(await shot(p, 'X01', '4-life'));
    await ctx.close();
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간(접근성)', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
  },
);

await runCase(
  { id: 'M3-X02', cat: '접근성', title: '접근성 트리: 회전 중에는 릴이 읽히지 않고, 결과 상태 문장만 알려진다(role=status, 한 번만 바뀜), 표·제목 구조', steps: 'CDP Accessibility.getFullAXTree로 회전 중·결과·출생신고의 트리를 읽고, role=status 글자 변화를 MutationObserver로 센다', expected: '회전 중 릴 칸(수저 이름 8칸·지역 이름)이 트리에 없음(aria-hidden), status 글자는 회전 중 안내→결과로 한 번만 바뀜, h1 하나, 확률표는 caption+행머리, 출생신고 표 머리글 정상' },
  async () => {
    const bad = [];
    const notes = [];
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    await fixSeed(ctx, 229);
    await ctx.addInitScript(() => {
      window.__st = [];
      const watch = () => {
        const mo = new MutationObserver(() => {
          const el = document.querySelector('[role="status"][data-testid="roulette-status"]');
          if (el) {
            const t = el.textContent.replace(/\s+/g, ' ').trim();
            const last = window.__st[window.__st.length - 1];
            if (!last || last.t !== t) window.__st.push({ t, at: Math.round(performance.now()) });
          }
        });
        mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
      };
      document.documentElement ? watch() : document.addEventListener('DOMContentLoaded', watch);
    });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await openTitle(p);
    await waitGuard(p, 'start-birth');
    await p.getByTestId('start-birth').click();
    await p.waitForSelector('[data-testid="roulette-screen"]');
    await sleep(1500);
    const ax = async () => {
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      return nodes.filter((n) => !n.ignored).map((n) => ({ role: n.role?.value, name: (n.name?.value || '').slice(0, 60), live: (n.properties || []).find((x) => x.name === 'live')?.value?.value }));
    };
    const spin = await ax();
    const names = spin.map((n) => n.name).join('|');
    const wealthNames = ['흙수저', '동수저', '은수저', '금수저', '다이아몬드수저'];
    // 릴 칸 글자는 aria-hidden — 표(확률)에서만 나온다. 수저 이름은 표 행머리에서 1번씩만(8칸 × 반복이 아님)
    const real = (n) => n.role !== 'StaticText' && n.role !== 'InlineTextBox' && n.role !== 'LineBreak';
    const wealthCount = spin.filter((n) => real(n) && wealthNames.includes(n.name)).length;
    const roleOf = spin.filter((n) => wealthNames.includes(n.name)).map((n) => n.role).join(',');
    notes.push(`회전 중 트리: 수저 이름 노드 ${wealthCount}개(확률표 행머리 5개 기대), status ${JSON.stringify(spin.filter((n) => n.role === 'status').map((n) => n.name))}`);
    if (wealthCount !== 5) bad.push(`회전 중 수저 이름 노드 ${wealthCount}개(확률표 행머리 5개 기대, 역할 ${roleOf}) — 릴 칸이 트리에 노출되었을 수 있음`);
    const regionNames = ['서울', '부산', '경기', '제주'];
    const rc = spin.filter((n) => real(n) && regionNames.includes(n.name)).length;
    notes.push(`회전 중 트리 노드: 수저 이름 ${wealthCount}개(역할 ${roleOf}), 지역 이름(4개 표본) ${rc}개`);
    if (rc !== 4) bad.push(`회전 중 지역 이름 노드 ${rc}개(확률표 4개 기대 — 릴 노출 의심)`);
    if (spin.filter((n) => n.role === 'heading' && n.name).length < 1) bad.push('제목 노드 없음');
    const spinStatusText = spin.find((n) => n.role === 'status')?.name ?? '';
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 8000 });
    await sleep(300);
    const done = await ax();
    const st2 = done.filter((n) => n.role === 'status').map((n) => n.name);
    notes.push(`결과 status ${JSON.stringify(st2)}`);
    const changes = await p.evaluate(() => window.__st);
    notes.push(`status 글자 변화 ${changes.length}번: ${changes.map((c) => c.t.slice(0, 18)).join(' → ')}`);
    if (changes.length !== 2) bad.push(`status 글자가 ${changes.length}번 바뀜(안내→결과 2개 상태 기대)`);
    const rBtn = done.filter((n) => n.role === 'button').map((n) => n.name);
    notes.push(`결과 상태 버튼 ${JSON.stringify(rBtn)}`);
    if (!rBtn.includes('출생신고 보기')) bad.push('결과 상태에 「출생신고 보기」 버튼 노드 없음');
    // 확률표 캡션
    const tables = await p.evaluate(() => [...document.querySelectorAll('.odds table')].map((t) => ({ cap: t.querySelector('caption')?.textContent, rows: t.querySelectorAll('tbody tr').length, th: t.querySelectorAll('tbody th[scope="row"]').length })));
    notes.push(`확률표 ${JSON.stringify(tables)}`);
    if (!tables.every((t) => t.cap && t.rows === t.th)) bad.push(`확률표 캡션/행머리 불완전 ${JSON.stringify(tables)}`);
    // 출생신고
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]');
    await sleep(400);
    const bt = await ax();
    const heads = bt.filter((n) => n.role === 'heading').map((n) => n.name);
    notes.push(`출생신고 제목들 ${JSON.stringify(heads)}`);
    const h1s = await p.evaluate(() => document.querySelectorAll('h1').length);
    if (h1s !== 1) bad.push(`h1이 ${h1s}개`);
    const dl = await p.evaluate(() => ({ dt: document.querySelectorAll('.doc__grid dt').length, dd: document.querySelectorAll('.doc__grid dd').length }));
    if (dl.dt !== dl.dd || dl.dt < 10) bad.push(`서류 격자 dt/dd ${JSON.stringify(dl)}`);
    const cmpHead = await p.evaluate(() => [...document.querySelectorAll('[data-testid="compare-table"] th')].map((t) => t.getAttribute('scope')));
    notes.push(`비교 표 th scope ${cmpHead.join(',')}`);
    if (!cmpHead.every((s) => s === 'col' || s === 'row')) bad.push('비교 표 머리글 scope 없음');
    const imgsNoAlt = await p.evaluate(() => [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length);
    if (imgsNoAlt) bad.push(`alt 없는 img ${imgsNoAlt}개`);
    await ctx.close();
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간(접근성)', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots: [] };
  },
);

await browser.close();
