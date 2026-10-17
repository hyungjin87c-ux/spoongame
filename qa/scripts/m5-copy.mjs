// QA-003 M5 문구 규칙(CM7·D17·copy.md 4-7): 새 화면 글자에 느낌표·이모지가 없고, 자산 카드·최종 순자산 줄에 「약」·「빚」·▲▼가 없고, 영향 줄은 합쇼체 문장이며, 금액은 formatWon 형식이다.
import { launch, mkctx, PROD, GAME_KEY, sleep, runCase } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';
const browser = await launch();
await runCase({ id: 'M5-T01', cat: '정상', title: '새 문구 규칙: 느낌표·이모지 0, 자산 카드·최종 순자산 줄에 「약」·「빚」·▲▼ 0, 영향 문장 합쇼체, 금액 형식(천 단위 쉼표·「만 원」 한 칸·U+2212)', steps: '7상태(20세 전 선택지·성인 선택지·성인 대시보드·순자산 음수·엔딩·엔딩 음수·엔딩 20세 전) × 세 시대의 화면 글자(보이는 글자 + 스크린리더 글자)를 읽어 규칙 검사', expected: '위반 0' }, async () => {
  const bad = [];
  let texts = 0;
  let moneyN = 0;
  for (const era of ['present', 'past', 'future']) {
    for (const tag of ['young-choice', 'adult-choice', 'adult-dash', 'neg-dash', 'ending', 'ending-neg', 'ending-early']) {
      const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
      const page = await ctx.newPage();
      await page.goto(PROD, { waitUntil: 'load' });
      await page.evaluate(([k, v]) => {
        localStorage.clear();
        localStorage.setItem(k, v);
      }, [GAME_KEY, loadSave(era, tag)]);
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-testid="life-screen"], [data-testid="ending-screen"]');
      await sleep(300);
      const t = await page.evaluate(() => {
        const q = (s) => [...document.querySelectorAll(s)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
        return {
          all: document.body.textContent.replace(/\s+/g, ' '),
          card: q('[data-testid="assets-card"]').join(' '),
          finalNet: q('[data-testid="final-net"]').join(' '),
          sr: q('.impact__item .sr-only'),
          money: [...document.querySelectorAll('[data-testid="assets-net"],[data-testid="assets-income"],[data-testid="assets-debt"],[data-testid="final-net-value"]')].map((e) => e.textContent.trim()),
        };
      });
      texts++;
      const where = `${era}/${tag}`;
      if (/!|！/.test(t.all)) bad.push(`${where}: 느낌표`);
      if (/\p{Extended_Pictographic}/u.test(t.all)) bad.push(`${where}: 이모지`);
      // 금액(원 단위 글자) 바로 앞에 「약」이 붙는가. 「상위 약 8%」 같은 자리 문구의 「약」은 어림 문장이라 허용
      if (t.money.some((m, i) => false) || /약\s*−?[\d,]+(조|억|만)?[^%\d]*원/.test(t.card) || /약\s*−?[\d,]+(조|억|만)?[^%\d]*원/.test(t.finalNet)) bad.push(`${where}: 금액 앞에 「약」`);
      if (/빚/.test(t.card + ' ' + t.finalNet)) bad.push(`${where}: 「빚」`);
      if (/[▲▼]/.test(t.card + ' ' + t.finalNet)) bad.push(`${where}: 카드에 ▲▼`);
      for (const s of t.sr) if (!/(늘어납니다|줄어듭니다)\.$/.test(s)) bad.push(`${where}: 영향 문장 어체 「${s}」`);
      for (const m of t.money) {
        moneyN++;
        if (!/^(−)?(\d{1,3}(,\d{3})*조 )?(\d{1,3}(,\d{3})*억 )?(\d{1,3}(,\d{3})*만 )?원$|^(−)?\d{1,3}(,\d{3})*원$/.test(m)) bad.push(`${where}: 금액 형식 「${m}」`);
        if (/\u00a0|\s{2,}/.test(m)) bad.push(`${where}: 금액 공백 이상 「${m}」`);
      }
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') : `화면 ${texts}개·금액 ${moneyN}개 검사, 위반 0`, shots: [] };
});
await browser.close();
