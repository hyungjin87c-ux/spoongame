// QA-003 M7e 감사용·엔딩용 저장 만들기 (vite-node로 실행: ./node_modules/.bin/vite-node qa/scripts/m7e-saves.mjs)
//  - ending-<시대>-t<재력>              : 코어로 한 판을 끝까지 돌린 엔딩 저장(자연 결말)
//  - ending-<시대>-t<재력>-<변형>        : 같은 판의 최종 순자산(assets.net)만 바꿔 엔딩의 도착 자리를 정한 변형
//        up(앞섬) same(비슷함) down(뒤쪽) zero(정확히 0원) top(상위 1% 안쪽) bottom(하위 1% 안쪽)
//        e-up2(구간 위 끝 + 여유 2 = 비슷함의 경계) e-up3(+3 = 앞섬의 첫 값) e-dn2 e-dn3(아래쪽 경계)
//  - ending-before20-<시대>-a<나이>      : 20세 미만에 끝난 엔딩(출발선 띠만)
//  - ending-name-<종류>                  : 이름을 바꾼(저장 변조) 엔딩 — 최대 20자, 마크업·이모지·자모 분리
//  - life-<시대>-s<시드>-a<나이>         : 일시정지한 대시보드(인생 기록이 긴 판, 나이별 또래 칸)
// 코어는 저장을 만드는 데만 쓰고, 보이는 모습은 실제 화면(prod)에서 잰다. 변형의 net을 고르는 데 쓴 구간·자리 함수는 「이 net이 어느 칸에 닿는가」를 찾는 용도일 뿐 판정은 화면 글자·그림에서 한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear, resolveChoiceStep } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';
import { createInitialState, beginBirth, enterBirth, enterLife } from '../../src/core/state';
import { finalWealthStanding, startBandOf, movementOf, standingScore, BAND_GRACE } from '../../src/core/ending';

const OUT = process.env.QA_OUT ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', process.env.QA_OUT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7e');
fs.mkdirSync(OUT, { recursive: true });
const SAVES = path.join(OUT, 'saves');
fs.mkdirSync(SAVES, { recursive: true });
const seeds = JSON.parse(fs.readFileSync(path.join(OUT, 'seeds.json'), 'utf8'));
const write = (name, data) => {
  const raw = JSON.stringify({ version: 8, data });
  if (!parseGame(raw, EVENT_POOL)) {
    console.log('검증 실패', name);
    return false;
  }
  fs.writeFileSync(path.join(SAVES, `${name}.json`), raw);
  return true;
};
const manifest = {};

function simulate(era, seed, tierWanted, { stopAt = null } = {}) {
  let s = enterLife(enterBirth(beginBirth(createInitialState(seed), era)));
  if (tierWanted && s.character.parentWealth !== tierWanted) return null;
  let guard = 0;
  while (s.phase === 'life' && guard++ < 600) {
    if (stopAt !== null && s.age >= stopAt && s.pending === null) return s;
    if (s.pending) {
      const p = s.pending;
      s = resolveChoiceStep(s, p.key, p.choiceIds[guard % p.choiceIds.length]).state;
    } else s = stepYear(s).state;
  }
  return s.phase === 'ending' ? s : null;
}

const ERAS = ['past', 'present', 'future'];
const TIERS = [1, 2, 3, 4, 5];

// ---- 자연 엔딩 + net 변형 ----
const withNet = (base, net) => {
  const d = structuredClone(base);
  d.assets.net = net;
  d.assets.debt = Math.max(d.assets.debt, Math.max(0, -net));
  return d;
};
for (const era of ERAS) {
  for (const tier of TIERS) {
    const cand = seeds.filter((r) => r.era === era && r.tier === tier).slice(0, 12);
    let base = null;
    let baseSeed = null;
    for (const c of cand) {
      const s = simulate(era, c.seed, tier);
      if (s && s.age >= 60) {
        base = s;
        baseSeed = c.seed;
        break;
      }
    }
    if (!base) {
      console.log('엔딩 실패', era, tier);
      continue;
    }
    write(`ending-${era}-t${tier}`, base);
    manifest[`ending-${era}-t${tier}`] = { era, tier, seed: baseSeed, variant: 'natural', age: base.age, net: base.assets.net };
    const band = startBandOf(era, tier);
    // 후보 net 훑기: 점수(standingScore)와 방향(movementOf)을 net 값마다 계산해 원하는 칸의 첫 값을 고른다
    const nets = [];
    for (let n = -200000; n <= 1500000; n += n < -6000 ? 2000 : n < 2000 ? 100 : n < 20000 ? 250 : 2000) nets.push(n);
    const info = nets.map((net) => {
      const st = finalWealthStanding(era, net);
      return { net, st, score: standingScore(st), mv: movementOf(band, st) };
    });
    const pick = (pred) => info.find(pred);
    const variants = {
      up: pick((x) => x.mv === 'up' && x.st.kind !== 'middle'),
      same: pick((x) => x.mv === 'same' && x.score >= band.low && x.score <= band.high && x.net > 0),
      down: pick((x) => x.mv === 'down'),
      zero: { net: 0, st: finalWealthStanding(era, 0), score: standingScore(finalWealthStanding(era, 0)), mv: movementOf(band, finalWealthStanding(era, 0)) },
      top: info.find((x) => x.st.kind === 'top' && x.st.within),
      bottom: [...info].reverse().find((x) => x.st.kind === 'bottom' && x.st.within),
      // 경계(여유 2): 구간 위 끝 + 2 = 비슷함, +3 = 앞섬 / 구간 아래 끝 − 2 = 비슷함, −3 = 뒤쪽
      'e-up2': pick((x) => x.score === band.high + BAND_GRACE),
      'e-up3': pick((x) => x.score === band.high + BAND_GRACE + 1),
      'e-dn2': pick((x) => x.score === band.low - BAND_GRACE),
      'e-dn3': pick((x) => x.score === band.low - BAND_GRACE - 1),
    };
    for (const [v, x] of Object.entries(variants)) {
      if (!x) {
        manifest[`ending-${era}-t${tier}-${v}`] = { era, tier, variant: v, missing: true };
        continue;
      }
      const d = withNet(base, x.net);
      if (write(`ending-${era}-t${tier}-${v}`, d)) manifest[`ending-${era}-t${tier}-${v}`] = { era, tier, seed: baseSeed, variant: v, net: x.net, score: x.score, mv: x.mv, band: [band.low, band.high] };
    }
  }
}

