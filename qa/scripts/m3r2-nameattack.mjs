// QA-003 M3 2회차 — 공격: 저장에 심은 긴·특수 이름이 새 서류 레이아웃(큰 이름·도장·낱말 끊김 규칙)에서 어떻게 그려지는가.
// 정상 플레이에서는 이름이 3글자뿐이다(원자료 확인). 변조 저장에서만 생기는 상황이라 낮은 심각도 — 가로 넘침·태그 삽입·글자 불일치는 FAIL, 이름이 도장과 겹치는 것은 기록.
// 사용: node qa/scripts/m3r2-nameattack.mjs
import { launch, mkctx, fixSeed, openTitle, toRoulette, waitGuard, readBirth, readRaw, saveJson, runCase, shot, sleep, setRootFont, VP, TOUCH, PROD, GAME_KEY, SETTINGS_KEY } from './m3r2-lib.mjs';
import { WB_AUDIT } from './m3r2-wb.mjs';

const browser = await launch();
async function makeBirthSave(seed) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  await openTitle(p);
  await toRoulette(p, 'present');
  await waitGuard(p, 'skip-roulette');
  await p.getByTestId('skip-roulette').click();
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]');
  await waitGuard(p, 'to-birth');
  await p.getByTestId('to-birth').click();
  await p.waitForSelector('[data-testid="birth-screen"]');
  const raw = await readRaw(p);
  await ctx.close();
  return raw;
}

const NAMES = [
  ['한글20자', '가나다라마바사아자차카타파하거너더러머버'],
  ['영문대문자20', 'WWWWWWWWWWWWWWWWWWWW'],
  ['공백포함긴이름', '김 수저 게임 하는 사람 이름'],
  ['이모지ZWJ', '👨‍👩‍👧‍👦🇰🇷😀'],
  ['자모분리', 'ㅅㅜㅈㅓㄱㅔㅇㅣㅁ'],
  ['결합문자', 'e' + '́'.repeat(12)],
  ['RTL', 'مرحبا שלום'],
  ['태그', '<script>x</script>'],
  ['따옴표SQL', `'"; DROP TABLE t;--`],
  ['한글4자', '남궁민준'],
];
const VPS = [
  { name: '320x568', width: 320, height: 568, touch: true },
  { name: '360x740', width: 360, height: 740, touch: true },
  { name: '1280x800', width: 1280, height: 800 },
];

