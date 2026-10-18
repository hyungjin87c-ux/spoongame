// QA-003 M7e 엔딩 판정 공용: 엔딩 화면을 읽는 함수(READ)와 글자에서 푼 기대값으로 판정하는 함수(judge)
// ---------- 글자에서 푼 기대값 (코드의 구간·점수 함수를 쓰지 않는다) ----------
export function parseBand(t) {
  let m;
  if ((m = /^하위 (\d+)% 안쪽$/.exec(t))) return [0, +m[1]];
  if ((m = /^상위 (\d+)% 안쪽$/.exec(t))) return [100 - +m[1], 100];
  if ((m = /^상위 (\d+)% 밖$/.exec(t))) return [0, 100 - +m[1]];
  if ((m = /^하위 (\d+)% 밖$/.exec(t))) return [+m[1], 100];
  if ((m = /^하위 (\d+)~(\d+)% 사이$/.exec(t))) return [+m[1], +m[2]];
  if ((m = /^하위 약 (\d+)%$/.exec(t))) return [+m[1], +m[1]];
  if ((m = /^상위 (\d+)~(\d+)% 사이$/.exec(t))) return [100 - +m[2], 100 - +m[1]];
  if ((m = /^상위 약 (\d+)%$/.exec(t))) return [100 - +m[1], 100 - +m[1]];
  if ((m = /^하위 (\d+)% 선과 상위 (\d+)% 선 사이$/.exec(t))) return [+m[1], 100 - +m[2]];
  if (t === '모두가 같은 자리') return [0, 100];
  return null;
}
export function parseEnd(t) {
  let m;
  if (t === '가운데쯤') return 50;
  if ((m = /^상위 약 (\d+)%$/.exec(t))) return 100 - +m[1];
  if ((m = /^하위 약 (\d+)%$/.exec(t))) return +m[1];
  if ((m = /^상위 (\d+)% 안쪽$/.exec(t))) return 100 - +m[1];
  if ((m = /^하위 (\d+)% 안쪽$/.exec(t))) return +m[1];
  return null;
}
// 방향: 문서(copy.md 5-2, ending.ts 머리말)의 규칙 — 구간 밖으로 여유 2점을 넘으면 앞섬·뒤쪽, 그 쪽에 천장·바닥(99·1)까지 여유 이내만 남으면 여유 0
export function expectMovement(band, e) {
  const [lo, hi] = band;
  const upG = hi + 2 >= 99 ? 0 : 2;
  const dnG = lo - 2 <= 1 ? 0 : 2;
  if (e > hi + upG) return 'up';
  if (e < lo - dnG) return 'down';
  return 'same';
}
export const MV_TEXT = { up: '출발선보다 앞선 자리입니다.', same: '출발선과 비슷한 자리입니다.', down: '출발선보다 뒤쪽 자리입니다.' };
export const ERA_LABEL = { past: '지난 세상', present: '지금 세상', future: '다가올 세상' };

export const READ = () => {
  const q = (s) => document.querySelector(s);
  const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
  const R = (e) => {
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height };
  };
  const bar = q('[data-testid="ending-bar"]');
  const track = bar ? bar.querySelector('.journey__track') : null;
  const cs = (e) => (e ? getComputedStyle(e) : null);
  const barAxis = bar ? [...bar.querySelectorAll('.journey__axis span')].map((s) => s.textContent.trim()) : null;
  const axisHidden = bar ? bar.querySelector('.journey__axis')?.getAttribute('aria-hidden') : null;
  const legendRows = [...document.querySelectorAll('[data-testid="ending-legend"] > div')].map((d) => ({ dt: d.querySelector('dt')?.textContent.trim(), dd: d.querySelector('dd')?.textContent.replace(/\s+/g, ' ').trim() }));
  const timeline = [...document.querySelectorAll('[data-testid="timeline-entry"]')].map((e) => ({ kind: e.getAttribute('data-kind'), text: e.textContent.replace(/\s+/g, ' ').trim(), age: e.querySelector('.log__age')?.textContent.trim() }));
  const chip = q('[data-testid="ending-legend"] .grade');
  return {
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    era: tx('[data-testid="ending-era"]'),
    name: tx('[data-testid="ending-name"]'),
    span: tx('[data-testid="ending-span"]'),
    death: tx('[data-testid="ending-death"]'),
    choices: tx('[data-testid="ending-choices"]'),
    bar: bar
      ? {
          role: bar.getAttribute('role'),
          label: bar.getAttribute('aria-label'),
          track: R(track),
          trackClient: track ? track.clientWidth : null,
          band: R(bar.querySelector('.journey__band')),
          mid: R(bar.querySelector('.journey__mid')),
          end: R(bar.querySelector('.journey__end')),
          axis: barAxis,
          axisHidden,
          bandStyle: bar.querySelector('.journey__band')?.getAttribute('style'),
          endStyle: bar.querySelector('.journey__end')?.getAttribute('style'),
        }
      : null,
    legend: legendRows,
    legendChip: chip ? { grade: chip.getAttribute('data-grade'), text: chip.textContent.replace(/\s+/g, ' ').trim() } : null,
    gradeRange: tx('[data-testid="grade-range"]'),
    journey: tx('[data-testid="ending-journey"]'),
    movement: tx('[data-testid="ending-movement"]'),
    note: tx('[data-testid="ending-note"]'),
    finalNet: tx('[data-testid="final-net"]'),
    finalNetValue: tx('[data-testid="final-net-value"]'),
    finalNetBasis: tx('[data-testid="final-net-basis"]'),
    finalNetNone: tx('[data-testid="final-net-none"]'),
    finalLooks: tx('[data-testid="final-looks"]'),
    gradeChips: document.querySelectorAll('.ending .grade').length,
    timeline,
    bodyBad: /NaN|undefined|Infinity|\[object/.test(document.body.innerText),
    forced: window.matchMedia('(forced-colors: active)').matches,
  };
};

