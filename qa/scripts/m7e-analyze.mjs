// QA-003 M7e 문장 품질·모순 분석: 수확 표본(samples-harvest-*.jsonl, 화면에서 읽은 카드·저장의 연표·엔딩 글)을 읽어
//  T1 어체 혼재(본문·결과·기록·엔딩)  T2 어색한 합쇼체(「~하게 되었습니다」·끝맺음 반복·높임)  T3 모순(외동 형제·기혼 혼자·독립 안 한 혼자 먹는 저녁·부모 떠난 뒤 부모 집)
//  T4 시대 금지어  T5 숫자·금액·인용 부호  T6 새 안내 줄·자산 카드·또래 라벨
// 사용: node qa/scripts/m7e-analyze.mjs [glob prefix]   결과: qa/results/m7e/analysis.json (요약) + analysis-detail.jsonl (후보 목록)
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7e-lib.mjs';

const files = fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[a-z]\d?\.jsonl$/.test(f));
const lives = [];
for (const f of files) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (r.failed || !r.final) continue;
    r.file = f;
    lives.push(r);
  }
}
console.log('판', lives.length, '파일', files.join(','));

const detail = [];
const add = (kind, life, extra) => detail.push({ kind, era: life.era, seed: life.seed, file: life.file, ...extra });
const summary = { lives: lives.length, byEra: {}, tiers: {}, died: {}, checks: {} };
for (const l of lives) {
  summary.byEra[l.era] = (summary.byEra[l.era] ?? 0) + 1;
  summary.tiers[l.final.character.parentWealth] = (summary.tiers[l.final.character.parentWealth] ?? 0) + 1;
}

const splitSentences = (t) =>
  t
    .replace(/\([^)]*\)/g, '') // 출생 문장 꼬리 「(4.3kg은 …)」
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
const isHap = (s) => /(?:니다|니까)[.]$/.test(s);

// ---------- 문장 목록 만들기 ----------
// 한 판에서 사용자가 읽는 문장: 연표(history: 출생·사건·결과·단계·사망), 결정 카드 본문, 엔딩 글(사망 줄·선택 수·출발선 문장·방향·주석)
const units = []; // { life, src, age, eventId, choice, text }
for (const l of lives) {
  for (const h of l.final.history) units.push({ life: l, src: 'history:' + h.kind, age: h.age, eventId: h.eventId ?? null, title: h.title ?? null, choice: h.choice ?? null, text: h.text });
  for (const d of l.decisions) units.push({ life: l, src: 'card', age: d.age, eventId: (d.key || '').split('@')[0], title: d.title, text: d.text });
  if (l.endingText) {
    const et = l.endingText.split('\n').map((s) => s.trim()).filter(Boolean);
    for (const key of ['세상을 떠났습니다', '번의 선택', '선택을 내려야', '집에서 태어', '자리입니다', '숫자를 빼서', '스무 살이 되기 전']) {
      const s = et.find((x) => x.includes(key));
      if (s) units.push({ life: l, src: 'ending', age: l.final.age, eventId: null, text: s });
    }
  }
}

// ---------- T1 어체 ----------
const t1 = { sentences: 0, nonHap: 0, bySrc: {} };
for (const u of units) {
  for (const s of splitSentences(u.text)) {
    t1.sentences++;
    t1.bySrc[u.src] = (t1.bySrc[u.src] ?? 0) + 1;
    if (!isHap(s)) {
      t1.nonHap++;
      add('T1-어체', u.life, { src: u.src, age: u.age, eventId: u.eventId, sentence: s });
    }
    if (/[!?…]|\.\.\./.test(s) || /(?:^|[^가-힣])(?:ㅋ|ㅎ|ㅠ|ㅜ)/.test(s)) add('T1-부호', u.life, { src: u.src, age: u.age, eventId: u.eventId, sentence: s });
    if (/(?:이에요|예요|어요|아요|해요|세요|죠|네요|군요|거든요|는데요)[.]?$/.test(s) || /읍니다/.test(s)) add('T1-해요체', u.life, { src: u.src, age: u.age, eventId: u.eventId, sentence: s });
  }
}
summary.checks.T1 = t1;