await runCase(
  {
    id: 'M3-A21',
    cat: '공격',
    title: '저장에 심은 긴·특수 이름(한글 20자·영문 W 20자·이모지·결합문자·RTL·태그 등)이 새 출생신고 서류에서 글자 그대로·가로 넘침 0·태그 삽입 0·도장과 겹침 여부',
    steps: '정상 v6 출생신고 저장의 이름만 바꿔 심고(20자 초과는 저장 검증이 거부) 폭 320·360·1280 × 글자 100·200%에서 이름 글자·가로 넘침·도장과 이름 줄 상자의 겹침·낱말 끊김 측정기(큰 이름이 한 줄보다 짧은데 끊기면 결함)로 본다',
    expected: '이름이 글자 그대로, 가로 넘침 0, 태그·스크립트 삽입 0, 콘솔 오류 0. 도장과 겹침·긴 낱말 끊김은 기록(정상 플레이에서는 이름이 3글자뿐)',
  },
  async () => {
    const bad = [];
    const notes = [];
    const overlaps = [];
    const brokenShort = [];
    const shots = [];
    const base = JSON.parse(await makeBirthSave(4040));
    for (const [label, nm] of NAMES) {
      const raw = JSON.stringify({ ...base, data: { ...base.data, character: { ...base.data.character, name: nm } } });
      for (const vp of VPS) {
        const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}) });
        await ctx.addInitScript(([k, v]) => {
          try {
            if (!sessionStorage.getItem('__planted')) {
              sessionStorage.setItem('__planted', '1');
              localStorage.clear();
              localStorage.setItem(k, v);
            }
          } catch {}
        }, [GAME_KEY, raw]);
        const p = await ctx.newPage();
        const errs = [];
        p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
        p.on('dialog', (d) => {
          errs.push('dialog:' + d.message());
          d.dismiss().catch(() => {});
        });
        await p.goto(PROD, { waitUntil: 'load' });
        await sleep(500);
        const scr = await p.evaluate(() => ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'unknown');
        if (scr !== 'birth-screen') {
          notes.push(`${label}/${vp.name}: 화면 ${scr}(저장 검증이 이름을 거부)`);
          if (nm.length <= 20 && scr !== 'title-screen') bad.push(`${label}/${vp.name}: 화면 ${scr}`);
          await ctx.close();
          continue;
        }
        for (const font of [100, 200]) {
          await setRootFont(p, font);
          await sleep(250);
          const b = await readBirth(p);
          if (b.name !== nm) bad.push(`${label}/${vp.name}/${font}%: 화면 이름 ${JSON.stringify(b.name)} ≠ ${JSON.stringify(nm)}`);
          const ov = await p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
          if (ov > 0) bad.push(`${label}/${vp.name}/${font}%: 가로 넘침 ${ov}px`);
          const injected = await p.evaluate(() => !!document.querySelector('[data-testid="birth-screen"] script, [data-testid="birth-screen"] svg[onload], [data-testid="birth-screen"] img[src="x"]'));
          if (injected) bad.push(`${label}/${vp.name}/${font}%: 태그가 DOM에 삽입됨`);
          // 이름 줄 상자와 도장의 겹침
          const ov2 = await p.evaluate(() => {
            const stamp = document.querySelector('.stamp');
            const nameEl = document.querySelector('[data-testid="birth-name"]');
            if (!stamp || !nameEl) return null;
            const s = stamp.getBoundingClientRect();
            const rg = document.createRange();
            rg.selectNodeContents(nameEl);
            let area = 0;
            for (const r of rg.getClientRects()) {
              const w = Math.min(r.right, s.right) - Math.max(r.left, s.left);
              const h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
              if (w > 2 && h > 2) area += w * h;
            }
            return Math.round(area);
          });
          if (ov2 && ov2 > 0) overlaps.push(`${label}/${vp.name}/${font}%: 이름 글자와 도장이 겹침 ${ov2}px²`);
          const wb = await p.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
          for (const x of wb.broken) brokenShort.push(`${label}/${vp.name}/${font}%: 「${x.word}」 ${x.shape} (한 줄 ${x.lineW}px, 낱말 ${x.natural}px, ${x.where.split('<')[0]})`);
          if (label === '한글20자' && vp.name === '320x568' && font === 200) shots.push(await shot(p, 'A21', `${label}-${vp.name}-${font}`));
        }
        if (errs.length) bad.push(`${label}/${vp.name}: 콘솔·대화상자 ${errs.join('|')}`);
        if ((label === '영문대문자20' || label === '이모지ZWJ') && vp.name === '360x740') shots.push(await shot(p, 'A21', `${label}-${vp.name}`));
        await ctx.close();
      }
    }
    const verdict = bad.length ? 'FAIL' : 'PASS';
    return {
      verdict,
      severity: '낮음(변조 저장 한정)',
      actual: bad.length ? bad.slice(0, 6).join(' / ') : `이름 ${NAMES.length}종 × 3폭 × 글자 100·200%: 글자 그대로·가로 넘침 0·태그 삽입 0. 도장 겹침 ${overlaps.length}건(${[...new Set(overlaps.map((o) => o.split('/')[0]))].join(',') || '-'}), 한 줄보다 짧은데 끊긴 낱말 ${brokenShort.length}건${brokenShort.length ? ' — ' + brokenShort.slice(0, 3).join(' ; ') : ''}. 거부된 저장: ${notes.length}건`,
      shots,
      extra: { overlaps: overlaps.slice(0, 20), brokenShort: brokenShort.slice(0, 20), notes: notes.slice(0, 10) },
    };
  },
);
await browser.close();
