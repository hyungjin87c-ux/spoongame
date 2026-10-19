// QA-003 M7c B07b: 1번·2번·확인 버튼을 더블탭(60ms 간격)했을 때 둘째 탭이 시트가 닫힌 뒤 같은 좌표의 살아 있는 컨트롤(도구 줄·하단 컨트롤)에 떨어지는지 — 공통 뷰포트 11종 × 글자 100·200%.
// CM5: 「신규 버튼(기록 버튼·컨트롤)에 연타·진입 직후 가드, 겹침은 뷰포트마다 측정」. 둘째 탭이 컨트롤을 실제로 눌렀는지(일시정지·배속·다크·BGM·새 시트·나가기 확인·팝업)를 상태 전후로 잰다.
// 사용: node qa/scripts/m7c-attack3.mjs
import { launch, openOracle, plainLife, dueStateFor, openSeeded, sheetReady, readNote, readCard, shot, sleep, runCase, appendJsonl, STD_VIEWPORTS, setRootFont, SET_MANUAL } from './m7c-lib.mjs';

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });

const STATE = () =>
  ({}); // placeholder

const readUi = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      paused: q('[data-testid="pause"]') ? q('[data-testid="pause"]').getAttribute('data-paused') : null,
      speed: q('[data-speed][aria-pressed="true"]') ? q('[data-speed][aria-pressed="true"]').getAttribute('data-speed') : null,
      theme: document.documentElement.getAttribute('data-theme'),
      bgm: q('[data-testid="tool-bgm"]') ? q('[data-testid="tool-bgm"]').getAttribute('aria-pressed') : null,
      dark: q('[data-testid="tool-dark"]') ? q('[data-testid="tool-dark"]').getAttribute('aria-pressed') : null,
      auto: q('[data-testid="auto"]') ? q('[data-testid="auto"]').getAttribute('aria-pressed') : null,
      sheet: !!q('[data-testid="note-sheet"]'),
      exitAsk: !!q('[data-testid="exit-ask"]'),
      choice: !!q('[data-testid="choice-panel"]'),
      age: q('[data-testid="life-age"] b') ? q('[data-testid="life-age"] b').textContent : null,
      screen: ['title-screen', 'life-screen', 'ending-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'other',
    };
  });

const describeAt = (page, x, y) =>
  page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py);
    if (!el) return null;
    const btn = el.closest('button, a, [role="button"], input, textarea, select');
    const t = btn || el;
    return { tag: t.tagName.toLowerCase(), testid: t.getAttribute('data-testid') || t.closest('[data-testid]')?.getAttribute('data-testid') || '', text: (t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24), interactive: !!btn, inert: !!t.closest('[inert]'), ariaDisabled: t.getAttribute('aria-disabled') };
  }, [x, y]);

const rows = [];
const TARGETS = [
  { id: 'keep-cite', label: '자동 ① 시트(인용 있음) · 1번', state: infant, auto: true, text: '더블탭 시험', button: 'note-save' },
  { id: 'keep-manual', label: '수동 시트 · 1번', state: base, auto: false, text: '더블탭 시험', button: 'note-save' },
  { id: 'skip-empty', label: '수동 시트(글 없음) · 2번', state: base, auto: false, text: '', button: 'note-skip' },
  { id: 'discard', label: '수동 시트 확인 단계 · 「글을 지우고 담아 두기」', state: base, auto: false, text: '버릴 글', button: 'note-confirm-discard', viaSkip: true },
];

for (const T of TARGETS) {
  for (const font of [100, 200]) {
    const id = `D-${T.id}-${font}`;
    await runCase(
      { id, cat: '입력 가드', title: `${T.label} 더블탭(60ms) — 글자 ${font}% · 공통 뷰포트 11종에서 둘째 탭이 닫힌 뒤 컨트롤을 누르는가`, steps: '버튼 중심을 60ms 간격으로 두 번 탭 → 500ms 뒤 컨트롤 상태 비교', expected: '둘째 탭이 어떤 컨트롤도 작동시키지 않음(기록 1줄 또는 0줄, 일시정지·배속·다크·BGM·새 시트·나가기 확인·팝업 변화 0)' },
      async () => {
        const hits = [];
        const table = [];
        const shots = [];
        for (const vp of STD_VIEWPORTS) {
          const { ctx, page } = await openSeeded(b, T.state, { vp: { width: vp.width, height: vp.height }, wait: T.auto ? '[data-testid="note-sheet"]' : '[data-testid="life-screen"]' });
          const popups = [];
          ctx.on('page', (p) => popups.push(p.url()));
          if (!T.auto) {
            await page.getByTestId('tool-note').tap();
          }
          await sheetReady(page);
          await setRootFont(page, font);
          await sleep(300);
          if (T.text) {
            await page.getByTestId('note-input').focus();
            await page.keyboard.insertText(T.text);
          }
          if (T.viaSkip) {
            await page.getByTestId('note-skip').scrollIntoViewIfNeeded().catch(() => {});
            await page.getByTestId('note-skip').click({ force: true });
            await page.waitForSelector('[data-testid="note-confirm"]', { timeout: 3000 });
            await sleep(600);
          }
          const btn = page.getByTestId(T.button);
          await btn.scrollIntoViewIfNeeded().catch(() => {});
          await sleep(150);
          const box = await btn.boundingBox();
          if (!box) {
            table.push({ vp: vp.name, error: 'no box' });
            await ctx.close();
            continue;
          }
          const x = box.x + box.width / 2;
          const y = Math.min(box.y + box.height / 2, vp.height - 2);
          const before = await readUi(page);
          const rowsBefore = (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data.history.filter((h) => h.kind === 'note').length, 'suzeo-game:save'));
          await page.touchscreen.tap(x, y);
          await sleep(60);
          const under = await describeAt(page, x, y); // 첫 탭 직후(60ms) 같은 좌표에 있는 요소
          await page.touchscreen.tap(x, y);
          await sleep(600);
          const after = await readUi(page);
          const rowsAfter = (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data.history.filter((h) => h.kind === 'note').length, 'suzeo-game:save'));
          const diff = {};
          for (const k of Object.keys(before)) if (before[k] !== after[k]) diff[k] = `${before[k]}→${after[k]}`;
          // 이 시험의 정상 변화: 시트가 닫힘(sheet true→false)
          delete diff.sheet;
          if (popups.length) diff.popup = popups.join(',').slice(0, 80);
          const rec = { vp: vp.name, font, target: T.id, x: Math.round(x), y: Math.round(y), under, rowsBefore, rowsAfter, diff };
          table.push(rec);
          appendJsonl('dbltap.jsonl', rec);
          if (Object.keys(diff).length) {
            hits.push(rec);
            shots.push(await shot(page, `${id}-${vp.name}`, 'after'));
          }
          await ctx.close();
        }
        const bad = hits.length;
        return { verdict: bad ? 'FAIL' : 'PASS', actual: bad ? `둘째 탭이 컨트롤을 작동시킨 뷰포트 ${bad}/${STD_VIEWPORTS.length}: ${hits.map((h) => `${h.vp} [${h.under ? h.under.testid || h.under.tag : '?'} ${JSON.stringify(h.diff)}]`).join(' | ')}` : `11개 뷰포트에서 둘째 탭이 컨트롤을 작동시키지 않음(둘째 탭 지점 요소: ${[...new Set(table.map((t) => (t.under ? t.under.testid || t.under.tag : '?')))].join(',')})`, shots, table };
      },
    );
  }
}

await b.close();
