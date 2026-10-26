// SPEC-005 QA: 키보드만으로 조작하기 — 첫 화면에서 태어나기, 결정 카드, 기록 시트, 정보 패널, 가린 줄 펼침까지 마우스 없이.
// 프로덕션 빌드(4391). 사용: node qa/scripts/q005-kbd.mjs [--engine webkit]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, shot, sleep, focusHidden, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, readSave } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const ENGINE = arg('engine', 'chromium');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}KBD`;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

const act = (page) => page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; const cs = getComputedStyle(a); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'; return `${a.dataset.testid ?? a.tagName}${ring ? '' : '(링 없음)'}`; });
async function enter(page) {
  await page.waitForFunction(() => { const a = document.activeElement; return a && a.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 5000 }).catch(() => {});
  await sleep(150);
  await page.keyboard.press('Enter');
}
/** Tab을 눌러 target(data-testid)에 닿을 때까지. 닿으면 누른 횟수, 못 닿으면 -1. 가려진 포커스를 센다 */
async function tabTo(page, testId, max = 80, hiddenLog = []) {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press('Tab');
    const fh = await focusHidden(page);
    if (fh && fh.covered) hiddenLog.push(`${fh.tag}←${fh.by}`);
    const id = await page.evaluate(() => document.activeElement?.dataset?.testid ?? null);
    if (id === testId) return i;
  }
  return -1;
}

