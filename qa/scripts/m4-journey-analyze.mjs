// QA-003 M4: m4-journey.mjs가 남긴 원자료(samples-journey-*.jsonl, journey-*.json)를 읽어 케이스 판정을 만든다.
// 사용: node qa/scripts/m4-journey-analyze.mjs <era-seed-vp> ...   예) present-229-m360 past-155-m360
import fs from 'node:fs';
import path from 'node:path';
import { OUT, CASES } from './m4-lib.mjs';

const tags = process.argv.slice(2);
const BOUNDS = [3, 7, 13, 20, 40, 60, 75];
const YOUNG = '자산은 스무 살부터 셉니다. 지금은 집안 형편을 따릅니다.';
const SOON = '순자산, 연 소득, 부채는 아직 준비 중입니다.';
const ORD = { 첫째: 1, 둘째: 2, 셋째: 3, 넷째: 4, '다섯째 이상': 5 };

const append = (rec) => {
  fs.appendFileSync(CASES, JSON.stringify({ ...rec, console: [], externalRequests: [], at: new Date().toISOString() }) + '\n');
  console.log(`[${rec.verdict}] ${rec.id} :: ${String(rec.actual).slice(0, 400)}`);
};

for (const tag of tags) {
  const [era, , vpTag] = tag.split('-');
  const SUF = vpTag === 'm360' ? '' : '-' + vpTag;
  const sum = JSON.parse(fs.readFileSync(path.join(OUT, `journey-${tag}.json`), 'utf8'));
  const S = fs
    .readFileSync(path.join(OUT, `samples-journey-${tag}.jsonl`), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
    .filter((s) => s.screen === 'life-screen' && s.age !== null);
  const byAge = new Map();
  for (const s of S) if (!byAge.has(s.age)) byAge.set(s.age, s);
  const ages = [...byAge.keys()].sort((a, b) => a - b);
  const maxAge = ages[ages.length - 1];
  const birth = sum.birth;

  // ---------- N01 흐름·출생신고 ⇔ 대시보드 정합 ----------
  {
    const bad = [];
    const notes = [];
    if (sum.errors.length) bad.push(...sum.errors);
    if (!sum.ending) bad.push('엔딩에 도달하지 못함');
    if (sum.first.name !== birth.name) bad.push(`이름 ${birth.name} → ${sum.first.name}`);
    const sentence = birth.sentence;
    if (!sum.first.logFirst || !sum.first.logFirst.includes(sentence)) bad.push(`인생 기록 첫 줄이 출생신고 서술문과 다름: ${sum.first.logFirst} vs ${sentence}`);
    const ordMatch = /(첫째|둘째|셋째|넷째|다섯째 이상)입니다/.exec(sentence);
    const order = ordMatch ? ORD[ordMatch[1]] : null;
    const sib0 = sum.first.siblings;
    const olderN = sib0.filter((t) => !/없음/.test(t)).length;
    if (order !== null && olderN !== Math.min(order - 1, 4)) bad.push(`식구 형제 수 ${olderN} ⇔ 출생신고 ${ordMatch[1]}(위 형제 ${order - 1}명 기대) — ${JSON.stringify(sib0)}`);
    notes.push(`출생신고 「${ordMatch ? ordMatch[1] : '?'}」 ⇔ 식구 형제 ${JSON.stringify(sib0)}`);
    // 부모 나이: 출생신고 격자의 어머니·아버지 나이 = 대시보드 0세
    const fm = birth.fields.mother?.value ?? '';
    const ff = birth.fields.father?.value ?? '';
    const bm = /(\d+)세/.exec(fm)?.[1];
    const bf = /(\d+)세/.exec(ff)?.[1];
    const dm = /(\d+)세/.exec(sum.first.mother ?? '')?.[1];
    const df = /(\d+)세/.exec(sum.first.father ?? '')?.[1];
    notes.push(`부모 나이 출생신고 ${bm}/${bf} ⇔ 대시보드 ${dm}/${df}`);
    if (bm !== dm || bf !== df) bad.push(`부모 나이 불일치 ${bm}/${bf} vs ${dm}/${df}`);
    // 출신 가정·거주·출생
    const bandText = birth.fields.band?.value ?? birth.fields.wealth?.value ?? birth.fields.family?.value ?? '';
    const homeDash = sum.first.home ?? '';
    notes.push(`출신 가정 대시보드 「${homeDash}」 / 출생신고 필드 키 ${Object.keys(birth.fields).join(',')}`);
    const gradeBirth = /(흙|동|은|금|다이아몬드)수저/.exec(JSON.stringify(birth.fields))?.[0];
    const gradeDash = /(흙|동|은|금|다이아몬드)수저/.exec(homeDash)?.[0];
    if (gradeBirth && gradeDash && gradeBirth !== gradeDash) bad.push(`수저 ${gradeBirth} → ${gradeDash}`);
    // 또래: 출생신고 4명 = 대시보드 4명(이름·수저)
    const bp = birth.peers.map((p) => ({ name: p.name, grade: (/(흙|동|은|금|다이아몬드)수저/.exec(p.chip) || [])[0] }));
    const dp = sum.first.peers.map((p) => ({ name: p.name, grade: p.grade }));
    if (JSON.stringify(bp) !== JSON.stringify(dp)) bad.push(`또래 불일치 ${JSON.stringify(bp)} vs ${JSON.stringify(dp)}`);
    notes.push(`또래 ${dp.map((p) => `${p.name}(${p.grade})`).join(', ')}`);
    // 또래 안내 둘째 문장
    const note = birth.peersNote ?? '';
    const want2 = '살아가기를 누르면 「같은 해 태어난 사람들」 칸에서 요즘 모습을 볼 수 있습니다.';
    if (!note.includes(want2)) bad.push(`출생신고 또래 안내 문구 ${note}`);
    if (sum.birthNextLabel !== '살아가기') bad.push(`출생신고 하단 버튼 이름 ${sum.birthNextLabel}`);
    if (sum.first.peersTitle !== '같은 해 태어난 사람들') bad.push(`대시보드 또래 칸 제목 ${sum.first.peersTitle}`);
    if (sum.first.peersSub !== '요즘 모습') bad.push(`대시보드 또래 칸 부제 ${sum.first.peersSub}`);
    notes.push(`안내 「${note}」 ⇔ 칸 「${sum.first.peersTitle}」/「${sum.first.peersSub}」 ✓`);
    if (sum.console.length) bad.push(`콘솔 ${sum.console.length}건 ${JSON.stringify(sum.console).slice(0, 200)}`);
    if (sum.requests.length) bad.push(`외부 요청 ${sum.requests.length}건`);
    notes.push(`0세~${maxAge}세 ${sum.elapsedSec}초(8배속), 선택 ${sum.choicesTaken}번`);
    append({ id: `M4-N01-${era}${SUF}`, cat: '정상', title: `[${era}] 첫 화면 → 룰렛 → 출생신고 → 살아가기 → 대시보드 0세~사망 → 엔딩 → 다시 태어나기. 출생신고 ⇔ 대시보드(이름·서술문 첫 줄·부모 나이·형제 「N째」·또래·수저) 정합, 또래 안내 둘째 문장이 실제 칸을 가리킴`, steps: `360×740 터치, 시드 ${sum.seed}, 8배속·선택지는 첫 선택지`, expected: '끊김 없이 완주, 정합 모순 0, 콘솔·외부 요청 0', verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: sum.shots.filter((x) => /N01/.test(x)) });
  }

  // ---------- N05 프로필: 얼굴 연령대 경계 ----------
  {
    const bad = [];
    const groupAt = new Map();
    for (const s of S) {
      if (!s.face) continue;
      if (groupAt.has(s.age) && groupAt.get(s.age) !== s.face) bad.push(`나이 ${s.age}에서 얼굴 그룹이 둘: ${groupAt.get(s.age)}, ${s.face}`);
      groupAt.set(s.age, s.face);
    }
    const changes = [];
    let prev = null;
    for (const a of ages) {
      const g = groupAt.get(a);
      if (prev !== null && g !== prev) changes.push(a);
      prev = g;
    }
    const wantChanges = BOUNDS.filter((b) => b <= maxAge);
    if (JSON.stringify(changes) !== JSON.stringify(wantChanges)) bad.push(`얼굴이 바뀐 나이 ${JSON.stringify(changes)} (기대 ${JSON.stringify(wantChanges)})`);
    const distinct = new Set(groupAt.values()).size;
    if (distinct !== wantChanges.length + 1) bad.push(`연령대 그룹 ${distinct}개 (기대 ${wantChanges.length + 1})`);
    // 외모 줄: 「상위/하위 약 N%」 형식, 점수 없음
    const looks = [...new Set(S.map((s) => s.looks))];
    if (looks.length !== 1) bad.push(`외모 글자가 판 중에 바뀜 ${JSON.stringify(looks)}`);
    if (!/^(상위|하위) 약 \d+%|딱 중간쯤/.test(looks[0] ?? '')) bad.push(`외모 형식 ${looks[0]}`);
    if (/\d+\s*점/.test(looks[0] ?? '')) bad.push('외모에 점수');
    const eduSeq = [];
    for (const a of ages) {
      const e = byAge.get(a).edu;
      if (!eduSeq.length || eduSeq[eduSeq.length - 1].edu !== e) eduSeq.push({ from: a, edu: e });
    }
    const home = [...new Set(S.map((s) => s.home))];
    if (home.length !== 1) bad.push(`출신 가정 글자가 판 중에 바뀜 ${JSON.stringify(home)}`);
    const chipForm = /^(흙|동|은|금|다이아몬드)수저\((하위|상위)[^)]+\)$/.test((home[0] ?? '').replace(/\s+/g, ''));
    if (!chipForm) bad.push(`출신 가정 형식 ${home[0]}`);
    // 엔딩 얼굴 정사각 96
    const ef = sum.ending?.face;
    if (!ef || ef.w !== ef.h || ef.w !== 96) bad.push(`엔딩 얼굴 크기 ${JSON.stringify(ef)} (96×96 기대)`);
    append({ id: `M4-N05-${era}${SUF}`, cat: '정상', title: `[${era}] 프로필 카드: 얼굴이 나이대 경계(3·7·13·20·40·60·75세)마다 바뀌고 그 사이엔 안 바뀜, 외모 「상위/하위 약 N%」, 출신 가정 칩, 학력 단계 변화`, steps: '8배속으로 0~사망까지 매 표본의 얼굴 연령대·학력·외모·출신 가정 글자 기록', expected: '얼굴 그룹이 정확히 7번 바뀌고(수명이 허락하는 만큼), 외모·출신 가정은 판 내내 같고 형식이 맞음', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + `0~${maxAge}세 얼굴 바뀐 나이 ${JSON.stringify(changes)}, 외모 「${looks[0]}」, 출신 가정 「${home[0]}」, 학력 변화 ${eduSeq.map((e) => `${e.from}세:${e.edu}`).join(' → ')}, 엔딩 얼굴 ${JSON.stringify(ef)}`, shots: sum.shots.filter((x) => /N05/.test(x)) });
  }

  // ---------- N06 상태 ----------
  {
    const bad = [];
    const keys = new Set();
    let n = 0;
    const range = {};
    for (const s of S) {
      for (const [k, v] of Object.entries(s.stats)) {
        keys.add(k);
        const num = Number(v);
        if (!Number.isFinite(num) || num < 0 || num > 100) bad.push(`상태 ${k}=${v} 범위 밖(나이 ${s.age})`);
        range[k] = range[k] ?? [num, num];
        range[k] = [Math.min(range[k][0], num), Math.max(range[k][1], num)];
        n++;
      }
      if (s.meters.length && s.meters.some((m, i) => m !== Object.values(s.stats)[i])) bad.push(`미터 값과 글자 불일치 나이 ${s.age}: ${JSON.stringify(s.meters)} vs ${JSON.stringify(s.stats)}`);
    }
    if (keys.size !== 4) bad.push(`상태 ${keys.size}개 ${[...keys]}`);
    const moved = Object.entries(range).filter(([, r]) => r[0] !== r[1]).length;
    append({ id: `M4-N06a-${era}${SUF}`, cat: '정상', title: `[${era}] 상태 4개(건강·행복·지식·관계) 값 0~100·미터 값=글자·판 중 변화`, steps: '표본 전체의 상태 글자·role=meter 값 대조', expected: '4개, 0~100, 값 일치', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? [...new Set(bad)].slice(0, 5).join(' / ') + ' | ' : '') + `키 ${[...keys]} 표본 ${n}개 범위 ${JSON.stringify(range)} (움직인 상태 ${moved}개)`, shots: [] });
  }

  // ---------- N07 자산 자리 ----------
  {
    const bad = [];
    for (const s of S) {
      const want = s.age < 20 ? YOUNG : SOON;
      if (s.assets !== want) bad.push(`나이 ${s.age}: 「${s.assets}」`);
    }
    const first20 = byAge.get(20)?.assets;
    append({ id: `M4-N07-${era}${SUF}`, cat: '정상', title: `[${era}] 자산 자리: 20세 미만 「자산은 스무 살부터 셉니다. 지금은 집안 형편을 따릅니다.」, 20세부터 「순자산, 연 소득, 부채는 아직 준비 중입니다.」(금액·수저 칩 없음)`, steps: '0~사망 표본의 자산 카드 글자', expected: '나이에 맞는 문구 하나, 숫자 금액 없음', verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? [...new Set(bad)].slice(0, 5).join(' / ') : `19세까지 「${YOUNG}」, 20세부터 「${first20}」, 위반 0(표본 ${S.length}개)`, shots: [] });
  }

  // ---------- N08 인생 기록 ----------
  {
    const bad = [];
    let prev = 0;
    let dec = 0;
    for (const s of S) {
      if (s.logRows < prev) dec++;
      prev = s.logRows;
      if (!s.pin || !/^이 세상의 가상 인구 [\d,]+명/.test(s.pin)) bad.push(`나이 ${s.age}: 고정 줄 ${s.pin}`);
    }
    if (dec) bad.push(`기록 줄 수가 줄어든 순간 ${dec}번`);
    const last = S[S.length - 1];
    if (last.logRows > 300) bad.push(`줄 수 ${last.logRows} > 300`);
    const rowForm = S.filter((s) => s.logLast).every((s) => /^\d+세\S/.test(s.logLast));
    if (!rowForm) bad.push('줄 형식 「N세 …」이 아닌 줄');
    const ending = sum.ending;
    const deathLine = ending ? /세상을 떠났|사망|생을 마/.test(ending.body) : false;
    append({ id: `M4-N08a-${era}${SUF}`, cat: '정상', title: `[${era}] 인생 기록: 줄이 쌓이기만 한다(줄지 않음)·「N세」+문장·맨 위 가상 인구 고정 줄 항상 있음·상한 300 이하`, steps: '표본의 기록 줄 수·마지막 줄·고정 줄 글자', expected: '줄 수 단조 증가, 고정 줄 항상, 형식 일치', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? [...new Set(bad)].slice(0, 5).join(' / ') + ' | ' : '') + `기록 줄 ${S[0].logRows}→${last.logRows}, 고정 줄 예 「${S[0].pin}」`, shots: [] });
  }

  // ---------- N09 식구 ----------
  {
    const bad = [];
    const notes = [];
    let prevM = null;
    let prevF = null;
    const goneAt = {};
    for (const a of ages) {
      const s = byAge.get(a);
      const m = /(\d+)세/.exec(s.mother ?? '');
      const f = /(\d+)세/.exec(s.father ?? '');
      const gone = (t) => /(작고|고인|세상을 떠|사망)/.test(t ?? '');
      if (prevM !== null && m && prevM.age + 1 === a) {
        if (Number(m[1]) !== prevM.val + 1) bad.push(`어머니 나이 ${prevM.val}→${m[1]} (나이 ${prevM.age}→${a}) 한 해에 +1이 아님`);
      }
      if (prevF !== null && f && prevF.age + 1 === a) {
        if (Number(f[1]) !== prevF.val + 1) bad.push(`아버지 나이 ${prevF.val}→${f[1]} (나이 ${prevF.age}→${a})`);
      }
      prevM = m ? { age: a, val: Number(m[1]) } : null;
      prevF = f ? { age: a, val: Number(f[1]) } : null;
      if (!m && !goneAt.m) goneAt.m = { age: a, text: s.mother };
      if (!f && !goneAt.f) goneAt.f = { age: a, text: s.father };
    }
    const spouseAges = ages.filter((a) => byAge.get(a).spouse);
    const childAges = ages.filter((a) => byAge.get(a).child);
    notes.push(`어머니 0세 ${byAge.get(0).mother} → ${maxAge}세 ${byAge.get(maxAge).mother}`);
    notes.push(`아버지 0세 ${byAge.get(0).father} → ${maxAge}세 ${byAge.get(maxAge).father}`);
    notes.push(`배우자 표시 ${spouseAges.length ? spouseAges[0] + '~' + spouseAges[spouseAges.length - 1] + '세 ' + byAge.get(spouseAges[0]).spouse : '없음'} / 자녀 ${childAges.length ? childAges[0] + '세~ ' + byAge.get(childAges[0]).child : '없음'}`);
    notes.push(`부모 사별 표시: 어머니 ${goneAt.m ? goneAt.m.age + '세 「' + goneAt.m.text + '」' : '없음'} 아버지 ${goneAt.f ? goneAt.f.age + '세 「' + goneAt.f.text + '」' : '없음'}`);
    const sibNow = byAge.get(maxAge).siblings;
    notes.push(`형제 ${maxAge}세 ${JSON.stringify(sibNow)}`);
    // 형제 나이: 한 해에 +1
    append({ id: `M4-N09-${era}${SUF}`, cat: '정상', title: `[${era}] 식구 카드: 부모 나이가 해마다 +1·사별 표시·형제자매·배우자·자녀 표시가 판 흐름과 맞음`, steps: '0~사망 표본의 어머니·아버지·형제·배우자·자녀 칸', expected: '부모 나이 해마다 +1, 사별 뒤 「세」 표기 없이 상태 표시', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? [...new Set(bad)].slice(0, 5).join(' / ') + ' | ' : '') + notes.join(' | '), shots: [] });
  }

  // ---------- N10 또래 요즘 모습(한 판) ----------
  {
    const bad = [];
    const RANGE = { '어린 시절': [0, 6], '학교에 다님': [7, 29], '일하는 사람': [18, 120], '구직 중': [19, 64], 돌봄: [30, 89], 은퇴: [55, 120] };
    const seqByPeer = new Map();
    const namesAtStart = byAge.get(0).peers.map((p) => p.name).join(',');
    for (const a of ages) {
      const s = byAge.get(a);
      if (s.peers.map((p) => p.name).join(',') !== namesAtStart) bad.push(`나이 ${a}: 또래 이름이 바뀜`);
      for (const p of s.peers) {
        if (!seqByPeer.has(p.name)) seqByPeer.set(p.name, { grade: p.grade, seq: [] });
        seqByPeer.get(p.name).seq.push([a, p.label]);
        const r = RANGE[p.label];
        if (!r) bad.push(`나이 ${a}: 알 수 없는 라벨 ${p.label}`);
        else if (a < r[0] || a > r[1]) bad.push(`나이 ${a}: ${p.name}(${p.grade}) 「${p.label}」은 ${r[0]}~${r[1]}세 라벨`);
      }
    }
    const lines = [];
    for (const [name, v] of seqByPeer) {
      const runs = [];
      for (const [a, l] of v.seq) {
        if (!runs.length || runs[runs.length - 1].l !== l) runs.push({ l, from: a });
      }
      lines.push(`${name}(${v.grade}): ${runs.map((r) => `${r.from}세 ${r.l}`).join(' → ')}`);
    }
    // 같은 나이에서 여러 번 표본이 있어도 라벨이 달라지지 않는가(같은 나이 안정성)
    const stab = new Map();
    for (const s of S) {
      const key = s.age;
      const cur = s.peers.map((p) => p.label).join('|');
      if (stab.has(key) && stab.get(key) !== cur) bad.push(`같은 나이 ${key}에서 라벨이 흔들림 ${stab.get(key)} vs ${cur}`);
      stab.set(key, cur);
    }
    fs.writeFileSync(path.join(OUT, `peers-${tag}.txt`), lines.join('\n'));
    append({ id: `M4-N10a-${era}${SUF}`, cat: '정상', title: `[${era}] 같은 해 태어난 사람들: 수저 칩·요즘 모습이 나이에 따라 바뀌고 나이와 모순되는 라벨 0·같은 나이에서 흔들리지 않음`, steps: '0~사망 표본의 또래 4명 라벨(나이별)', expected: '모순 라벨 0, 이름·수저 고정, 나이대마다 라벨 변화', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? [...new Set(bad)].slice(0, 5).join(' / ') + ' | ' : '') + lines.join(' || '), shots: [] });
  }

  // ---------- N12 엔딩 ----------
  {
    const bad = [];
    const e = sum.ending;
    if (!e) bad.push('엔딩 없음');
    else {
      if (!/의 인생$/.test(e.h1 ?? '')) bad.push(`엔딩 h1 ${e.h1}`);
      if (!e.header) bad.push('엔딩 공통 헤더(로고) 없음');
      if (e.looksNum) bad.push('엔딩에 외모 숫자(점)가 있음');
      if (!e.face || e.face.w !== e.face.h) bad.push(`엔딩 얼굴이 정사각이 아님 ${JSON.stringify(e.face)}`);
      if (e.overflow) bad.push('엔딩 가로 넘침');
      if (!e.rebirth) bad.push('다시 태어나기 버튼 없음');
      if (!sum.afterRebirth || !sum.afterRebirth.title || !sum.afterRebirth.start) bad.push(`다시 태어나기 뒤 첫 화면이 아님 ${JSON.stringify(sum.afterRebirth)}`);
    }
    append({ id: `M4-N12-${era}${SUF}`, cat: '정상', title: `[${era}] 엔딩: 공통 헤더(로고)·h1 「{이름}의 인생」·정사각 얼굴·외모 숫자 0 → 다시 태어나기 → 첫 화면`, steps: '사망 뒤 엔딩 화면 읽기·스크린샷 → 다시 태어나기', expected: '공통 헤더·정사각 96px 얼굴·외모 숫자 0·가로 넘침 0, 다시 태어나기가 첫 화면(「태어나기」)으로', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : `h1 「${e.h1}」, 헤더 ${e.headerText}, 얼굴 ${JSON.stringify(e.face)}, 외모 숫자 없음, 다시 태어나기 → 첫 화면`, shots: sum.shots.filter((x) => /N12/.test(x)) });
  }

  // ---------- N11 중대 결정 카드 ----------
  {
    const bad = [];
    const d = sum.decisionCard;
    if (!d) bad.push('판 중 선택지 카드를 한 번도 못 봄');
    const cardSamples = S.filter((s) => s.hasChoice);
    for (const s of cardSamples) {
      if (!s.choiceTitle) bad.push(`나이 ${s.age}: 카드 제목 없음`);
      if (!s.choices.length || s.choices.length < 2) bad.push(`나이 ${s.age}: 선택지 ${s.choices.length}개`);
    }
    append({ id: `M4-N11-${era}${SUF}`, cat: '정상', title: `[${era}] 중대 결정 카드(기존 동작): 제목·본문·선택지(번호)·선택하면 기록에 결과가 쌓이고 카드가 닫힘`, steps: '8배속 진행 중 뜬 카드 표본, 첫 선택지 클릭', expected: '카드마다 제목·선택지 2개 이상, 선택 뒤 진행 재개', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? [...new Set(bad)].slice(0, 5).join(' / ') + ' | ' : '') + `카드 표본 ${cardSamples.length}회, 선택 ${sum.choicesTaken}번, 첫 카드 ${d ? `${d.age}세 「${d.title}」 선택지 ${d.choices.length}개` : '-'}`, shots: sum.shots.filter((x) => /N11/.test(x)) });
  }

  // ---------- 요약 ----------
  console.log(`--- ${tag}: 표본 ${S.length}, 0~${maxAge}세`);
}
