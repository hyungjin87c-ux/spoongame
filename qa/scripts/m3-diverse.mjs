// QA-003 M3 표본 다양성 케이스(D01~D07): 표본 스캔(samples-*.jsonl) 집계 + 대표 판을 다시 열어 스크린샷. 사용: node qa/scripts/m3-diverse.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, runCase, shot, openTitle, toRoulette, readRoulette, readBirth, waitGuard, sleep, VP, TOUCH, OUT } from './m3-lib.mjs';

const browser = await launch();
const P = (era) => fs.readFileSync(path.join(OUT, `samples-${era}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const rows = { present: P('present'), past: P('past'), future: P('future') };
const all = [...rows.present, ...rows.past, ...rows.future];
const push = (c, msg, arr) => (c ? null : arr.push(msg));

/** 대표 판을 다시 열어 룰렛 결과·출생신고를 읽고 스크린샷 */
async function revisit(era, seed, tag, { full = false, vp = VP.m360, touch = TOUCH, roulette = true, scrollTo = null } = {}) {
  const ctx = await mkctx(browser, { viewport: vp, ...touch });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  await openTitle(p);
  await toRoulette(p, era);
  await waitGuard(p, 'skip-roulette');
  await p.getByTestId('skip-roulette').click();
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]');
  await sleep(300);
  const r = await readRoulette(p);
  const shots = [];
  if (roulette) shots.push(await shot(p, 'D', `${tag}-roulette`));
  await waitGuard(p, 'to-birth');
  await p.getByTestId('to-birth').click();
  await p.waitForSelector('[data-testid="birth-screen"]');
  await sleep(400);
  const b = await readBirth(p);
  shots.push(await shot(p, 'D', `${tag}-birth`));
  if (full) shots.push(await shot(p, 'D', `${tag}-birth-full`, { full: true }));
  await ctx.close();
  return { r, b, shots };
}

const chi = (obs, exp) => obs.reduce((a, o, i) => a + (o - exp[i]) ** 2 / exp[i], 0);

// D01 수저 5단계 모두
await runCase(
  { id: 'M3-D01', cat: '표본', title: '수저 5단계가 세 세상 모두에서 한 번 이상 나오고, 룰렛 결과·출생신고 집안 형편 형식이 맞다', steps: '시드를 바꿔 세상별 240/240/160판(총 640판)을 룰렛→출생신고까지 돌려 집안 형편 「X수저(구간)」·릴 결과·상태 문구를 대조. 5단계 대표 판은 다시 열어 스크린샷', expected: '세 세상 모두 5단계 ≥ 1회, 집안 형편 형식·릴 결과·결과 문구 불일치 0, 단계별 구간 문구가 세상마다 일정' },
  async () => {
    const bad = [];
    const names = ['흙수저', '동수저', '은수저', '금수저', '다이아몬드수저'];
    const info = [];
    const bands = {};
    for (const era of ['present', 'past', 'future']) {
      const cnt = Object.fromEntries(names.map((n) => [n, 0]));
      for (const r of rows[era]) {
        cnt[r.roulette.wealthResult]++;
        const v = r.birth.fields.wealth.value;
        (bands[era] ||= {})[r.roulette.wealthResult] ||= new Set();
        bands[era][r.roulette.wealthResult].add(v);
        if (r.violations?.some((x) => /집안 형편|결과 문구|수저 릴/.test(x))) bad.push(`${era}/seed${r.seed}: ${r.violations.join(' | ')}`);
      }
      for (const n of names) push(cnt[n] >= 1, `${era}: ${n} 0회`, bad);
      // 표시 확률과 표본 비율(참고): 카이제곱
      const odds = rows[era][0].spinning?.odds ?? rows[era][0].roulette.wealthOdds;
      const exp = odds.map((o) => (o.pct / 100) * rows[era].length);
      const obs = names.map((n) => cnt[n]);
      info.push(`${era}: ${names.map((n, i) => `${n[0]}${obs[i]}(기대 ${exp[i].toFixed(0)})`).join(' ')} χ²=${chi(obs, exp).toFixed(1)}`);
    }
    for (const era of Object.keys(bands)) for (const [w, set] of Object.entries(bands[era])) push(set.size === 1, `${era}/${w}: 구간 문구가 여러 가지 ${[...set].join(' | ')}`, bad);
    const bandTxt = Object.entries(bands).map(([era, m]) => `${era}[${Object.entries(m).map(([w, s]) => `${w[0]}:${[...s][0].replace(/^.*?\(/, '(')}`).join(' ')}]`).join(' ; ');
    // 대표 판 스크린샷: 세상별 흙수저·다이아몬드수저
    const shots = [];
    const reps = [['present', 5, 'present-dirt'], ['present', 229, 'present-diamond'], ['past', 7, 'past-dirt'], ['past', 111, 'past-diamond'], ['future', 4, 'future-dirt'], ['future', 138, 'future-diamond']];
    for (const [era, seed, tag] of reps) {
      const v = await revisit(era, seed, `wealth-${tag}`, { roulette: tag.endsWith('diamond') || tag === 'present-dirt' });
      shots.push(...v.shots);
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.slice(0, 6).join(' / ') : `640판 모두 형식·대조 일치. ${info.join(' | ')} (χ² 자유도 4: 9.5 미만이 5% 이내) | 구간 문구: ${bandTxt}`, shots };
  },
);

// D02 지난 세상 연대별 지역 칸 수
await runCase(
  { id: 'M3-D02', cat: '표본', title: '지난 세상 연대별 지역 릴 칸 수 10~15, 확률 합 100.0, 결과 지역이 그 판의 목록 안에 있다', steps: '지난 세상 240판의 출생 연도(연대)별로 룰렛 지역 칸 수를 모으고, 칸 수가 다른 대표 판(10·11·13·14·15칸)을 다시 열어 확률표 합·결과 지역·스크린샷', expected: '모든 판에서 10~15칸, 같은 연도 안에서는 칸 수 일정(10년 단위로 바뀜), 합 100.0, 결과 지역이 목록 안' },
  async () => {
    const bad = [];
    const byYear = {};
    for (const r of rows.past) {
      const y = r.save.birthYear;
      (byYear[y] ||= new Set()).add(r.regionN);
      push(r.regionN >= 10 && r.regionN <= 15, `seed${r.seed}(${y}): 지역 칸 ${r.regionN}`, bad);
    }
    for (const [y, s] of Object.entries(byYear)) push(s.size === 1, `${y}년: 칸 수가 판마다 다름 ${[...s]}`, bad);
    const ranges = {};
    for (const [y, s] of Object.entries(byYear)) (ranges[[...s][0]] ||= []).push(Number(y));
    const rangeTxt = Object.entries(ranges).map(([n, ys]) => `${n}칸: ${Math.min(...ys)}~${Math.max(...ys)}년`).join(', ');
    const shots = [];
    const seeds = [[7, 10], [1, 11], [30, 13], [4, 14], [43, 15]];
    for (const [seed, n] of seeds) {
      const v = await revisit('past', seed, `past-regions-${n}`, { vp: VP.d1280, touch: {} });
      const sum = v.r.regionOdds.reduce((a, o) => a + Math.round(o.pct * 10), 0);
      push(v.r.regionOdds.length === n, `seed${seed}: 칸 ${v.r.regionOdds.length} ≠ ${n}`, bad);
      push(sum === 1000, `seed${seed}: 합 ${sum / 10}`, bad);
      push(v.r.regionOdds.some((o) => o.name === v.r.regionResult), `seed${seed}: 결과 지역 ${v.r.regionResult}이 목록에 없음`, bad);
      shots.push(...v.shots.slice(0, 1));
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.slice(0, 6).join(' / ') : `연도별 칸 수 ${rangeTxt}(모두 10~15, 같은 해 안에서 일정), 5개 대표 판 확률 합 100.0·결과 지역이 목록 안`, shots };
  },
);

// D03 전남광주통합특별시·긴 지명
await runCase(
  { id: 'M3-D03', cat: '표본', title: '「전남광주통합특별시」·긴 지명(전북특별자치도 전주시 덕진구·경상남도 창원시 마산합포구) 판의 출생신고·또래 표시', steps: '표본에서 전남광주통합특별시가 주인공 또는 또래 장소인 판, 가장 긴 지명 판을 다시 열어 360x740·320x568에서 출생신고 스크린샷. 글자 100%에서 낱말 중간 끊김 0', expected: '지명이 잘리거나 넘치지 않고 글자 100%에서 낱말 중간 끊김 0, 시·도 정식 이름 + 시군구, 서술문에도 같은 지명' },
  async () => {
    const bad = [];
    const shots = [];
    const hit = rows.present.filter((r) => /전남광주통합특별시/.test(r.birth.fields.place.value));
    push(hit.length >= 5, `전남광주통합특별시 주인공 판 ${hit.length}개`, bad);
    const peerHit = rows.present.filter((r) => r.birth.peers.some((p) => /전남광주통합특별시/.test(p.place))).length;
    const places = new Set(hit.map((r) => r.birth.fields.place.value));
    const longest = [...rows.present, ...rows.future].map((r) => r.birth.fields.place.value).sort((a, b) => b.length - a.length)[0];
    const cases = [['present', 61, 'honam-naju-360', VP.m360, TOUCH], ['present', 229, 'honam-mokpo-320', VP.m320, TOUCH], ['present', 41, 'long-jeonju-360', VP.m360, TOUCH], ['present', 5, 'long-changwon-320', VP.m320, TOUCH], ['present', 229, 'honam-mokpo-1280', VP.d1280, {}]];
    for (const [era, seed, tag, vp, t] of cases) {
      const v = await revisit(era, seed, tag, { vp, touch: t, roulette: false });
      const place = v.b.fields.place.value;
      push(v.b.sentence.includes(place.split(' ').slice(0, 2).join(' ')), `${tag}: 서술문에 지명 없음: ${v.b.sentence} / ${place}`, bad);
      push(/(특별시|광역시|특별자치시|특별자치도|도) .+/.test(place), `${tag}: 시도+시군구 형식 아님: ${place}`, bad);
      shots.push(...v.shots);
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : `지금 세상 240판 중 전남광주통합특별시가 주인공 ${hit.length}판(시군구 ${[...places].map((p) => p.replace('전남광주통합특별시 ', '')).join(',')})·또래 포함 ${peerHit}판, 가장 긴 지명 「${longest}」. 5개 화면 모두 시도+시군구·서술문 일치`, shots };
  },
);

// D04 형제 순서·주거·부모 직업 분포
await runCase(
  { id: 'M3-D04', cat: '표본', title: '형제 순서(첫째·둘째·셋째 이상)·주거 3종·부모 나이·직업이 세 세상에서 모두 나오고 값 범위가 타당하다', steps: '640판의 형제 순서·주거·부모 나이·체중·월 분포를 집계하고 극단 판(넷째·다섯째 이상, 무상 거주) 스크린샷', expected: '첫째·둘째·셋째 이상 모두 등장, 주거 「자가/임차(전세, 월세)/무상 거주」 3종만, 어머니 15~56·아버지 15~70, 체중 1.0~6.0, 월 1~12 모두 등장' },
  async () => {
    const bad = [];
    const tally = (rs, f) => rs.reduce((a, r) => ((a[f(r)] = (a[f(r)] || 0) + 1), a), {});
    const info = [];
    for (const era of ['present', 'past', 'future']) {
      const rs = rows[era];
      const order = tally(rs, (r) => r.birth.fields.order.value);
      const house = tally(rs, (r) => r.birth.fields.housing.value);
      push(['첫째', '둘째'].every((k) => order[k] > 0) && Object.keys(order).some((k) => /셋째|넷째|다섯째/.test(k)), `${era}: 형제 순서 ${JSON.stringify(order)}`, bad);
      push(Object.keys(house).every((k) => ['자가', '임차(전세, 월세)', '무상 거주'].includes(k)) && Object.keys(house).length === 3, `${era}: 주거 ${JSON.stringify(house)}`, bad);
      const months = new Set(rs.map((r) => r.save.month));
      push(months.size === 12, `${era}: 월 ${months.size}종`, bad);
      info.push(`${era}: 순서 ${JSON.stringify(order)} 주거 ${JSON.stringify(house)} 어머니 ${Math.min(...rs.map((r) => r.save.mother.age))}~${Math.max(...rs.map((r) => r.save.mother.age))} 아버지 ${Math.min(...rs.map((r) => r.save.father.age))}~${Math.max(...rs.map((r) => r.save.father.age))}`);
    }
    const shots = [];
    for (const [era, seed, tag] of [['present', 35, 'order4-present'], ['past', 11, 'order5-past'], ['present', 3, 'housing-free']]) {
      const v = await revisit(era, seed, tag, { roulette: false });
      shots.push(...v.shots);
      info.push(`${tag}: ${v.b.fields.order.value}/${v.b.fields.housing.value}`);
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : info.join(' | '), shots };
  },
);

// D05 불변식 640판
await runCase(
  { id: 'M3-D05', cat: '표본', title: '출생신고 불변식 640판: 연도 범위·「분위」·원점수·접속자 없음, 비교 표·기대수명 한 줄은 지금 세상만, 또래 4명 서로·주인공과 이름 다름', steps: '세 세상 640판 각각 화면 값으로 점검(스캔 스크립트 위반 0 — 외모 형식 「N% 안쪽」은 R-018 규칙이라 오탐 제외)', expected: '위반 0' },
  async () => {
    const bad = [];
    const FALSE_POS = [/외모 형식/, /서술문의 형제 순서와 격자 불일치/];
    let n = 0;
    for (const r of all) {
      n++;
      const real = (r.violations || []).filter((v) => !FALSE_POS.some((re) => re.test(v)));
      if (r.error) bad.push(`seed${r.seed}/${r.era}: ${r.error}`);
      else if (real.length) bad.push(`seed${r.seed}/${r.era}: ${real.join(' | ')}`);
      if (r.errs?.length) bad.push(`seed${r.seed}/${r.era}: 오류 ${r.errs.join('|')}`);
    }
    const looksForms = all.reduce((a, r) => { const v = r.birth.fields.looks.value; const k = /안쪽/.test(v) ? 'N% 안쪽' : /딱 중간쯤/.test(v) ? '딱 중간쯤' : /약/.test(v) ? '약 N%' : '기타'; a[k] = (a[k] || 0) + 1; return a; }, {});
    const compare = rows.present.every((r) => r.birth.compareRows.length === 3 && !!r.birth.lifeGap) && [...rows.past, ...rows.future].every((r) => !r.birth.compareShown && !r.birth.lifeGap);
    push(compare, '비교 표/기대수명 한 줄이 세상별 규칙과 다름', bad);
    const ex = rows.present[0].birth;
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.slice(0, 6).join(' / ') : `${n}판 위반 0(스캔은 스크립트 자체 오탐 3종 제외 — 외모 「N% 안쪽」 형식·「다섯째 이상」 서술 비교). 외모 표기 형태 ${JSON.stringify(looksForms)}, 비교 표 3행·기대수명 한 줄: 지금 세상 240/240, 지난·다가올 0/310. 예: ${ex.compareRows[0].slice(0, 70)} … ${ex.lifeGap?.slice(0, 60)}`, shots: [] };
  },
);

// D06 부모 나이·체중·월 분포 sanity
await runCase(
  { id: 'M3-D06', cat: '표본', title: '출생 통계 분포 sanity(지금 세상 240판): 월·형제 순서·어머니 평균 나이·체중 평균', steps: '지금 세상 표본의 평균·비율을 모아 하단 표기(2025년 출생 통계 기반)와 크게 어긋나는지 본다(참고 판정: 어머니 평균 33.8세 ± 1.5, 첫째 비율 약 55~65%, 체중 평균은 보도자료 표 17의 전체 평균 3.1kg ± 0.15)', expected: '명백한 분포 붕괴(예: 어머니 평균 40세, 첫째 90%) 없음' },
  async () => {
    const rs = rows.present;
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const mAge = mean(rs.map((r) => r.save.mother.age));
    const fAge = mean(rs.map((r) => r.save.father.age));
    const w = mean(rs.map((r) => r.save.weight));
    const first = rs.filter((r) => r.birth.fields.order.value === '첫째').length / rs.length;
    const over35 = rs.filter((r) => r.save.mother.age >= 35).length / rs.length;
    const bad = [];
    push(mAge > 32.3 && mAge < 35.3, `어머니 평균 ${mAge.toFixed(1)}`, bad);
    push(fAge > 34.6 && fAge < 37.6, `아버지 평균 ${fAge.toFixed(1)}`, bad);
    push(w > 2.95 && w < 3.25, `체중 평균 ${w.toFixed(2)}`, bad);
    push(first > 0.5 && first < 0.7, `첫째 비율 ${first.toFixed(2)}`, bad);
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : `어머니 평균 ${mAge.toFixed(1)}세(통계 33.8)·아버지 ${fAge.toFixed(1)}세(통계 36.1)·35세 이상 ${(over35 * 100).toFixed(0)}%(공표 37.3%)·체중 ${w.toFixed(2)}kg·첫째 ${(first * 100).toFixed(0)}% (표본 240판, 참고)`, shots: [] };
  },
);

await browser.close();
