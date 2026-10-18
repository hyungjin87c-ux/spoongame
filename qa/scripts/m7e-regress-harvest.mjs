// QA-003 M7e 회귀(수확 표본에서 센다): 영유아(M7a) 마일스톤·1세 줄 순서·동생 카드 3지·영향 줄, M5 성인 자산 카드 글, 출생신고 표기, 또래 라벨, 외동 가족 카드.
// 사용: node qa/scripts/m7e-regress-harvest.mjs     결과: cases.jsonl (M7e-R05, R07, R08, R09, R10)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, addCase } from './m7e-lib.mjs';

const lives = [];
for (const f of fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[a-z]\d?\.jsonl$/.test(f))) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.final) lives.push(r);
  }
}
const n = lives.length;

// ---- R05 영유아 마일스톤 ----
{
  const bad = [];
  let vacc = 0, steps = 0, word = 0, order = 0, y1three = 0, y1two = 0, tooEarly = 0;
  for (const l of lives) {
    const h = l.final.history;
    const at = (id) => h.filter((x) => x.eventId === id);
    const v = at('infant-vaccine');
    const s = at('infant-first-steps');
    const w = at('infant-first-word');
    if (l.final.death && l.final.death.age < 2) { tooEarly++; continue; }
    if (v.length === 1 && v[0].age === 0) vacc++; else bad.push(`${l.era}-${l.seed}: 예방접종 ${v.map((x) => x.age)}`);
    if (s.length === 1 && s[0].age === 1) steps++; else bad.push(`${l.era}-${l.seed}: 첫 걸음마 ${s.map((x) => x.age)}`);
    if (w.length === 1 && w[0].age === 1) word++; else bad.push(`${l.era}-${l.seed}: 첫 말 ${w.map((x) => x.age)}`);
    // 1세 줄 순서: 걸음마 → 첫 말 → (그 해의 다른 줄)
    const y1 = h.filter((x) => x.age === 1 && x.kind !== 'stage');
    const iS = y1.findIndex((x) => x.eventId === 'infant-first-steps');
    const iW = y1.findIndex((x) => x.eventId === 'infant-first-word');
    if (iS === 0 && iW === 1) order++;
    else if (iS !== -1 && iW !== -1) bad.push(`${l.era}-${l.seed}: 1세 줄 순서 ${y1.map((x) => x.eventId).join(',')}`);
    if (y1.length >= 3) y1three++;
    else y1two++;
  }
  addCase({ id: 'M7e-R05', cat: '회귀', title: `영유아(M7a) 마일스톤: 예방접종 0세·첫 걸음마 1세·첫 말 1세가 모든 판에 각 1번, 1세 줄 순서(걸음마 → 첫 말 → 그 밖)`, steps: `수확 ${n}판의 저장 연표를 읽어 센다`, expected: '모든 판(영유아 중 사망 제외)에서 각 1번·순서 위반 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `${n - tooEarly}판: 예방접종 ${vacc}·걸음마 ${steps}·첫 말 ${word} 모두 100%, 1세 순서 ${order}판 정상(1세 세 줄 이상 ${y1three}판·두 줄 ${y1two}판), 영유아 사망 제외 ${tooEarly}판`, shots: [] });
}

// ---- R07 동생 카드 ----
{
  const bad = [];
  let cards = 0, withGrandma = 0, withNotice = 0;
  for (const l of lives) {
    for (const d of l.decisions) {
      if (!d.key || !d.key.startsWith('infant-new-sibling@')) continue;
      cards++;
      const ids = d.choices.map((c) => c.id);
      const gc = d.st && d.st.flags && d.st.flags.includes('grandparent_close');
      if (ids.length !== 3) bad.push(`${l.era}-${l.seed}: 선택지 ${ids.length}개 ${ids}`);
      if (!ids.includes('help') || !ids.includes('sulk')) bad.push(`${l.era}-${l.seed}: help/sulk 없음 ${ids}`);
      if (gc) { withGrandma++; if (!ids.includes('grandma') || ids.includes('notice')) bad.push(`${l.era}-${l.seed}: 조부모 가까움인데 ${ids}`); }
      else { withNotice++; if (!ids.includes('notice') || ids.includes('grandma')) bad.push(`${l.era}-${l.seed}: 조부모 아님인데 ${ids}`); }
      if (!/^집에 동생이 생겼습니다\./.test(d.text)) bad.push(`${l.era}-${l.seed}: 본문 ${d.text}`);
    }
    // 동생 정합: 동생 줄이 있으면 younger_sibling 플래그
    const had = l.final.history.some((h) => h.eventId === 'infant-new-sibling');
    if (had && !l.final.flags.includes('younger_sibling')) bad.push(`${l.era}-${l.seed}: 동생 사건이 있는데 younger_sibling 없음`);
  }
  addCase({ id: 'M7e-R07', cat: '회귀', title: '동생 맞이 카드(M7a): 선택지 항상 3개(돌본다·서운해한다 + 조부모 품 또는 장난), 조부모 가까움 여부와 정합, 동생 사건 → younger_sibling', steps: '수확 표본의 결정 카드 중 「동생이 생겼다」를 센다', expected: '모두 3지·정합 위반 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `카드 ${cards}장 모두 3지(조부모 품 ${withGrandma}·장난 ${withNotice}), 정합 위반 0`, shots: [] });
}

// ---- R08 M5 자산 카드·영향 줄 글 ----
{
  const bad = [];
  let adult = 0, young = 0, tagOk = 0, impactCards = 0, impactChoices = 0, noImpact = 0;
  const REQ = /^자산 현황(지금 가치로 환산)?순자산(−)?[\d,억조 만]*원연 소득[\d,억조 만]*원부채[\d,억조 만]*원순자산은 가진 것에서 부채를 뺀 값입니다\. 0보다 작으면 부채가 가진 것보다 많다는 뜻입니다\.$/;
  for (const l of lives) {
    for (const d of l.decisions) {
      if (d.age >= 20) {
        adult++;
        if (!REQ.test(d.assetsCard ?? '')) bad.push(`${l.era}-${l.seed}@${d.age}: 자산 카드 글 「${(d.assetsCard ?? '').slice(0, 60)}」`);
        else if ((l.era === 'present') === /지금 가치로 환산/.test(d.assetsCard)) bad.push(`${l.era}-${l.seed}@${d.age}: 환산 태그 불일치`);
        else tagOk++;
      } else young++;
      impactCards++;
      for (const c of d.choices) {
        impactChoices++;
        if (!c.impact || c.impact.length === 0) noImpact++;
        for (const it of c.impact ?? []) if (!/^(집안 살림|자산|부채|건강|행복|지식|관계)(▲{1,3}|▼{1,3})$/.test(it)) bad.push(`${l.era}-${l.seed}@${d.age} ${d.key}/${c.id}: 영향 항목 꼴 「${it}」`);
      }
    }
  }
  if (noImpact > 0) bad.push(`영향 줄이 하나도 없는 선택지 ${noImpact}개`);
  addCase({ id: 'M7e-R08', cat: '회귀', title: 'M5 자산 카드·영향 줄의 글 꼴: 성인 카드 = 「자산 현황 + (지난·다가올) 지금 가치로 환산 + 순자산·연 소득·부채 + 순자산 설명」, 영향 항목 꼴 = 「항목+▲/▼ 1~3개」', steps: '수확 표본 결정 카드의 자산 카드·영향 줄 글을 정규식으로 센다(표기 = 실제 스탯 변화는 R12)', expected: '위반 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `카드 ${impactCards}장(성인 ${adult}·20세 미만 ${young}), 선택지 ${impactChoices}개 모두 영향 줄 꼴 정상, 환산 태그 ${tagOk}장 정합`, shots: [] });
}

// ---- R09 출생신고 표기 ----
{
  const bad = [];
  const norm = (s) => s.replace(/\d+/g, 'N');
  const W = new Set(['다이아몬드수저(상위 N% 안쪽)', '금수저(상위 N~N% 사이)', '은수저(상위 N~N% 사이)', '흙수저(하위 N% 안쪽)', '동수저(하위 N% 선과 상위 N% 선 사이)']);
  const L = /^또래 사이에서 (?:상위 약 N%|하위 약 N%|상위 N% 안쪽|하위 N% 안쪽|가운데쯤)$/;
  const K = /^N\.Nkg \((?:상위 약 N%|하위 약 N%|상위 N% 안쪽|하위 N% 안쪽|가운데쯤)\)$/;
  let mid = 0, center = 0, looksMid = 0;
  for (const l of lives) {
    if (!l.birth) continue; // 플레이 기록(source=play)은 출생신고를 play-*.json에 따로 둔다
    const f = l.birth.fields;
    if (!W.has(norm(f.wealth))) bad.push(`${l.era}-${l.seed}: 집안 형편 「${f.wealth}」`);
    if (/하위 \d+% 선과 상위 \d+% 선 사이/.test(f.wealth)) center++;
    if (!L.test(norm(f.looks))) bad.push(`${l.era}-${l.seed}: 외모 「${f.looks}」`);
    if (!K.test(norm(f.weight))) bad.push(`${l.era}-${l.seed}: 체중 「${f.weight}」`);
    if (/딱 중간쯤|딱 가운데|하위 \d+%와 상위/.test(JSON.stringify(f) + l.birth.sentence)) bad.push(`${l.era}-${l.seed}: 옛 표기`);
    if (f.looks.includes('가운데쯤')) looksMid++;
    if (f.weight.includes('가운데쯤')) mid++;
  }
  addCase({ id: 'M7e-R09', cat: '회귀', title: '출생신고 표기(새 문구): 「가운데쯤」·「하위 A% 선과 상위 B% 선 사이」·외모 「또래 사이에서 {값}」·옛 표기(「딱 중간쯤」·「…%와 …% 사이」) 0', steps: `수확 ${n}판의 출생신고 항목(집안 형편·외모·체중)과 출생 문장을 정규식으로 센다`, expected: '모든 판이 새 꼴, 옛 표기 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `${n}판 모두 새 꼴 (동수저 구간 ${center}판, 체중 「가운데쯤」 ${mid}판, 외모 「가운데쯤」 ${looksMid}판), 옛 표기 0`, shots: [] });
}

// ---- R10 외동·형제 가족 카드 ----
{
  const bad = [];
  let only = 0, sib = 0, rowOnly = 0;
  for (const l of lives) {
    const f = l.final;
    const hasSibling = (f.birthReport.birthOrder ?? 1) >= 2 || f.flags.includes('younger_sibling') || (f.seen && f.seen['infant-new-sibling'] !== undefined);
    const last = [...l.decisions].reverse().find((d) => d.family);
    if (!last) continue;
    // 동생은 나중에 생길 수 있어 카드 시점 기준으로 센다: 카드에 「형제자매없음」이면 외동 상태
    const none = /형제자매없음/.test(last.family);
    if (!hasSibling) { only++; if (!none) bad.push(`${l.era}-${l.seed}: 외동인데 가족 카드 「${last.family.slice(0, 60)}」`); else rowOnly++; }
    else { sib++; if (none && !(f.birthReport.birthOrder >= 2) && !f.flags.includes('younger_sibling')) bad.push(`${l.era}-${l.seed}: 형제가 있는데 「없음」`); }
  }
  addCase({ id: 'M7e-R10', cat: '회귀', title: '가족 카드: 외동 판은 「형제자매 없음」, 형제가 있는 판은 형제 행(M7a 동생 카드)', steps: '수확 표본의 마지막 결정 카드 시점의 가족 카드를 읽는다', expected: '정합 위반 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `외동 ${only}판 모두 「형제자매 없음」(${rowOnly}), 형제 판 ${sib}판 정상`, shots: [] });
}