// ---------- T2 어색한 합쇼체 ----------
const t2 = { '게되': 0, '것입니다류': 0, '반복끝맺음': 0, '높임불일치': 0, '되었습니다': 0, total: 0, endPhrase: {}, withinTextRepeat: 0, adjacentRepeat: 0, 지만비율: 0, sentencesN: 0 };
const endKey = (s) => {
  const w = s.replace(/[.]$/, '').split(/\s+/);
  return w.slice(-2).join(' ');
};
const evUnits = units.filter((u) => u.src === 'card' || u.src === 'history:event' || u.src === 'history:choice');
const eventTexts = new Map(); // 이벤트별 고유 문장 (본문 / 결과)
for (const u of evUnits) {
  const k = u.src === 'card' ? `${u.eventId}|body` : u.src === 'history:event' ? `${u.eventId}|body` : `${u.eventId}|result|${u.choice}`;
  if (!eventTexts.has(k)) eventTexts.set(k, u);
}
const uniq = [...eventTexts.values()];
for (const u of uniq) {
  t2.total++;
  const sents = splitSentences(u.text);
  t2.sentencesN += sents.length;
  if (/게 (?:되었|됐)습니다/.test(u.text)) { t2['게되']++; add('T2-하게되었습니다', u.life, { eventId: u.eventId, text: u.text }); }
  if (/(?:것이었습니다|것입니다|때문입니다|던 것입니다)/.test(u.text)) { t2['것입니다류']++; add('T2-해설종결', u.life, { eventId: u.eventId, text: u.text }); }
  if (/(?:되었|됐)습니다/.test(u.text)) t2['되었습니다']++;
  if (sents.length >= 2) {
    const e1 = endKey(sents[sents.length - 1]);
    const e0 = endKey(sents[sents.length - 2]);
    if (e1 === e0) { t2.withinTextRepeat++; add('T2-한본문끝반복', u.life, { eventId: u.eventId, text: u.text }); }
  }
  for (const s of sents) if (/지만[ ,]/.test(s)) t2.지만비율++;
  const last = sents[sents.length - 1];
  if (last) {
    const k = endKey(last);
    (t2.endPhrase[k] ??= new Set()).add(`${u.eventId}${u.src === 'card' ? '' : '/' + u.choice}`);
  }
  // 높임: 부모님·선생님·조부모님·할머니·할아버지가 주어(이/가/은/는)인 문장에 「-시-」가 있는가
  for (const s of sents) {
    const m = /(부모님|선생님|조부모님|할머니|할아버지|어머니|아버지)(?:이|가|은|는|께서)\s([^.]*).?$/.exec(s);
    if (m && !/(?:셨|시었|십니다|계십|계셨|께서|드렸|말씀|시는|시고|시며|시던|신 )/.test(m[2]) && !/(?:을|를|께|에게|과|와)\s?$/.test(m[1])) {
      t2['높임불일치']++;
      add('T2-높임후보', u.life, { eventId: u.eventId, sentence: s });
    }
  }
}
t2.endPhrase = Object.fromEntries(
  Object.entries(t2.endPhrase)
    .map(([k, v]) => [k, [...v]])
    .filter(([, v]) => v.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 25),
);
// 인생 기록 안의 인접 반복: 연표 연속 줄의 마지막 문장 끝맺음(마지막 2어절)이 3줄 연속 같은가
for (const l of lives) {
  const rows = l.final.history.filter((h) => h.kind === 'event' || h.kind === 'choice');
  let run = 1;
  for (let i = 1; i < rows.length; i++) {
    const a = endKey(splitSentences(rows[i - 1].text).slice(-1)[0] ?? '');
    const b = endKey(splitSentences(rows[i].text).slice(-1)[0] ?? '');
    run = a && a === b ? run + 1 : 1;
    if (run >= 2) { t2.adjacentRepeat++; add('T2-인접끝반복', l, { age: rows[i].age, a, rows: [rows[i - 1].text, rows[i].text] }); }
  }
}
summary.checks.T2 = { ...t2, 지만비율: `${t2.지만비율}/${t2.sentencesN}` };

