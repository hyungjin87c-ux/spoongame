// QA-003 M4 접근성 트리: 이름 없는 버튼·링크 0, 제목 순서, 진행률 바·상태 막대 역할과 값, 기록 영역 live 토글, 중복 id 0. 사용: node qa/scripts/m4-a11y-tree.mjs
import fs from 'node:fs';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, sleep, runCase, con, CASES, VP, TOUCH, waitGuard } from './m4-lib.mjs';
import { openState } from './m4-states.mjs';

const browser = await launch();
await runCase(
  { id: 'M4-X02', cat: '접근성', title: '대시보드 접근성 트리: 모든 버튼·링크·슬라이더에 접근 가능한 이름, 제목 순서(h1→h2), 진행률 바 role=progressbar(이름 「올해 진행률」·값), 상태 막대 role=meter·이름, 기록 영역 이름·live(빠른 배속·자동 모드에서는 꺼짐), 아이콘만 있는 버튼 이름, 중복 id 0, html lang=ko', steps: '30세 저장과 선택지 카드·BGM 켠 상태·나가기 확인 단계에서 CDP Accessibility.getFullAXTree와 DOM을 읽는다', expected: '이름 없는 조작 요소 0, 제목 건너뜀 0, 역할·값 정상' },
  async () => {
    const bad = [];
    const notes = [];
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    await cleanStorageOnce(ctx);
    await fixSeed(ctx, 229);
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await newGameToLife(p);
    await p.getByTestId('tool-bgm').click();
    await sleep(400);
    const ax = async () => (await cdp.send('Accessibility.getFullAXTree')).nodes.filter((n) => !n.ignored).map((n) => ({ role: n.role?.value, name: (n.name?.value || '').trim(), props: Object.fromEntries((n.properties || []).map((x) => [x.name, x.value?.value])), value: n.value?.value }));
    let nodes = await ax();
    const need = nodes.filter((n) => ['button', 'link', 'slider', 'checkbox', 'radio', 'switch'].includes(n.role));
    const noName = need.filter((n) => !n.name);
    if (noName.length) bad.push(`이름 없는 조작 요소 ${noName.map((n) => n.role).join(',')}`);
    notes.push(`조작 요소 ${need.length}개: ${need.map((n) => `${n.role}:${n.name.slice(0, 14)}`).join(' / ')}`);
    const pb = nodes.find((n) => n.role === 'progressbar');
    if (!pb || pb.name !== '올해 진행률') bad.push(`진행률 바 ${JSON.stringify(pb)}`);
    else notes.push(`진행률 바 「${pb.name}」 값 ${pb.value}`);
    const meters = nodes.filter((n) => n.role === 'meter');
    notes.push(`meter ${meters.length}개: ${meters.map((m) => `${m.name}=${m.value}`).join(', ')}`);
    if (meters.length !== 4 || meters.some((m) => !m.name)) bad.push(`상태 meter ${JSON.stringify(meters)}`);
    const heads = nodes.filter((n) => n.role === 'heading').map((n) => ({ level: n.props.level, name: n.name }));
    notes.push(`제목 ${heads.map((h) => `h${h.level}:${h.name.slice(0, 8)}`).join(' ')}`);
    let prev = 0;
    for (const h of heads) {
      if (h.level > prev + 1 && prev !== 0) bad.push(`제목 건너뜀 h${prev}→h${h.level} (${h.name})`);
      prev = h.level;
    }
    if (heads.filter((h) => h.level === 1).length !== 1) bad.push(`h1이 ${heads.filter((h) => h.level === 1).length}개`);
    const dom = await p.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      const imgs = [...document.querySelectorAll('svg')].filter((s) => s.getAttribute('aria-hidden') !== 'true' && !s.closest('[aria-hidden="true"]') && !s.getAttribute('aria-label') && !s.querySelector('title') && !s.closest('[role="img"]')).length;
      const live = document.querySelector('[data-testid="log-list"] ol')?.getAttribute('aria-live');
      const lang = document.documentElement.lang;
      const landmarks = { header: !!document.querySelector('header'), main: !!document.querySelector('main') };
      const logRegion = document.querySelector('[data-testid="log-list"]');
      return { dup, imgs, live, lang, landmarks, logName: logRegion?.getAttribute('aria-label'), logTab: logRegion?.getAttribute('tabindex'), title: document.title };
    });
    notes.push(`lang ${dom.lang}, 제목 ${dom.title}, 기록 영역 이름 ${dom.logName}, live(1배) ${dom.live}`);
    if (dom.dup.length) bad.push(`중복 id ${dom.dup}`);
    if (dom.imgs) bad.push(`이름도 aria-hidden도 없는 svg ${dom.imgs}개`);
    if (dom.lang !== 'ko') bad.push(`lang ${dom.lang}`);
    if (!dom.landmarks.header || !dom.landmarks.main) bad.push(`랜드마크 ${JSON.stringify(dom.landmarks)}`);
    if (dom.live !== 'polite') bad.push(`1배속 기록 live=${dom.live} (polite 기대)`);
    // 빠른 배속·자동 모드에서는 live 꺼짐
    await p.locator('[data-speed="8"]').click();
    await sleep(300);
    const live8 = await p.evaluate(() => document.querySelector('[data-testid="log-list"] ol')?.getAttribute('aria-live'));
    notes.push(`live(8배) ${live8}`);
    if (live8 !== 'off') bad.push(`8배속 기록 live=${live8} (off 기대: 낭독 폭주 방지)`);
    await p.locator('[data-speed="1"]').click();
    // 진행률 바 값 변화
    const v1 = (await ax()).find((n) => n.role === 'progressbar')?.value;
    await sleep(1500);
    const v2 = (await ax()).find((n) => n.role === 'progressbar')?.value;
    notes.push(`진행률 바 값 ${v1} → ${v2}`);
    // 나가기 확인
    await p.getByTestId('tool-exit').click();
    await p.waitForSelector('[data-testid="exit-ask"]');
    await sleep(300);
    nodes = await ax();
    const alertN = nodes.find((n) => n.role === 'alert');
    notes.push(`확인 단계 alert 「${(alertN?.name || '').slice(0, 20)}」`);
    if (!alertN) bad.push('나가기 확인 단계의 role=alert 없음');
    const fb = nodes.find((n) => n.role === 'link');
    notes.push(`링크 「${fb?.name}」`);
    if (!fb || !/새 탭/.test(fb.name)) bad.push(`의견 보내기 링크 이름에 새 탭 안내 없음: ${fb?.name}`);
    const note = nodes.find((n) => n.role === 'button' && /생각 남기기/.test(n.name));
    notes.push(`생각 남기기: ${note?.name} disabled=${note?.props?.disabled}`);
    const e = con.take();
    if (e.length) bad.push(`콘솔 ${JSON.stringify(e).slice(0, 200)}`);
    await ctx.close();
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: [] };
  },
);
await browser.close();