export const splitSent = (t) => t.replace(/\([^)]*\)/g, '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
export const isHap = (s) => /(?:니다)[.]$/.test(s);
const hasFinal = (w) => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
};

export function judge(name, meta, d) {
  const f = [];
  const notes = [];
  const early = /^ending-(before20|infant-death)/.test(name);
  const m = meta[name] ?? {};
  // 머리
  const era = m.era ?? (/-(past|present|future)-/.exec(name) || [])[1] ?? 'present';
  if (d.era !== `${ERA_LABEL[era]} · 생애 기록`) f.push(`머리 라벨 「${d.era}」`);
  const sp = /^(\d{4})년 (\d{1,2})월 ~ (\d{4})년 · (\d+)세$/.exec(d.span ?? '');
  if (!sp) f.push(`머리 셋째 줄 「${d.span}」`);
  const dm = /^(\d+)세에 세상을 떠났습니다\. 원인은 (.+)(이었습니다|였습니다)\.$/.exec(d.death ?? '');
  if (!dm) f.push(`사망 줄 「${d.death}」`);
  if (dm) {
    const cause = dm[2];
    if ((hasFinal(cause) && dm[3] !== '이었습니다') || (!hasFinal(cause) && dm[3] !== '였습니다')) f.push(`원인 받침 규칙 「${cause}${dm[3]}」`);
    if (sp && +sp[4] !== +dm[1]) f.push(`머리 나이 ${sp[4]} ≠ 사망 줄 ${dm[1]}`);
    if (sp && +sp[3] - +sp[1] !== +dm[1]) f.push(`머리 연도 차 ${+sp[3] - +sp[1]} ≠ 나이 ${dm[1]}`);
  }
  if (!/^(살아오며 \d+번의 선택을 했습니다\.|선택을 내려야 하는 순간이 오기 전이었습니다\.)$/.test(d.choices ?? '')) f.push(`선택 수 줄 「${d.choices}」`);
  if (!d.name || !/의 인생$/.test(d.name)) f.push(`제목 「${d.name}」`);
  // 막대
  const b = d.bar;
  if (!b) {
    f.push('막대 없음');
    return { f, notes };
  }
  if (b.role !== 'img') f.push(`막대 role ${b.role}`);
  const startRow = d.legend.find((r) => r.dt === '출발선');
  const endRow = d.legend.find((r) => r.dt === '마지막');
  const bandText = (d.gradeRange ?? '').replace(/^\(|\)$/g, '');
  const band = parseBand(bandText);
  if (!band) f.push(`구간 글자를 풀지 못함 「${bandText}」`);
  if (!startRow) f.push('범례 출발선 줄 없음');
  if (!d.legendChip || d.gradeChips !== 1) f.push(`수저 칩 ${d.gradeChips}개`);
  if (d.legendChip && m.tier && String(m.tier) !== d.legendChip.grade) f.push(`칩 단계 ${d.legendChip.grade} ≠ 부모 재력 ${m.tier}`);
  // 축
  if (!b.axis || b.axis.join() !== '하위,상위' || b.axisHidden !== 'true') f.push(`축 글자 ${JSON.stringify(b.axis)} aria-hidden=${b.axisHidden}`);
  // 띠 위치
  const tw = b.track.w;
  const x0 = b.track.l;
  const px = (p) => x0 + (p / 100) * tw;
  const tol = 1.6;
  if (band && b.band) {
    const eLeft = px(band[0]);
    const eRight = px(band[1]);
    if (Math.abs(b.band.l - eLeft) > tol) f.push(`띠 왼쪽 ${b.band.l.toFixed(1)} ≠ 글자 기대 ${eLeft.toFixed(1)} (구간 ${band})`);
    if (Math.abs(b.band.r - eRight) > tol) f.push(`띠 오른쪽 ${b.band.r.toFixed(1)} ≠ 글자 기대 ${eRight.toFixed(1)} (구간 ${band})`);
  } else if (!b.band) f.push('띠 없음');
  if (b.mid) {
    const c = (b.mid.l + b.mid.r) / 2;
    if (Math.abs(c - px(50)) > tol) f.push(`50% 눈금 ${c.toFixed(1)} ≠ ${px(50).toFixed(1)}`);
  } else f.push('50% 눈금 없음');
  // 마름모·범례·문장
  let mv = null;
  if (early) {
    if (b.end) f.push('20세 미만인데 마름모가 있다');
    if (endRow) f.push('20세 미만인데 범례 「마지막」이 있다');
    if (d.movement) f.push('20세 미만인데 방향 문장이 있다');
    if (d.note) f.push('20세 미만인데 주석이 있다');
    if (b.label !== `출발선 ${bandText}.`) f.push(`aria-label 「${b.label}」`);
    if (d.journey !== `${bandText}의 집에서 태어났습니다.`) f.push(`출발선 문장 「${d.journey}」`);
    if (d.finalNetNone !== '스무 살이 되기 전이라 자산을 세지 않았습니다.') f.push(`최종 순자산 줄 「${d.finalNetNone}」`);
  } else {
    const endText = endRow ? endRow.dd : null;
    const e = endText ? parseEnd(endText) : null;
    if (e === null) f.push(`마지막 자리 글자를 풀지 못함 「${endText}」`);
    if (endText === '가운데쯤') f.push('최종 자리가 「가운데쯤」(동률 불리 위반 후보)');
    if (!b.end) f.push('마름모 없음');
    if (e !== null && b.end) {
      const c = (b.end.l + b.end.r) / 2;
      if (Math.abs(c - px(e)) > tol) f.push(`마름모 중심 ${c.toFixed(1)} ≠ 글자 기대 ${px(e).toFixed(1)} (점수 ${e})`);
    }
    mv = d.movement;
    const exp = band && e !== null ? expectMovement(band, e) : null;
    if (!Object.values(MV_TEXT).includes(mv)) f.push(`방향 문장 「${mv}」`);
    else if (exp && MV_TEXT[exp] !== mv) f.push(`방향 문장 「${mv}」 ≠ 글자 기대 「${MV_TEXT[exp]}」 (구간 ${band}, 점수 ${e})`);
    // 그림에서 읽은 방향 (띠 밖 오른쪽 = 앞섬, 왼쪽 = 뒤쪽, 띠 안·여유 2점 이내 = 비슷함)
    if (b.end && b.band) {
      const c = (b.end.l + b.end.r) / 2;
      const pp = tw / 100;
      const upGr = band && band[1] + 2 >= 99 ? 0 : 2 * pp;
      const dnGr = band && band[0] - 2 <= 1 ? 0 : 2 * pp;
      const drawn = c > b.band.r + upGr + 0.6 ? 'up' : c < b.band.l - dnGr - 0.6 ? 'down' : 'same';
      const drawnStrict = c > b.band.r + 0.5 ? 'up' : c < b.band.l - 0.5 ? 'down' : 'same';
      if (mv && drawn !== { [MV_TEXT.up]: 'up', [MV_TEXT.same]: 'same', [MV_TEXT.down]: 'down' }[mv]) {
        // 천장·바닥에서 여유가 0인 구간은 그림 해석도 달라진다 — 기대값(위)과 일치하면 문장은 맞다. 그림만 어긋난 것은 기록.
        notes.push(`그림 읽기 ${drawn} ≠ 문장 ${mv}`);
      }
      if (drawnStrict !== drawn) notes.push(`경계 모호(마름모가 띠 바깥 2점 이내): 문장 「${mv}」 · 그림은 띠 바깥 ${(Math.abs(drawnStrict === 'up' ? c - b.band.r : b.band.l - c) / (tw / 100)).toFixed(1)}점`);
    }
    const wantLabel = `출발선 ${bandText}, 마지막 ${endText}.`; // r2(M7e-4 관찰 7): 방향 문장 없음 — 방향은 화면의 방향 문장이 따로 말한다
    if (b.label !== wantLabel) f.push(`aria-label 「${b.label}」 ≠ 화면 글자 조합 「${wantLabel}」`);
    if (d.journey !== `${bandText}의 집에서 태어나, ${endText}의 형편으로 생을 마쳤습니다.`) f.push(`출발선 문장 「${d.journey}」`);
    if (!d.note || !/숫자를 빼서 견주지 않고/.test(d.note)) f.push(`주석 「${d.note}」`);
    // 최종 순자산 줄: 금액만
    const nv = d.finalNetValue ?? '';
    if (!/^[−-]?(?:\d{1,3}(?:,\d{3})*억 )?(?:\d{1,3}(?:,\d{3})*만 )?원$|^0원$|^[−-]?\d[\d,]*억 원$|^[−-]?\d[\d,]*만 원$|^[−-]?\d+억 \d[\d,]*만 원$/.test(nv)) f.push(`최종 순자산 금액 꼴 「${nv}」`);
    const rest = (d.finalNet ?? '').replace('최종 순자산', '').replace(nv, '').replace(d.finalNetBasis ?? '', '').trim();
    if (rest) f.push(`최종 순자산 줄에 금액 말고 글자가 있다 「${rest}」`);
    if (era === 'present' ? d.finalNetBasis : d.finalNetBasis !== '지금 가치로 환산') f.push(`환산 태그 「${d.finalNetBasis}」 (시대 ${era})`);
    if (m.variant === 'zero') {
      if (nv !== '0원') f.push(`0원 판인데 금액 「${nv}」`);
      if (endText === '가운데쯤') f.push('0원 판 자리 「가운데쯤」');
      if (m.tier === 1 && mv === MV_TEXT.up) f.push('흙수저 0원 판이 「앞섬」');
    }
  }
  // 외모 줄
  if (!/^또래 사이에서 (?:상위 약 \d+%|하위 약 \d+%|상위 \d+% 안쪽|하위 \d+% 안쪽|가운데쯤)$/.test(d.finalLooks ?? '')) f.push(`외모 줄 「${d.finalLooks}」`);
  // 연표·본문 어체
  const bad = [];
  for (const t of [d.death, d.choices, d.journey, d.movement, d.note].filter(Boolean)) for (const s of splitSent(t)) if (!isHap(s)) bad.push(s);
  for (const e of d.timeline) {
    // 연표 줄은 「N세 [제목] [선택: …] 본문」 — 문장 끝만 본다
    const body = e.text.replace(/^\d+세\s*/, '');
    for (const s of splitSent(body)) {
      if (/^선택: /.test(s)) continue;
      if (!isHap(s) && !/[.]$/.test(s)) continue; // 제목·선택 라벨(마침표 없음)
      if (!isHap(s)) bad.push(`[연표 ${e.kind}] ${s}`);
    }
  }
  if (bad.length) f.push(`합쇼체가 아닌 문장 ${bad.length}건: ${bad.slice(0, 3).join(' | ')}`);
  // 단계 줄·사망 줄 새 문안
  const stage = (re) => d.timeline.filter((e) => e.kind === 'stage' && re.test(e.text));
  const wantStage = [
    [/스무 살/, '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.'],
    [/마흔/, '어느덧 마흔이 되었습니다.'],
    [/예순다섯/, '예순다섯이 되었습니다. 일에서 한 걸음 물러설 나이입니다.'],
  ];
  for (const [re, want] of wantStage) for (const e of stage(re)) if (!e.text.includes(want)) f.push(`단계 줄 「${e.text}」 ≠ 「${want}」`);
  const deathRow = d.timeline.filter((e) => e.kind === 'death');
  if (deathRow.length !== 1 || !/세상을 떠났습니다\. 원인은 .+(이었|였)습니다\.$/.test(deathRow[0]?.text ?? '')) f.push(`연표 사망 줄 ${JSON.stringify(deathRow.map((e) => e.text))}`);
  if (d.docOverflow > 0) f.push(`문서 가로 넘침 ${d.docOverflow}px`);
  if (d.bodyBad) f.push('NaN/undefined 글자');
  return { f, notes, mv, band, bandText };
}

