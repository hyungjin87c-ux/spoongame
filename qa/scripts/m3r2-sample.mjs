// QA-003 M3 표본 다양성: 시드를 바꿔 세 세상 × 여러 판을 룰렛(건너뛰기)→출생신고까지 돌려 화면에서 값을 모으고 불변식을 점검한다.
// 사용: node qa/scripts/m3-sample.mjs <era> <startSeed> <count> [workers]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, openTitle, toRoulette, readRoulette, readBirth, skipToBirth, saveJson, OUT, VP, TOUCH, sleep } from './m3r2-lib.mjs';
const BIG = process.env.QA_BIG || OUT;

const [era = 'present', startSeedS = '1', countS = '100', workersS = '4'] = process.argv.slice(2);
const startSeed = Number(startSeedS);
const count = Number(countS);
const workers = Number(workersS);
const outFile = path.join(BIG, `samples-${era}.jsonl`);

const WEALTH = ['흙수저', '동수저', '은수저', '금수저', '다이아몬드수저'];
const ORDER_WORDS = ['첫째', '둘째', '셋째', '넷째', '다섯째'];

function check(s) {
  const v = [];
  const b = s.birth;
  const r = s.roulette;
  const f = b.fields;
  const wealth = f.wealth?.value ?? '';
  const mWealth = /^(흙수저|동수저|은수저|금수저|다이아몬드수저)\s?\((.+)\)$/.exec(wealth);
  if (!mWealth) v.push(`집안 형편 형식 어긋남: ${wealth}`);
  const wName = mWealth?.[1];
  if (wName && !r.status.startsWith(wName)) v.push(`룰렛 결과 문구(${r.status}) ≠ 집안 형편(${wealth})`);
  if (wName && r.wealthResult !== wName) v.push(`수저 릴 결과(${r.wealthResult}) ≠ 집안 형편(${wName})`);
  const place = f.place?.value ?? '';
  const regionShort = r.regionResult ?? '';
  if (!place) v.push('태어난 곳 없음');
  else if (s.era !== 'past' || true) {
    // 시도 줄임 이름이 정식 이름 앞부분에 있어야 한다(전남광주 → 전남광주통합특별시 등)
    const ok = place[0] === regionShort[0] && (regionShort.length < 2 || place.includes(regionShort[1]) || regionShort.slice(0, 2) === place.slice(0, 2));
    if (!ok) v.push(`릴 지역(${regionShort})이 태어난 곳(${place})에 없음`);
  }
  if (!/\s[가-힣0-9]+(시|군|구)/.test(place) && !/(시|군|구)$/.test(place)) v.push(`시군구 표기 없음: ${place}`);
  const ymm = /^(\d{4})년 (\d{1,2})월$/.exec(f.month?.value ?? '');
  if (!ymm) v.push(`출생 연월 형식: ${f.month?.value}`);
  if (s.era === 'present' && ymm && ymm[1] !== '2026') v.push(`지금 세상인데 ${ymm[1]}년생`);
  if (s.era === 'past' && ymm && !(Number(ymm[1]) >= 1950 && Number(ymm[1]) <= 1989)) v.push(`지난 세상 범위 밖 ${ymm[1]}`);
  if (s.era === 'future' && ymm && !(Number(ymm[1]) >= 2030 && Number(ymm[1]) <= 2060)) v.push(`다가올 세상 범위 밖 ${ymm[1]}`);
  if (ymm && (Number(ymm[2]) < 1 || Number(ymm[2]) > 12)) v.push(`출생 월 ${ymm[2]}`);
  const looks = f.looks?.value ?? '';
  if (!/((상위|하위) 약 \d+%|(상위|하위) \d+% 안쪽|딱 중간쯤)/.test(looks)) v.push(`외모 형식: ${looks}`);
  if (/\d+\s*점/.test(looks) || /외모\s*\d+\s*점/.test(b.bodyText)) v.push('외모 원점수 노출');
  if (/소득\s*\d?\s*분위|\d\s*분위/.test(b.bodyText)) v.push('「분위」 표현 노출');
  if (/접속자|동시 접속/.test(b.bodyText)) v.push('접속자 표현');
  if (/!/.test(b.bodyText)) v.push('느낌표 존재');
  const mo = /(\d+)세/.exec(f.mother?.value ?? '');
  const fa = /(\d+)세/.exec(f.father?.value ?? '');
  if (!mo || !fa) v.push(`부모 나이 표기: ${f.mother?.value} / ${f.father?.value}`);
  else {
    const ma = Number(mo[1]);
    const fat = Number(fa[1]);
    if (ma < 15 || ma > 56) v.push(`어머니 나이 ${ma}`);
    if (fat < 15 || fat > 70) v.push(`아버지 나이 ${fat}`);
  }
  if (!/·|\s/.test(f.mother?.value ?? '')) v.push(`어머니 직업 없음: ${f.mother?.value}`);
  const housing = f.housing?.value ?? '';
  if (!/^(자가|임차\(전세, 월세\)|무상 거주)$/.test(housing)) v.push(`주거 표기: ${housing}`);
  const order = f.order?.value ?? '';
  if (!ORDER_WORDS.some((w) => order.startsWith(w))) v.push(`형제 순서: ${order}`);
  if (!new RegExp(`${order.slice(0, 2)}입니다`).test(b.sentence ?? '')) v.push(`서술문의 형제 순서와 격자 불일치: ${b.sentence} / ${order}`);
  const kg = /(\d\.\d)kg/.exec(f.weight?.value ?? '');
  if (!kg) v.push(`체중: ${f.weight?.value}`);
  else {
    const w = Number(kg[1]);
    if (w < 1.0 || w > 6.0) v.push(`체중 범위 ${w}`);
    if (!(b.sentence ?? '').includes(`${kg[1]}kg`)) v.push('서술문 체중 불일치');
  }
  if (!(b.sentence ?? '').includes('태어났습니다.')) v.push(`서술문 어체: ${b.sentence}`);
  if (!(b.sentence ?? '').includes(wealthSentenceName(wName))) {
    // 서술문의 형편 서술은 등급명을 쓰지 않을 수 있다(C4) — 확인만
  }
  if (WEALTH.some((w) => (b.sentence ?? '').includes(w))) v.push('서술문에 수저 이름 노출(C4: 이벤트·연표 본문 금지)');
  if ((b.sentence ?? '').includes(place) === false && !(b.sentence ?? '').includes(place.split(' ').slice(-1)[0])) v.push(`서술문에 장소 없음: ${b.sentence} / ${place}`);
  if (b.peers.length !== 4) v.push(`또래 ${b.peers.length}명`);
  const names = new Set(b.peers.map((p) => p.name));
  if (names.size !== b.peers.length) v.push('또래 이름 중복');
  if (names.has(b.name)) v.push('또래 이름이 주인공과 같음');
  for (const p of b.peers) if (!p.place || !p.gender) v.push(`또래 필드 누락 ${p.name}`);
  if (s.era === 'present') {
    if (!b.compareShown) v.push('지금 세상인데 비교 표 없음');
    if (b.compareRows.length < 3) v.push(`비교 표 행 ${b.compareRows.length}개 (<3)`);
    if (!b.lifeGap) v.push('기대수명 한 줄 없음');
  } else {
    if (b.compareShown) v.push('지난·다가올 세상인데 비교 표가 보임');
    if (b.lifeGap) v.push('지난·다가올 세상인데 기대수명 서술이 보임');
  }
  const wsum = r.wealthOdds.reduce((a, o) => a + o.pct, 0);
  const rsum = Math.round(r.regionOdds.reduce((a, o) => a + Math.round(o.pct * 10), 0));
  if (Math.round(wsum) !== 100) v.push(`수저 확률 합 ${wsum}`);
  if (rsum !== 1000) v.push(`지역 확률 합 ${rsum / 10}`);
  return v;
}