// ---------- T3 모순 ----------
const t3 = { 외동형제: 0, 기혼혼자: 0, 혼자먹는저녁_비독립: 0, 부모떠난뒤_부모언급: 0, 가족집_부모없음: 0, 외동판: 0, 혼자먹는저녁_판: 0, parentsGone판: 0, 부모집선택_이미독립: 0, 부모집선택_판: 0, 자식없는데자식: 0, 배우자없는데배우자: 0, 명절혼자_가족집: 0, 명절혼자_판: 0, 일터없는데일터: 0, 외동가족카드_형제칸: 0, 외동가족카드_판: 0, 명절혼자_자가이면서부모집플래그: 0, 혼자사는집_판: 0, 혼자사는집_비독립: 0, 돌아가기_판: 0, 돌아가기_독립아님: 0, 돌아가기_뒤주거어긋남: 0, 주거카드_판: 0, 주거카드_돌아가기보임: 0, 주거카드_머문다보임: 0, 주거카드_가족집인데머문다없음: 0, 주거카드_독립인데돌아가기없음: 0, 주거카드_혼자살이인데돌아가기: 0, 주거카드_머문다잘못: 0, 주거카드_라벨틀림: 0, 주거카드_스냅없음: 0 };
const SIB = /(형제|동생|언니|오빠|누나|자매|손위|손아래|맏이|맏아들|막내|(?<![가-힣])형(?:이|은|을|과|도|에게|의|님)?(?![가-힣]))/;
// 연표 i번째 줄이 쓰일 때의 전·후 상태: 전 = hl ≤ i인 마지막 스냅, 후 = hl ≥ i+1인 첫 스냅
const around = (l, i) => {
  const sn = l.snaps ?? [];
  let before = null;
  let after = null;
  for (const x of sn) {
    if (x.hl <= i) before = x;
    if (after === null && x.hl >= i + 1) after = x;
  }
  return { before, after };
};
for (const l of lives) {
  const f = l.final;
  const hist = f.history;
  const hasSibling = (f.birthReport.birthOrder ?? 1) >= 2 || f.flags.includes('younger_sibling') || (f.seen && f.seen['infant-new-sibling'] !== undefined);
  if (!hasSibling) {
    t3.외동판++;
    for (const u of units.filter((x) => x.life === l)) {
      for (const t of [u.text, u.choice, u.title].filter(Boolean)) {
        const m = SIB.exec(t);
        if (m) { t3.외동형제++; add('T3-외동인데형제', l, { src: u.src, age: u.age, eventId: u.eventId, hit: m[0], text: t }); }
      }
    }
    for (const d of l.decisions) {
      for (const c of d.choices) {
        const m = SIB.exec(c.label);
        if (m) { t3.외동형제++; add('T3-외동인데형제', l, { src: 'label', age: d.age, eventId: d.key, hit: m[0], text: c.label }); }
      }
      if (d.family) {
        t3.외동가족카드_판++;
        if (/형제자매/.test(d.family)) { t3.외동가족카드_형제칸++; add('T3-외동가족카드에형제칸', l, { age: d.age, family: d.family }); }
      }
    }
  }
  hist.forEach((h, i) => {
    const { before, after } = around(l, i);
    if (!before || !after) return;
    const both = (flag) => before.fl.includes(flag) && after.fl.includes(flag);
    const none = (flag) => !before.fl.includes(flag) && !after.fl.includes(flag);
    const body = (h.text ?? '') + ' ' + (h.choice ?? '');
    if (!['event', 'choice'].includes(h.kind)) return;
    if (/혼자|홀로/.test(h.text) && both('married')) { t3.기혼혼자++; add('T3-기혼인데혼자', l, { age: h.age, eventId: h.eventId, choice: h.choice, text: h.text }); }
    if (h.age >= 8 && /자식|손주|새 식구|아이를 (?:가질|갖|맞|키)|아이 웃음|아이의 (?:선택|웃음|얼굴|목소리|공부|앞날)/.test(body) && none('has_child') && h.eventId !== 'youth-child') { t3.자식없는데자식++; add('T3-자식없는데자식', l, { age: h.age, eventId: h.eventId, text: h.text }); }
    if (/부부|남편|아내|배우자|식을 올/.test(body) && none('married') && none('has_partner') && h.eventId !== 'youth-marriage' && h.eventId !== 'youth-marriage-again' && h.eventId !== 'youth-second-chance') { t3.배우자없는데배우자++; add('T3-배우자없는데배우자', l, { age: h.age, eventId: h.eventId, text: h.text }); }
    if (h.age >= 20 && /퇴근|출근|일터|직장|회사|동료|상사/.test(h.text) && none('has_career') && !/을 구했|새 직장|일터로 돌아|퇴직|일을 시작|사무실/.test(h.text)) { t3.일터없는데일터++; add('T3-일터없는데일터', l, { age: h.age, eventId: h.eventId, text: h.text, fl: before.fl }); }
    if (h.eventId === 'middle-lonely-holiday') {
      t3.명절혼자_판++;
      // 2회차(M7e-4): 사건이 뜬 해의 직전 주거가 rent·jeonse·own이 아니면(family·care) 결함 — 부모 생존 여부와 무관
      if (!['rent', 'jeonse', 'own'].includes(before.dw)) { t3.명절혼자_가족집++; add('T3-명절혼자인데가족집', l, { age: h.age, dwelling: before.dw, fl: before.fl }); }
      if (before.dw === 'own' && before.fl.includes('lives_with_parents')) t3.명절혼자_자가이면서부모집플래그++;
    }
    if (h.eventId === 'senior-alone') {
      t3.혼자사는집_판++;
      if (!['rent', 'jeonse', 'own'].includes(before.dw) || before.fl.includes('moved_home')) { t3.혼자사는집_비독립++; add('T3-혼자사는집인데독립아님', l, { age: h.age, dwelling: before.dw, fl: before.fl }); }
    }
    if (h.eventId === 'youth-housing' && h.choice === '부모님 집으로 돌아간다') {
      t3.돌아가기_판++;
      if (!['rent', 'jeonse', 'own'].includes(before.dw) || before.fl.includes('lives_alone')) { t3.돌아가기_독립아님++; add('T3-돌아간다인데독립아님', l, { age: h.age, beforeDw: before.dw, fl: before.fl }); }
      if (after.dw !== 'family' || !after.fl.includes('lives_with_parents')) { t3.돌아가기_뒤주거어긋남++; add('T3-돌아간뒤주거', l, { age: h.age, afterDw: after.dw, fl: after.fl }); }
    }
    if (h.eventId === 'youth-lonely-city') {
      t3.혼자먹는저녁_판++;
      const okDw = (x) => ['rent', 'jeonse', 'own'].includes(x.dw);
      if (!(okDw(before) && okDw(after)) || before.fl.includes('lives_with_parents')) { t3.혼자먹는저녁_비독립++; add('T3-독립아닌혼자먹는저녁', l, { age: h.age, beforeDw: before.dw, afterDw: after.dw, fl: before.fl }); }
    }
    if (h.eventId === 'youth-housing' && h.choice === '부모님 집에 머문다') {
      t3.부모집선택_판++;
      if (['rent', 'jeonse', 'own'].includes(before.dw)) { t3.부모집선택_이미독립++; add('T3-부모집선택인데이미독립', l, { age: h.age, beforeDw: before.dw, text: h.text }); }
    }
  });
  // 2회차: 「살 곳을 구하는 일」 카드가 뜬 해의 주거에 따라 보이는 선택지가 맞는가 (가족 집 = parents, 독립(rent·jeonse·own) = return, lives_alone이면 둘 다 안 보임)
  for (const d of l.decisions) {
    if ((d.key || '').split('@')[0] !== 'youth-housing') continue;
    t3.주거카드_판++;
    const s0 = (l.snaps ?? []).find((x) => x.pe === d.key);
    if (!s0) { t3.주거카드_스냅없음++; continue; }
    const ids = d.choices.map((c) => c.id);
    const lab = (id) => d.choices.find((c) => c.id === id)?.label;
    const indep = ['rent', 'jeonse', 'own'].includes(s0.dw);
    const lonely = s0.fl.includes('lives_alone');
    if (ids.includes('return')) {
      t3.주거카드_돌아가기보임++;
      if (!indep || lonely) { t3.주거카드_혼자살이인데돌아가기++; add('T3-주거카드-돌아가기가 보일 자리 아님', l, { age: d.age, dwelling: s0.dw, lonely, ids }); }
      if (lab('return') !== '부모님 집으로 돌아간다') { t3.주거카드_라벨틀림++; add('T3-주거카드-라벨', l, { age: d.age, label: lab('return') }); }
    } else if (indep && !lonely) { t3.주거카드_독립인데돌아가기없음++; add('T3-주거카드-독립인데 돌아가기 없음', l, { age: d.age, dwelling: s0.dw, ids }); }
    if (ids.includes('parents')) {
      t3.주거카드_머문다보임++;
      if (s0.dw !== 'family') { t3.주거카드_머문다잘못++; add('T3-주거카드-머문다가 보일 자리 아님', l, { age: d.age, dwelling: s0.dw, ids }); }
      if (lab('parents') !== '부모님 집에 머문다') { t3.주거카드_라벨틀림++; add('T3-주거카드-라벨', l, { age: d.age, label: lab('parents') }); }
    } else if (s0.dw === 'family') { t3.주거카드_가족집인데머문다없음++; add('T3-주거카드-가족집인데 머문다 없음', l, { age: d.age, dwelling: s0.dw, ids }); }
  }
  // 부모가 처음 모두 떠난 뒤
  const sn = l.snaps ?? [];
  const goneSnap = sn.find((x) => x.fl.includes('parents_gone'));
  if (goneSnap) {
    t3.parentsGone판++;
    const goneAge = goneSnap.age;
    const farewell = hist.findIndex((h) => h.eventId === 'middle-parents-farewell');
    for (const x of sn) {
      if (x.age > goneAge && x.ph === 'life' && x.dw === 'family' && !x.fl.includes('moved_home') && !x.fl.includes('in_care')) { t3.가족집_부모없음++; add('T3-가족집인데부모없음', l, { goneAge, age: x.age, dwelling: x.dw }); break; }
    }
    hist.forEach((h, i) => {
      if (i <= (farewell >= 0 ? farewell : 0) || h.age < goneAge) return;
      if (!['event', 'choice'].includes(h.kind)) return;
      const m = /(부모님|어머니|아버지|본가|친정|고향집|부모 집)/.exec(h.text);
      if (m) { t3.부모떠난뒤_부모언급++; add('T3-부모떠난뒤부모언급', l, { age: h.age, goneAge, eventId: h.eventId, hit: m[0], text: h.text }); }
    });
  }
}
summary.checks.T3 = t3;

