// SPEC-005 r4 QA 3(c-080 풀이)·4(5세 기록 카드)·5(360×640·568 시트 스크롤 단서)·6(새 소식 패널)·7(공격: 연타 중 새로고침·덮은 채 뒤로가기·Esc 연타).
// 사용: node qa/scripts/q005r4-misc.mjs [--engine webkit] [--part A|B|C|D|E]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, sleep, overflowOf, saveShot, readSave, readSettings, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, pendingState } from './q005r4-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const ENGINE = arg('engine', 'chromium');
const PART = arg('part', 'ABCDE');
const tag = ENGINE === 'webkit' ? 'W' : 'C';
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const MANUAL = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false };

async function open(state, settings, viewport, wait = 'choice-panel', extra = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'ko-KR', deviceScaleFactor: 1, ...extra });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await seedPage(page, { game: state, settings });
  await page.goto(PROD + '/');
  await page.getByTestId(wait).waitFor({ timeout: 60000 });
  await sleep(800);
  return { ctx, page, watch };
}
const waitEnabled = (page, id) =>
  page.waitForFunction(
    (i) => {
      const e = document.querySelector(`[data-testid="${i}"]`);
      return e && e.getAttribute('aria-disabled') !== 'true' && !e.disabled;
    },
    id,
    { timeout: 15000 },
  );
/** .cite 안의 글자를 화면 줄로 나눈다(글자마다 Range 사각형의 위쪽 좌표로 묶는다) */
const citeLines = (page, sel = '.cite') =>
  page.evaluate((s) => {
    const root = document.querySelector(s);
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const chars = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (el.closest('.sr-only')) continue;
      const t = n.nodeValue;
      for (let i = 0; i < t.length; i++) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        const q = r.getClientRects()[0];
        if (!q || q.width === 0) continue;
        chars.push({ c: t[i], top: Math.round(q.top / 4) * 4 });
      }
    }
    let cur = null;
    for (const ch of chars) {
      if (!cur || Math.abs(ch.top - cur.top) > 6) {
        cur = { top: ch.top, text: '' };
        out.push(cur);
      }
      cur.text += ch.c;
    }
    return out.map((l) => l.text);
  }, sel);

