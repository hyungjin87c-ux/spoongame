// T10 글감 `note-parents-aging` 변형 + {이름} 치환 + 사용자 글 공격(특수문자·이모지·자모 분리·초장문). 이름은 입력 UI가 없다(풀에서 뽑힌 한글 3~5자) — 가장 긴 5자 이름으로 줄바꿈·넘침도 본다
// 사용: QA_STATES=<states5> QA_BASE=… node qa/scripts/009/fm7a-note.mjs
import { chromium, boot, loadState, readSave, GAME_KEY } from './fm7a-lib.mjs';

const CASES = [
  ['NOTE-father_gone-industrial', '남은 분 어머니'],
  ['NOTE-mother_gone-boomer', '남은 분 아버지'],
  ['NOTE-none-boomer', '두 분 계신 원본(부모님)'],
];
const ATTACKS = [
  ['script', '<script>window.__xss=1</script><img src=x onerror="window.__xss=2">'],
  ['sql', `'"; DROP TABLE users; --`],
  ['emoji', '😀🙏👨‍👩‍👧‍👦🇰🇷가나다'],
  ['jamo', 'ㄱㅏㄴㅏㄷㅏㅂㅏㅂㅗ ㅎㅏㅁㅜㄹ'],
  ['long', '아'.repeat(400)],
  ['lines', '첫줄\n둘째줄\n셋째줄\n넷째줄\n다섯째줄'],
  ['empty', '   ​  '],
];
const keys = process.argv.slice(2);
const b = await chromium.launch();
for (const vp of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
  for (const [key, label] of CASES) {
    for (const nameCase of ['원래 이름', '5자 이름']) {
      const st = loadState(key);
      if (nameCase === '5자 이름') st.data.character.name = '남궁민수아';
      const { ctx, page, errors } = await boot(b, st, { viewport: vp, scale: 1, settings: { speed: 1, autoMode: false, noteCards: true } });
      await page.getByTestId('note-sheet').waitFor({ timeout: 12000 }).catch(() => {});
      const vis = await page.getByTestId('note-sheet').isVisible().catch(() => false);
      const prompt = vis ? (await page.getByTestId('note-sheet').innerText())?.replace(/\s+/g, ' ').trim() : '(시트 없음)';
      const ov = vis ? await page.evaluate(() => { const s = document.querySelector('[data-testid="note-sheet"]'); return { sheetOverflowX: s.scrollWidth > s.clientWidth + 1, pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; }) : null;
      console.log(`${vp.width}px ${key} ${nameCase} [${label}] → 「${prompt}」 ${JSON.stringify(ov)} errors ${errors.length}`);
      if (vp.width === 1280 && nameCase === '원래 이름' && key === CASES[0][0] && vis) {
        // 사용자 글 공격: 입력 → 저장 → 기록 줄·localStorage 확인
        for (const [aid, text] of ATTACKS) {
          const st2 = loadState(key);
          const r = await boot(b, st2, { viewport: vp, scale: 1, settings: { speed: 1, autoMode: false, noteCards: true } });
          await r.page.getByTestId('note-input').waitFor({ timeout: 12000 }).catch(() => {});
          await r.page.getByTestId('note-input').fill(text).catch(() => {});
          const shown = await r.page.getByTestId('note-input').inputValue().catch(() => '?');
          const cnt = await r.page.getByTestId('note-count').textContent().catch(() => '');
          const msg = await r.page.getByTestId('note-msg').textContent().catch(() => '');
          await r.page.getByTestId('note-save').click({ timeout: 1500 }).catch(() => {});
          await r.page.waitForTimeout(300);
          const xss = await r.page.evaluate(() => window.__xss ?? 0);
          const sv = await readSave(r.page);
          const noteRow = (sv?.data?.history ?? []).filter((h) => h.kind === 'note').map((h) => h.text);
          const sheetStill = await r.page.getByTestId('note-sheet').isVisible().catch(() => false);
          const overflow = await r.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
          console.log(`  [공격 ${aid}] 입력창 ${JSON.stringify(shown.slice(0, 24))}(${shown.length}자) 카운터 ${cnt?.trim()} 안내 「${msg?.trim()}」 | 저장된 기록 ${JSON.stringify(noteRow.map((t) => t.slice(0, 30)))} | 시트 남음 ${sheetStill} | XSS ${xss} | 가로넘침 ${overflow} | errors ${r.errors.length}`);
          await r.ctx.close();
        }
      }
      await ctx.close();
    }
  }
}
await b.close();