// ================================================================ K01 첫 화면 → 인생 (마우스 없이)
{
  const ctx = await browser.newContext({ ...VP.d1280, locale: 'ko-KR' });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(900);
  const hidden = [];
  const log = [];
  // 세상 라디오 → 지난 세상 → 다가올 세상 → 지금 세상 (방향키)
  const n1 = await tabTo(page, 'era-present', 40, hidden);
  log.push(`era-present까지 Tab ${n1}`);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  const eraSel = await page.evaluate(() => document.querySelector('[data-testid^="era-"]:checked')?.dataset.testid);
  // 인생 길이: 약 1시간은 비활성이라 방향키로 못 간다
  const n2 = await tabTo(page, 'life-short30', 10, hidden);
  await page.keyboard.press('ArrowRight');
  const lifeSel = await page.evaluate(() => document.querySelector('[data-testid^="life-"]:checked')?.dataset.testid);
  // 스위치: Space로 켜고 다시 끄기
  const n3 = await tabTo(page, 'gentle-switch', 6, hidden);
  await page.keyboard.press('Space');
  const on = await page.getByTestId('gentle-switch').getAttribute('aria-checked');
  await page.keyboard.press('Enter');
  const off = await page.getByTestId('gentle-switch').getAttribute('aria-checked');
  // 푸터 링크: 새 소식 Enter → 패널 → Esc
  let n4 = await tabTo(page, 'link-news', 8, hidden);
  if (n4 === -1 && ENGINE === 'webkit') {
    // Safari/WebKit은 기본 설정에서 Tab이 링크에 닿지 않는다(「각 항목을 강조하려면 Tab 키 누름」 설정 꺼짐) — 엔진 설정이라 링크만 직접 포커스한다
    log.push('WebKit: Tab이 링크에 닿지 않음(엔진 기본 설정)');
    await page.getByTestId('link-news').focus();
    n4 = 0;
  }
  await page.keyboard.press('Enter');
  await page.getByTestId('info-panel').waitFor();
  const focusPanel = await act(page);
  await page.keyboard.press('Escape');
  await sleep(700);
  const focusBack = await act(page);
  // 태어나기
  const n5 = await tabTo(page, 'start-birth', 40, hidden);
  await enter(page);
  await page.getByTestId('roulette-screen').waitFor();
  await sleep(700);
  const n6 = await tabTo(page, 'skip-roulette', 10, hidden);
  await enter(page);
  await page.waitForFunction(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state') === 'result');
  const n7 = await tabTo(page, 'to-birth', 10, hidden);
  await enter(page);
  await page.getByTestId('birth-screen').waitFor();
  await sleep(500);
  const n8 = await tabTo(page, 'next-life', 30, hidden);
  await enter(page);
  await page.getByTestId('life-screen').waitFor();
  await sleep(500);
  const w = watch.take();
  await run({ id: `${tag}-K01-title-to-life`, area: '키보드', title: `키보드만으로 첫 화면(세상 선택·인생 길이·가림 스위치·새 소식 패널) → 룰렛 → 출생신고 → 인생 화면`, steps: 'Tab/방향키/Space/Enter/Esc만 사용', expected: '모든 단계 도달, 포커스 링 항상 있음, 가려진 포커스 0, 패널 Esc 뒤 포커스 링크 복귀' }, async () => {
    const t = `${log.join(' · ')} · 세상 ${eraSel} · 인생 길이 ${n2}탭 ${lifeSel}(방향키로 약 1시간에 못 감) · 스위치 ${n3}탭 켬${on}→끔${off} · 새 소식 ${n4}탭 → 패널 포커스 ${focusPanel} → Esc 뒤 ${focusBack} · 태어나기 ${n5}탭 · 건너뛰기 ${n6} · 출생신고 보기 ${n7} · 살아가기 ${n8} · 가려진 포커스 ${hidden.length}${hidden.length ? JSON.stringify(hidden.slice(0, 3)) : ''} · 콘솔 ${w.console.length}`;
    const pass = [n1, n2, n3, n5, n6, n7, n8].every((x) => x > 0) && n4 >= 0 && lifeSel === 'life-short30' && on === 'true' && off === 'false' && /info-title/.test(focusPanel) && /link-news/.test(focusBack) && hidden.length === 0 && w.console.length === 0 && !/(?<!title)\(링 없음\)/.test(t.replace(/(info|choice|note)-title\(링 없음\)/g, '$1-title'));
    return pass ? ok(t) : bad(t, { shot: await shot(page, `${tag}-K01`) });
  });
  await ctx.close();
}

// ================================================================ K02 인생 화면: 일시정지·배속·결정 카드(키보드로 고르기)·접기·기록 시트
{
  const S = await oracle(dev, `for (let seed = 21; seed < 400; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
      for (let g = 0; g < 4000 && s.phase === 'life'; g++) {
        if (s.pending !== null) { if (s.age >= 22 && s.pending.choiceIds.length >= 3) return s; s = core.autoResolveStep(s, s.pending.key).state; continue; }
        const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
        s = core.stepYear(s).state;
      }
    }
    return null;`).then(withoutPlay);
  const ctx = await browser.newContext({ ...VP.d1280, locale: 'ko-KR' });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await seedPage(page, { game: { ...S, paused: false }, settings: { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: true } });
  await page.goto(PROD + '/');
  await page.getByTestId('choice-panel').waitFor({ timeout: 30000 });
  await sleep(700);
  const hidden = [];
  const out = [];
  // 시트에서: 포커스는 제목, Tab으로 접기/선택지
  out.push(`시트 열림 포커스 ${await act(page)}`);
  await page.keyboard.press('Tab');
  out.push(`Tab → ${await act(page)}`);
  await page.keyboard.press('Escape'); // 카드 접기
  await sleep(500);
  const folded = await page.getByTestId('decision-fold').count();
  const nR = await tabTo(page, 'decision-reopen', 40, hidden);
  await enter(page);
  await sleep(500);
  const reopened = await page.getByTestId('choice-panel').count();
  // 선택지를 Tab으로 찾아 Enter
  const nC = await tabTo(page, (await page.evaluate(() => document.querySelector('[data-testid="choice-panel"] button.choice')?.dataset.testid)) ?? 'x', 12, hidden);
  await enter(page);
  await sleep(1200);
  const resolved = (await page.getByTestId('choice-panel').count()) === 0;
  // 일시정지·배속
  const nP = await tabTo(page, 'pause', 60, hidden);
  await page.keyboard.press('Space');
  const paused = await page.getByTestId('pause').getAttribute('data-paused');
  await page.keyboard.press('Space');
  const resumed = await page.getByTestId('pause').getAttribute('data-paused');
  await page.keyboard.press('Tab'); // 1배
  await page.keyboard.press('Tab'); // 2배
  await page.keyboard.press('Enter');
  const sp = await page.evaluate(() => document.querySelector('[data-speed][aria-pressed="true"]')?.dataset.speed);
  // 생각 남기기 시트: Tab으로 도구 줄 → Enter → 입력 → Tab → 저장
  const nN = await tabTo(page, 'tool-note', 40, hidden);
  await page.keyboard.press('Enter');
  await page.getByTestId('note-input').waitFor();
  await sleep(500);
  const noteFocus = await act(page);
  await tabTo(page, 'note-input', 6, hidden); // 시트가 열리면 포커스는 제목이다 — Tab으로 입력칸에 간다
  await page.keyboard.type('키보드로 남긴 기록');
  await tabTo(page, 'note-save', 10, hidden);
  await enter(page);
  await sleep(900);
  const sv = (await readSave(page)).data;
  const noted = sv.history.some((h) => h.kind === 'note' && h.text.includes('키보드로 남긴 기록'));
  const w = watch.take();
  await run({ id: `${tag}-K02-life`, area: '키보드', title: `키보드만으로 결정 시트(접기·다시 열기·고르기)·일시정지·배속·생각 남기기`, steps: 'Tab/Space/Enter/Esc만 사용', expected: 'Esc로 접기, 다시 열기 Enter, 선택지 Enter로 고름, Space로 일시정지/재개, 배속 Enter, 생각 남기기 저장, 가려진 포커스 0' }, async () => {
    const t = `${out.join(' · ')} · 접힘 ${folded} · 다시 열기 ${nR}탭→${reopened} · 선택지 ${nC}탭 → 고름 ${resolved} · 일시정지 ${nP}탭 ${paused}→${resumed} · 배속 ${sp} · 생각 남기기 ${nN}탭, 입력 포커스 ${noteFocus}, 저장됨 ${noted} · 가려진 포커스 ${hidden.length}${hidden.length ? JSON.stringify(hidden.slice(0, 3)) : ''} · 콘솔 ${w.console.length}`;
    const t2 = t.replace(/(info|choice|note)-title\(링 없음\)/g, '$1-title');
    const pass = !/\(링 없음\)/.test(t2) && folded === 1 && reopened === 1 && resolved && paused === 'true' && resumed === 'false' && sp === '2' && noted && hidden.length === 0 && w.console.length === 0;
    return pass ? ok(t) : bad(t, { shot: await shot(page, `${tag}-K02`) });
  });
  await ctx.close();
}

await browser.close();
await devBrowser.close();
console.log('done', tag);