if (PART.includes('A')) {
  // ---- A: c-080 카드 (middle-remote-work, 지금 세상 42~58세) + 풀이 문장 ----
  const expected = await oracle(dev, `const m = await import('/src/data/citationInsights.ts'); return m.insightFor('c-080');`);
  const st = await pendingState(dev, 'middle-remote-work', { era: 'present' });
  if (!st) await run({ id: `${tag}-A-c080`, area: 'c-080', title: 'c-080 카드', steps: '-', expected: '-' }, async () => note('middle-remote-work 상태를 못 찾음'));
  else {
    const { ctx, page, watch } = await open(st, MANUAL, { width: 1280, height: 800 });
    await run({ id: `${tag}-A-c080`, area: 'c-080', title: 'middle-remote-work(지금 세상): 새 풀이 문장이 인용 박스에 보인다', steps: `지금 세상 ${st.age}세 상태 열기 → 풀이 줄 읽기`, expected: '풀이 = 「재택근무를 제도로 둔 곳은 24.1%였고, 그 안쪽에서 일하는 사람의 식탁이 일터가 되었습니다.」(개정 문장), 굵은 놋쇠색, 「풀이」 글자 없음' }, async () => {
      const r = await page.evaluate(() => {
        const ins = document.querySelector('.cite__insight-text');
        const cite = document.querySelector('.cite');
        const cs = ins ? getComputedStyle(ins) : null;
        return { text: ins ? ins.innerText.replace(/^풀이:\s*/, '').replace(/\s+/g, ' ').trim() : null, weight: cs?.fontWeight, color: cs?.color, title: document.querySelector('[data-testid="choice-title"]')?.innerText, summary: cite?.querySelector('p')?.innerText };
      });
      const lines = await citeLines(page);
      const text = (r.text ?? '').replace(/\s+/g, ' ');
      const good = text === expected.replace(/\s+/g, ' ') && Number(r.weight) >= 700;
      return (good ? ok : bad)(JSON.stringify({ age: st.age, title: r.title, text, expected: expected === r.text, weight: r.weight, color: r.color, lines }));
    });
    const w = watch.take();
    await run({ id: `${tag}-A-c080-console`, area: '공통', title: 'c-080 콘솔·외부', steps: '-', expected: '0' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0') : bad(JSON.stringify(w))));
    await ctx.close();
  }
}

if (PART.includes('B')) {
  // ---- B: 5세 기록 카드(수동 모드): c-102 인용 + 지난 세상 머리말 줄바꿈 ----
  for (const era of ['present', 'past']) {
    const due = await oracle(
      dev,
      `for (let seed = 1; seed < 800; seed++) {
        let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
        for (let g = 0; g < 400 && s.phase === 'life'; g++) {
          if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
          const due = core.dueNote(s);
          if (due !== null && due.id === 'note-infant-memory') return { state: s, id: due.id };
          s = core.stepYear(s).state;
        }
      }
      return null;`,
      { era },
    );
    if (!due) {
      await run({ id: `${tag}-B-note-${era}`, area: '5세 카드', title: '5세 기록 카드', steps: '-', expected: '-' }, async () => note('note-infant-memory 상태를 못 찾음'));
      continue;
    }
    for (const vp of [{ n: 'd1280', v: { width: 1280, height: 800 }, extra: {} }, { n: 'm360', v: { width: 360, height: 740 }, extra: { hasTouch: true, isMobile: true } }]) {
      const { ctx, page, watch } = await open(withoutPlay(due.state), { ...MANUAL, noteCards: true }, vp.v, 'note-sheet', vp.extra);
      await run({ id: `${tag}-B-note-${era}-${vp.n}`, area: '5세 카드', title: `5세 기록 카드(${era}, ${vp.n}): c-102 인용·머리말·「4세 8개월」 줄바꿈`, steps: '수동 모드 + 기록 카드 켬 → 5세 카드 시트 → 인용 박스의 줄 나눔 읽기', expected: '인용이 c-102(4세 8개월 평균·개인차)이고 풀이 줄 없음, 지난 세상은 머리말, 「4세 8개월」이 두 줄로 쪼개지지 않음, 넘침 0' }, async () => {
        const lines = await citeLines(page);
        const flat = lines.join('|');
        const hasInsight = (await page.locator('[data-testid="note-sheet"] .cite__insight').count()) > 0;
        const text = lines.join(' ');
        const has48 = text.includes('4세 8개월');
        // 「4세 8개월」이 줄 경계에서 쪼개졌는가: 「4세」가 줄 끝이고 「8개월」이 다음 줄 처음
        const split = lines.some((l, i) => i < lines.length - 1 && /4세\s*$/.test(l) && /^8개월/.test(lines[i + 1]));
        const split2 = lines.some((l, i) => i < lines.length - 1 && /8\s*$/.test(l) && /^개월/.test(lines[i + 1]));
        const ov = await overflowOf(page);
        const good = has48 && !hasInsight && !split && !split2 && ov.over === 0;
        return (good ? ok : bad)(JSON.stringify({ lines, hasInsight, has48, split: split || split2, over: ov.over }));
      });
      const w = watch.take();
      if (w.console.length || w.external.length) console.log('CONSOLE', era, vp.n, JSON.stringify(w));
      await ctx.close();
    }
  }
}

if (PART.includes('C')) {
  // ---- C: 360×640 · 360×568 · 360×740 — 첫 선택지가 스크롤 아래인 카드, 시트 스크롤 단서 ----
  const longest = await oracle(
    dev,
    `const mod = await import('/src/data/events/index.ts');
    const best = new Map();
    for (const ev of mod.EVENT_POOL.events) {
      if (ev.choices === undefined) continue;
      if (!core.possibleAgesOf(ev).some((a) => core.decisionFor(ev.id, a) === 'self')) continue;
      for (const era of ['past', 'present', 'future']) {
        if (ev.eras !== undefined && !ev.eras.includes(era)) continue;
        const cite = core.citationFor(ev, era, 2200);
        if (cite === null) continue;
        const ins = (await import('/src/data/citationInsights.ts')).insightFor(cite.id) ?? '';
        const total = ev.title.length + ev.text.length + ev.choices.reduce((a, c) => a + c.label.length, 0) + cite.text.length + cite.sourceLine.length + ins.length;
        const prev = best.get(ev.id);
        if (prev === undefined || total > prev.total) best.set(ev.id, { id: ev.id, era, total });
      }
    }
    return [...best.values()].sort((a, b) => b.total - a.total || a.id.localeCompare(b.id)).slice(0, 8);`,
  );
  const probe = async (state, h) => {
    const { ctx, page } = await open(state, MANUAL, { width: 360, height: h }, 'choice-panel', { hasTouch: true, isMobile: true });
    const r = await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="choice-panel"]');
      const sr = sheet.getBoundingClientRect();
      const choices = [...document.querySelectorAll('.choice')].map((c) => c.getBoundingClientRect());
      const scrollable = sheet.scrollHeight > sheet.clientHeight + 1;
      // 시트 아래 가장자리가 가르는 요소(걸쳐 보이는 요소)가 있는가 = 이어짐 단서
      const cutBy = [...sheet.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.height > 4 && q.top < sr.bottom - 1 && q.bottom > sr.bottom + 1; }).slice(-3).map((e) => e.tagName + '.' + String(e.className).split(' ')[0]);
      return { sheetTop: Math.round(sr.top), sheetBottom: Math.round(sr.bottom), vh: innerHeight, first: choices[0] ? { top: Math.round(choices[0].top), bottom: Math.round(choices[0].bottom) } : null, n: choices.length, firstVisible: choices[0] ? choices[0].bottom <= sr.bottom + 0.5 : null, scrollable, scrollH: sheet.scrollHeight, clientH: sheet.clientHeight, cutBy };
    });
    return { ctx, page, r };
  };
  const samples = [];
  const summary = { 740: 0, 640: 0, 568: 0, n: 0 };
  for (const c of longest) {
    const st = await pendingState(dev, c.id, { era: c.era });
    if (!st) continue;
    for (const h of [740, 640, 568]) {
      const { ctx, page, r } = await probe(st, h);
      summary.n += h === 740 ? 1 : 0;
      if (r.firstVisible) summary[h]++;
      else samples.push({ id: c.id, era: c.era, h, r });
      await ctx.close();
    }
  }
  await run({ id: `${tag}-C-sheet-heights`, area: '시트 높이', title: '360×740 기본 배치 불변, 640·568에서 첫 선택지가 스크롤 아래인 카드 표본', steps: '가장 긴 카드 8장(인용+풀이 포함)을 세 높이로 열어 첫 선택지가 시트 안에서 스크롤 없이 보이는지 측정', expected: '360×740은 첫 선택지가 모두 보임(e2e FLOOR 90/90). 640·568의 표본은 RECORD' }, async () => {
    const good740 = summary[740] === summary.n;
    const info = JSON.stringify({ cards: summary.n, firstVisible: { 740: summary[740], 640: summary[640], 568: summary[568] }, below: samples.map((s) => `${s.id}@${s.r.vh}`) });
    return (good740 ? note : bad)(info, { evidence: JSON.stringify(samples.slice(0, 6)) });
  });
  // 표본 한두 장: 화면으로 단서를 판단한다 (스크린샷은 임시로 찍어 보고, 글로 못 전할 때만 저장)
  const picks = [];
  for (const h of [640, 568]) {
    const s = samples.find((x) => x.h === h);
    if (s) picks.push(s);
  }
  for (const s of picks) {
    const st = await pendingState(dev, s.id, { era: s.era });
    const { ctx, page, r } = await probe(st, s.h);
    const buf = await page.screenshot();
    const fs = await import('node:fs');
    fs.writeFileSync(`${process.env.TEMP}/r4-sheet-${s.id}-${s.h}.png`, buf);
    await run({ id: `${tag}-C-cue-${s.h}`, area: '시트 높이', title: `360×${s.h} ${s.id}: 첫 선택지가 스크롤 아래 — 스크롤 단서`, steps: '카드 열기(스크롤 0) 화면 보기', expected: '시트 아래 가장자리에 걸친 요소·스크롤 영역 등으로 스크롤될 수 있음이 짐작된다(판단 RECORD)' }, async () => note(JSON.stringify(r), { evidence: `임시 사진 ${process.env.TEMP}/r4-sheet-${s.id}-${s.h}.png` }));
    await ctx.close();
  }
}