function wealthSentenceName() {
  return '';
}

async function one(browser, seed) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 150)));
  try {
    await openTitle(p);
    await toRoulette(p, era);
    // 건너뛰기 직전의 회전 상태 값(확률표)과 결과 모두 읽는다
    const spinning = await readRoulette(p);
    await skipToBirth(p);
    const sv = await saveJson(p);
    // 룰렛 결과 상태는 출생신고로 넘어가기 전에 읽어야 하므로 별도: 되돌아가지 않고 save로 대조
    const birth = await readBirth(p);
    const d = sv?.data;
    return { seed, era, spinning: { odds: spinning.wealthOdds, regionN: spinning.regionOdds.length }, birth, save: { parentWealth: d?.character?.parentWealth, region: d?.birthReport?.region, sigungu: d?.birthReport?.sigungu, sigunguSido: d?.birthReport?.sigunguSido, order: d?.birthReport?.birthOrder, housing: d?.birthReport?.housing, mother: d?.birthReport?.mother, father: d?.birthReport?.father, weight: d?.birthReport?.birthWeightKg, month: d?.birthReport?.month, birthYear: d?.character?.birthYear, gender: d?.character?.gender, looks: d?.character?.looks }, errs };
  } finally {
    await ctx.close();
  }
}

// 룰렛 결과 문구 대조를 위해 건너뛰기 직후(출생신고 보기를 누르기 전)에 결과 상태를 읽는 변형
async function oneFull(browser, seed) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 150)));
  try {
    await openTitle(p);
    await toRoulette(p, era);
    const spinning = await readRoulette(p);
    await sleep(450);
    await p.getByTestId('skip-roulette').click();
    await p.waitForSelector('[data-testid="to-birth"]', { timeout: 4000 });
    const roulette = await readRoulette(p);
    await p.waitForFunction(() => document.querySelector('[data-testid="to-birth"]')?.getAttribute('aria-disabled') !== 'true', null, { timeout: 4000 });
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 4000 });
    const birth = await readBirth(p);
    const sv = await saveJson(p);
    const d = sv?.data;
    const rec = { seed, era, roulette, regionN: spinning.regionOdds.length, birth, save: { parentWealth: d?.character?.parentWealth, region: d?.birthReport?.region, sigungu: d?.birthReport?.sigungu, order: d?.birthReport?.birthOrder, housing: d?.birthReport?.housing, mother: d?.birthReport?.mother, father: d?.birthReport?.father, weight: d?.birthReport?.birthWeightKg, month: d?.birthReport?.month, birthYear: d?.character?.birthYear, gender: d?.character?.gender }, errs };
    rec.r = { status: roulette.status, wealthResult: roulette.wealthResult, regionResult: roulette.regionResult, wealthOdds: roulette.wealthOdds, regionOdds: roulette.regionOdds };
    rec.roulette = rec.r;
    rec.violations = check(rec);
    return rec;
  } catch (e) {
    return { seed, era, error: String(e).slice(0, 300), violations: [`스크립트 오류 ${String(e).slice(0, 120)}`] };
  } finally {
    await ctx.close();
  }
}

const browser = await launch();
const seeds = Array.from({ length: count }, (_, i) => startSeed + i);
let idx = 0;
let done = 0;
const t0 = Date.now();
fs.mkdirSync(OUT, { recursive: true });
await Promise.all(
  Array.from({ length: workers }, async () => {
    for (;;) {
      const i = idx++;
      if (i >= seeds.length) return;
      const rec = await oneFull(browser, seeds[i]);
      const slim = { ...rec, birth: { ...rec.birth, bodyText: undefined } };
      fs.appendFileSync(outFile, JSON.stringify(slim) + '\n');
      done++;
      if (rec.violations?.length) console.log(`seed ${rec.seed} ${era}: ${rec.violations.join(' | ').slice(0, 400)}`);
      if (done % 25 === 0) console.log(`... ${done}/${seeds.length} ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }),
);
await browser.close();
console.log(`완료 ${done}판 ${Math.round((Date.now() - t0) / 1000)}s → ${outFile}`);