// ---------- T4 시대 금지어 ----------
const NEW_SCHOOL = ['학원', '급식'];
const NEW_DEV = ['스마트폰', '휴대전화', '휴대폰', '메신저', '대화방', '온라인', '인터넷', '앱', '플랫폼', '화면', '화상', '원격', '노트북', '태블릿', '와이파이', '영상통화', '해외 직구', '재택'];
const NEW_CARE = ['육아휴직', '어린이집', '영어 유치원', '유아 영어', '키즈카페', '문화센터', '산후조리원', '층간소음', '돌봄 도우미'];
const FUT = ['로봇', '인공지능', '자동화', '가상 현실', '가상 교실', '돌봄 기계', '기계가 대신'];
const OLD = ['연탄', '흑백', '라디오', '텃밭', '공중전화', '장터', '품앗이', '아궁이', '우물', '고무신', '화롯불', '국민학교', '야학', '중매', '맞선', '구멍가게', '군불', '호롱', '월급봉투', '탁아소', '젖동냥', '아랫목'];
const EXTRA_PAST = ['유튜브', '택배', '카페', '배달', '검색', '문자', '카톡', 'SNS', '스트리밍', '키오스크', '무인', '코로나', '핸드폰', '컴퓨터', '인공'];
const EXTRA_NONPAST = ['호롱', '지게', '소달구지', '연탄', '장터'];
const t4 = { hits: 0, byEra: {} };
for (const u of units) {
  if (!['card', 'history:event', 'history:choice', 'history:stage', 'history:death'].includes(u.src)) continue;
  const era = u.life.era;
  const texts = [u.text, u.choice].filter(Boolean);
  const banned = era === 'past' ? [...NEW_SCHOOL, ...NEW_CARE, ...FUT, ...NEW_DEV] : era === 'present' ? [...OLD, ...FUT] : [...OLD];
  for (const t of texts) {
    for (const w of banned) {
      // 노년의 지난 세상 새 기기 소재는 허용(R-067): 65세 이상이면 NEW_DEV는 건너뛴다
      if (era === 'past' && NEW_DEV.includes(w) && u.age >= 65) continue;
      if (t.includes(w)) {
        t4.hits++;
        t4.byEra[era] = (t4.byEra[era] ?? 0) + 1;
        add('T4-시대금지어', u.life, { src: u.src, age: u.age, eventId: u.eventId, word: w, text: t });
      }
    }
    if (era === 'past') for (const w of EXTRA_PAST) if (t.includes(w) && !(NEW_DEV.includes(w) && u.age >= 65) && !banned.includes(w)) add('T4-과거의심어', u.life, { src: u.src, age: u.age, eventId: u.eventId, word: w, text: t });
    if (era !== 'past') for (const w of EXTRA_NONPAST) if (t.includes(w)) add('T4-옛말의심어', u.life, { src: u.src, age: u.age, eventId: u.eventId, word: w, text: t });
  }
}
summary.checks.T4 = t4;