if (PART.includes('D')) {
  // ---- D: 새 소식 패널 v0.2.1 ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' });
  const watch = new Watch(tag).attach(ctx);
  await ctx.route(/github\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(700);
  await run({ id: `${tag}-D-news`, area: '새 소식', title: 'v0.2.1 항목 6개와 요약', steps: '첫 화면 「새 소식」 → 패널의 0.2.1 항목 읽기', expected: '0.2.1이 맨 위, 항목 6개, 요약 「…PC에서는 진행·도구 버튼이 한 줄로…」, 각 항목 70자 이하, 내부 식별자 없음' }, async () => {
    await page.getByTestId('link-news').click();
    await page.getByTestId('info-panel').waitFor();
    await sleep(500);
    const r = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="info-version"]');
      const items = [...v.querySelectorAll('li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim());
      return { version: v.getAttribute('data-version'), summary: v.querySelector('summary')?.innerText.replace(/\s+/g, ' ').trim(), items, open: v.open, versions: [...document.querySelectorAll('[data-testid="info-version"]')].map((e) => e.getAttribute('data-version')).join(',') };
    });
    const good = r.version === '0.2.1' && r.items.length === 6 && /PC에서는 진행·도구 버튼이 한 줄로/.test(r.summary ?? '') && r.items.every((t) => t.replace(/^(새로|더 좋게|내용)\s*/, '').length <= 80) && !r.items.some((t) => /c-\d{3}|QI|R-\d|SPEC/.test(t));
    return (good ? ok : bad)(JSON.stringify(r));
  });
  const w = watch.take();
  await run({ id: `${tag}-D-news-console`, area: '공통', title: '패널 콘솔·외부', steps: '-', expected: '0' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0') : bad(JSON.stringify(w))));
  await ctx.close();
}

if (PART.includes('E')) {
  // ---- E: 공격 ----
  const st = await pendingState(dev, 'youth-startup');
  const chosen = async (page) => {
    const s = await readSave(page);
    return s?.data?.history?.filter((h) => h.kind === 'choice' && h.by === undefined).length ?? -1;
  };
  // E1: 자동 고르기 버튼 연타 중 새로고침 (지연 0·50·150·450ms)
  for (const delay of [0, 50, 150, 450]) {
    const { ctx, page, watch } = await open(st, MANUAL, { width: 1280, height: 800 });
    const c0 = await chosen(page);
    await run({ id: `${tag}-E1-mash-reload-${delay}`, area: '공격', title: `자동 고르기 버튼 연타 중 새로고침(${delay}ms 뒤)`, steps: '버튼 클릭 + 4번 연타 → 지연 후 새로고침 → 상태', expected: '화면이 깨지지 않고 인생 화면(같은 카드가 시트·인라인 어느 쪽이든 또는 이미 선택됨), 선택이 두 번 기록되지 않음, 저장이 읽힘, 오류 0' }, async () => {
      await waitEnabled(page, 'auto-on-btn');
      await page.getByTestId('auto-on-btn').scrollIntoViewIfNeeded();
      await sleep(200);
      const box = await page.getByTestId('auto-on-btn').boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      for (let i = 0; i < 4; i++) {
        await page.mouse.click(x, y);
        await sleep(30);
      }
      await sleep(delay);
      await page.reload();
      await page.getByTestId('life-screen').waitFor({ timeout: 30000 });
      await sleep(1000);
      const mode = await page.getByTestId('choice-panel').getAttribute('data-mode', { timeout: 1500 }).catch(() => null);
      const save = await readSave(page);
      const set = await readSettings(page);
      const hist = save?.data?.history ?? [];
      const dup = hist.filter((h) => h.key === 'youth-startup@33' || (h.kind === 'choice' && h.eventId === 'youth-startup')).length;
      const cc = await chosen(page);
      const blank = (await page.evaluate(() => document.body.innerText.trim())) === '';
      const w = watch.take();
      const good = !blank && save !== null && !save.__corrupt && dup <= 1 && cc - c0 <= 1 && w.console.length === 0;
      return (good ? ok : bad)(JSON.stringify({ mode, autoMode: set?.data?.autoMode, pendingKey: save?.data?.pending?.key ?? null, choiceDelta: cc - c0, dupEntries: dup, console: w.console.length }));
    });
    await ctx.close();
  }
  // E2: 덮은 채 뒤로가기
  {
    const { ctx, page, watch } = await open(st, MANUAL, { width: 1280, height: 800 });
    const c0 = await chosen(page);
    await run({ id: `${tag}-E2-fold-back`, area: '공격', title: '시트를 덮어 둔 채 뒤로가기 → 앞으로가기', steps: '덮기 → history.back → forward', expected: '앱이 깨지지 않고 같은 카드가 대기 중으로 복원(시트 또는 띠), 선택 0건 증가, 오류 0' }, async () => {
      await waitEnabled(page, 'decision-fold-btn');
      await page.getByTestId('decision-fold-btn').click();
      await page.getByTestId('decision-fold').waitFor();
      const hist0 = await page.evaluate(() => history.length);
      await page.goBack({ waitUntil: 'load' }).catch(() => null);
      await sleep(500);
      const urlBack = page.url();
      await page.goForward({ waitUntil: 'load' }).catch(() => null);
      await sleep(1200);
      const onLife = (await page.getByTestId('life-screen').count()) > 0;
      const pk = (await readSave(page))?.data?.pending?.key ?? null;
      const mode = await page.getByTestId('choice-panel').getAttribute('data-mode', { timeout: 1500 }).catch(() => null);
      const fold = await page.getByTestId('decision-fold').count();
      const cc = await chosen(page);
      const w = watch.take();
      const good = onLife && pk === 'youth-startup@33' && (mode === 'sheet' || fold === 1) && cc === c0 && w.console.length === 0;
      return (good ? ok : bad)(JSON.stringify({ hist0, urlBack, onLife, pendingKey: pk, mode, fold, choiceDelta: cc - c0, console: w.console.length }));
    });
    await ctx.close();
  }
  // E3: Esc 연타 — (1) 시트 (2) 압축 모드 말풍선 + 나가기 확인 (3) 정보 패널
  {
    const { ctx, page } = await open(st, MANUAL, { width: 1024, height: 800 });
    const c0 = await chosen(page);
    await run({ id: `${tag}-E3-esc-sheet`, area: '공격', title: 'Esc 30번 연타(시트·접힌 띠)', steps: '시트에서 Esc를 30번 40ms 간격', expected: '접힌 띠가 되고(덮기 한 번) 이후 Esc는 무동작, 선택 0건 증가, 오류 없음' }, async () => {
      await waitEnabled(page, 'decision-fold-btn');
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Escape');
        await sleep(40);
      }
      await sleep(500);
      const fold = await page.getByTestId('decision-fold').count();
      const sheet = await page.getByTestId('choice-panel').count();
      const cc = await chosen(page);
      return (fold === 1 && sheet === 0 && cc === c0 ? ok : bad)(JSON.stringify({ fold, sheet, choiceDelta: cc - c0 }));
    });
    // 접힌 띠 상태에서 도구 줄(압축 모드)의 나가기에 올리고 누름 → 말풍선 + 확인 상자 → Esc
    await run({ id: `${tag}-E3-esc-tip-exit`, area: '공격', title: '말풍선·나가기 확인 상자가 함께 떠 있을 때 Esc', steps: '1024 마우스: 나가기 버튼에 hover(말풍선) → 클릭(확인 상자) → Esc → Esc', expected: '말풍선이 먼저/함께 숨고 확인 상자도 닫히며, 어느 Esc도 게임을 나가거나 선택을 확정하지 않음' }, async () => {
      await waitEnabled(page, 'tool-exit');
      await page.getByTestId('tool-exit').hover();
      const tip1 = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="tool-exit"] span:not(.sr-only)')).clipPath);
      await page.getByTestId('tool-exit').click();
      await page.getByTestId('exit-ask').waitFor({ timeout: 5000 });
      await sleep(500);
      const tip2 = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="tool-exit"] span:not(.sr-only)')).clipPath);
      await page.keyboard.press('Escape');
      await sleep(300);
      const ask1 = await page.getByTestId('exit-ask').count();
      const tip3 = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="tool-exit"] span:not(.sr-only)')).clipPath);
      await page.keyboard.press('Escape');
      await sleep(300);
      const ask2 = await page.getByTestId('exit-ask').count();
      const stillLife = (await page.getByTestId('life-screen').count()) === 1;
      const cc = await chosen(page);
      return (stillLife && cc === c0 ? ok : bad)(JSON.stringify({ tipOnHover: tip1, tipWithAsk: tip2, afterEsc1: { ask: ask1, tip: tip3 }, afterEsc2: { ask: ask2 }, stillLife, choiceDelta: cc - c0 }));
    });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 800 }, locale: 'ko-KR' });
    const watch = new Watch(tag).attach(ctx);
    const page = await ctx.newPage();
    await page.goto(PROD + '/');
    await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
    await sleep(700);
    await run({ id: `${tag}-E3-esc-panel`, area: '공격', title: '정보 패널 열고 Esc 10번 연타', steps: '새 소식 열기 → Esc ×10(30ms)', expected: '패널이 닫히고 첫 화면 유지, 역사 길이 불변, 오류 0' }, async () => {
      const h0 = await page.evaluate(() => history.length);
      await page.getByTestId('link-news').click();
      await page.getByTestId('info-panel').waitFor();
      await sleep(400);
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Escape');
        await sleep(30);
      }
      await sleep(500);
      const open = await page.getByTestId('info-panel').count();
      const title = await page.getByTestId('title-screen').count();
      const h1 = await page.evaluate(() => history.length);
      const w = watch.take();
      return (open === 0 && title === 1 && w.console.length === 0 ? ok : bad)(JSON.stringify({ panelOpen: open, title, historyBefore: h0, historyAfter: h1, console: w.console.length }));
    });
    await ctx.close();
  }
}

await browser.close();
await devB.close();
console.log('done', tag, PART);