// ---- 20세 미만 엔딩: 건강을 낮춘 17세 저장에서 사망하는 난수 상태를 찾는다 ----
for (const era of ERAS) {
  for (const [tier, age] of [[3, 17], [1, 12], [5, 18]]) {
    const cand = seeds.filter((r) => r.era === era && r.tier === tier)[0];
    const base = simulate(era, cand.seed, tier, { stopAt: age });
    if (!base || base.phase !== 'life') {
      console.log('20세 미만 시작 실패', era, tier, age);
      continue;
    }
    let done = false;
    for (let k = 1; k <= 60000 && !done; k++) {
      const d = structuredClone(base);
      d.stats.health = 1;
      d.rngState = Math.imul(k, 2654435761) >>> 0;
      d.paused = false;
      const raw = JSON.stringify({ version: 8, data: d });
      const g = parseGame(raw, EVENT_POOL);
      if (!g) break;
      let r = stepYear(g, EVENT_POOL);
      if (r.state.pending) r = { ...r, state: resolveChoiceStep(r.state, r.state.pending.key, r.state.pending.choiceIds[0]).state };
      if (r.state.phase === 'ending' && r.state.age < 20) {
        const name = `ending-before20-${era}-t${tier}-a${r.state.age}`;
        if (write(name, r.state)) {
          manifest[name] = { era, tier, variant: 'before20', age: r.state.age };
          console.log(name);
          done = true;
        }
      }
    }
    if (!done) console.log('20세 미만 사망 상태 못 찾음', era, tier, age);
  }
}

// ---- 이름 변조 엔딩 (최대 20자·마크업·이모지·자모 분리) ----
const NAMES = {
  max20: '가나다라마바사아자차카타파하가나다라마바',
  markup: '<script>alert(1)</s>',
  sql: "'\";-- DROP",
  emoji: '😀😀😀😀😀😀😀😀😀😀',
  jamo: 'ㄱㅏㄴㅏㄷㅏㄹㅏㅁㅏㅂㅏ',
  latin20: 'WWWWWWWWWWWWWWWWWWWW',
  nospace: 'ABCDEFGHIJKLMNOPQRST',
};
{
  const base = JSON.parse(fs.readFileSync(path.join(SAVES, 'ending-present-t1.json'), 'utf8')).data;
  for (const [k, nm] of Object.entries(NAMES)) {
    const d = structuredClone(base);
    d.character.name = nm;
    if (write(`ending-name-${k}`, d)) manifest[`ending-name-${k}`] = { variant: 'name', name: nm };
  }
  const baseE = JSON.parse(fs.readFileSync(path.join(SAVES, 'ending-present-t1-zero.json'), 'utf8')).data;
  const d = structuredClone(baseE);
  d.character.name = NAMES.max20;
  if (write('ending-name-max20-zero', d)) manifest['ending-name-max20-zero'] = { variant: 'name+zero', name: NAMES.max20 };
}

// ---- 일시정지한 인생 (나이별 또래 칸·긴 기록) ----
for (const era of ERAS) {
  for (const tier of [1, 3, 5]) {
    const cand = seeds.filter((r) => r.era === era && r.tier === tier).slice(0, 6);
    for (const c of cand.slice(0, 1)) {
      for (const a of [12, 16, 19, 20, 35, 50, 62, 70, 80]) {
        const s = simulate(era, c.seed, tier, { stopAt: a });
        if (!s || s.phase !== 'life') continue;
        const d = structuredClone(s);
        d.paused = true;
        if (write(`life-${era}-t${tier}-a${a}`, d)) manifest[`life-${era}-t${tier}-a${a}`] = { era, tier, seed: c.seed, age: s.age, rows: s.history.length };
      }
    }
  }
}

fs.writeFileSync(path.join(OUT, 'saves-manifest.json'), JSON.stringify(manifest, null, 1));
console.log('저장 파일', fs.readdirSync(SAVES).length, '개, 변형 누락', Object.values(manifest).filter((m) => m.missing).length);