// ---------- T5 숫자·금액·인용 부호 ----------
const t5 = { digits: 0, quotes: 0, amount: 0 };
for (const u of units) {
  if (!['card', 'history:event', 'history:choice'].includes(u.src)) continue;
  for (const t of [u.text, u.choice, u.title].filter(Boolean)) {
    if (/[0-9０-９]/.test(t)) { t5.digits++; add('T5-숫자', u.life, { src: u.src, age: u.age, eventId: u.eventId, text: t }); }
    if (/["'“”‘’「」『』]/.test(t)) { t5.quotes++; add('T5-인용부호', u.life, { src: u.src, age: u.age, eventId: u.eventId, text: t }); }
    if (/(?:[만억천백] ?원)/.test(t)) { t5.amount++; add('T5-금액의심', u.life, { src: u.src, age: u.age, eventId: u.eventId, text: t }); }
  }
}
for (const l of lives) for (const d of l.decisions) for (const c of d.choices) {
  if (/[0-9０-９]/.test(c.label) || /["'“”‘’「」『』]/.test(c.label)) { t5.digits++; add('T5-라벨숫자', l, { age: d.age, eventId: d.key, text: c.label }); }
}
summary.checks.T5 = t5;

// ---------- T6 새 안내 줄·자산 카드·또래 라벨 ----------
const t6 = { decisions: 0, hintOk: 0, hintBad: 0, assetsYoung: 0, assetsYoungOk: 0, peersReturn: 0, peersWorkingAfterRetired: 0, labels: {} };
for (const l of lives) {
  const name = l.final.character.name;
  const seenRetired = new Map(); // 또래 이름 → 은퇴를 본 적 있는가
  for (const d of l.decisions) {
    t6.decisions++;
    if (d.hint && d.hint.includes(`선택지 아래 글씨는 이 선택만으로 ${name}에게 생기는 변화입니다.`)) t6.hintOk++;
    else { t6.hintBad++; add('T6-안내줄', l, { age: d.age, hint: d.hint }); }
    if (/자산은 스무 살부터 셉니다/.test(d.assetsCard ?? '')) {
      t6.assetsYoung++;
      if (/선택지에 보이는 「집안 살림」은 살림에 보태거나 축낸 몫을 모아 둔 값이고, 스무 살이 되면 내 자산과 부채로 합쳐집니다\./.test(d.assetsCard)) t6.assetsYoungOk++;
      else add('T6-자산카드(20세미만)', l, { age: d.age, text: d.assetsCard });
    }
    if (d.peersNow) {
      if (d.peersNow.includes('다시 일하는 사람')) t6.peersReturn++;
      for (const lab of ['어린 시절', '학교에 다님', '일하는 사람', '다시 일하는 사람', '구직 중', '돌봄', '은퇴']) {
        if (d.peersNow.includes(lab)) t6.labels[lab] = (t6.labels[lab] ?? 0) + 1;
      }
    }
  }
}
summary.checks.T6 = t6;

// ---------- 출력 ----------
fs.writeFileSync(path.join(OUT, 'analysis.json'), JSON.stringify(summary, null, 1));
fs.writeFileSync(path.join(OUT, 'samples-analysis-detail.jsonl'), detail.map((d) => JSON.stringify(d)).join('\n') + '\n');
const byKind = {};
for (const d of detail) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
console.log(JSON.stringify(summary, (k, v) => (v instanceof Set ? [...v] : v), 1));
console.log('후보 종류별', byKind);
