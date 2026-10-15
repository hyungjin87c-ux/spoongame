// 콘텐츠 경로 강제 플레이 (REV-001-M6-1 12~16번): 저장 주입으로 해당 이벤트를 띄우고, 이어서 실제 앱을 끝까지 돌려 이후 이벤트·문구를 대조한다.
// 개발 전용 탐침(?__timescale=1000&__guard=0)으로 연출 시간·입력 가드만 끈다 — 내용 확인용이다.
import fs from 'node:fs';
import path from 'node:path';
import { DEV, FAST, FIN, launch, mkctx, MOBILE, shot, snap, waitScreen, con, sleep, readSave, drive, runCase, mkState, pendingOf, envelope, GAME_KEY, SETTINGS_KEY } from './f-lib.mjs';

const EV = JSON.parse(fs.readFileSync(path.join(FIN, 'events-all.json'), 'utf8'));
const byId = Object.fromEntries(EV.map((e) => [e.id, e]));
const N = Number(process.argv[3] || 30);
const only = process.argv[2] || 'all';
const gatedBy = (flag, kind = 'notFlags') => EV.filter((e) => (e.conditions?.[kind] || []).includes(flag)).map((e) => e.id);

const browser = await launch();
const ctx = await mkctx(browser, MOBILE);
const page = await ctx.newPage();
await page.goto(DEV + '/' + FAST);

async function runGames({ n = N, state, rules = {}, shots = [], id }) {
  const games = [];
  const remaining = [...shots];
  const shotsOut = [];
  for (let i = 0; i < n; i++) {
    const st = state(i);
    await page.evaluate(
      ([g, v, s, sv]) => {
        localStorage.setItem(g, v);
        localStorage.setItem(s, sv);
      },
      [GAME_KEY, envelope(st), SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 8, autoMode: false } })],
    );
    await page.reload();
    await waitScreen(page, 'life-screen', 8000);
    let passed = [];
    let log = [];
    let done;
    for (let guard = 0; guard < 8; guard++) {
      const r = await drive(page, { rules, seed: 500 + i * 31, stopAt: remaining, passed, maxMs: 90000 });
      log = log.concat(r.log);
      done = r.done;
      if (r.done === 'stop') {
        shotsOut.push(await shot(page, id, `panel-${r.at.split('@')[0]}`));
        remaining.splice(remaining.indexOf(r.at.split('@')[0]), 1);
        passed.push(r.at);
        continue;
      }
      break;
    }
    const sv = (await readSave(page)).data;
    games.push({ done, log, hist: sv.history, flags: sv.flags, seen: sv.seen, deathAge: sv.death?.age, stats: sv.stats });
  }
  return { games, shots: shotsOut };
}

const startIdx = (g, ev) => g.hist.findIndex((h) => h.eventId === ev);
const afterEvents = (g, ev) => g.hist.slice(startIdx(g, ev) + 1).filter((h) => h.eventId);
const panelsAfter = (g, ev) => {
  const k = g.log.findIndex((l) => l.ev === ev);
  return k < 0 ? g.log : g.log.slice(k + 1);
};
const allText = (g, ev) => [
  ...afterEvents(g, ev).map((h) => `${h.title || ''} ${h.text || ''} ${h.choice || ''}`),
  ...panelsAfter(g, ev).map((l) => `${l.title} ${l.text} ${l.labels.join(' ')}`),
];
const count = (arr, f) => arr.filter(f).length;
const hasEv = (g, ev, ids) => afterEvents(g, ev).some((h) => ids.includes(h.eventId));
const picked = (g, ev, choiceId) => g.log.some((l) => l.ev === ev && l.pick === choiceId);

// 시나리오 표 -------------------------------------------------------------
const mk = (o) => (i) =>
  mkState({
    era: o.era || 'present',
    pw: o.pw ?? 3,
    age: o.age,
    flags: o.flags || [],
    stats: o.stats,
    birthYear: o.birthYear,
    seed: 7001 + i * 13,
    rngState: 7001 + i * 13,
    seen: { ...(o.seen || {}), ...(o.pending ? { [o.pending[0]]: o.age } : {}) },
    pending: o.pending ? pendingOf(o.pending[0], o.age, o.pending[1]) : null,
    lastChoiceAge: o.pending ? o.age : null,
    history: o.pending
      ? [
          { age: 0, kind: 'stage', text: `${o.birthYear ?? { past: 1975, present: 2015, future: 2045 }[o.era || 'present']}년, 남자아이로 태어났다.` },
        ]
      : undefined,
  });

const SC = [
  {
    id: 'F-C12a',
    title: '지난 세상 학업 중단: 「집안의 결정을 따른다」 뒤 학교 이벤트 0건',
    spec: mk({ era: 'past', pw: 2, age: 12, pending: ['school-family-priority', ['accept', 'plead', 'secret']] }),
    rules: { 'school-family-priority': 'accept' },
    shots: ['school-family-priority'],
    check(gs) {
      const gated = gatedBy('left_school').filter((x) => x !== 'school-family-priority');
      const viol = gs.filter((g) => hasEv(g, 'school-family-priority', gated));
      const ok = gs.filter((g) => picked(g, 'school-family-priority', 'accept')).length;
      const puppy = gs.filter((g) => afterEvents(g, 'school-family-priority').some((h) => h.eventId === 'school-puppy'));
      const puppyBad = puppy.filter((g) => allText(g, 'school-family-priority').some((t) => /학교/.test(t) && /강아지/.test(t)));
      const school = new Set();
      for (const g of gs) for (const t of allText(g, 'school-family-priority')) if (/학교/.test(t)) school.add(t.slice(0, 50));
      return { verdict: viol.length === 0 && puppyBad.length === 0 && ok === gs.length ? 'PASS' : 'FAIL', actual: `${gs.length}판 중 「따른다」 선택 ${ok}판, 닫혀야 할 학교 이벤트 ${gated.length}종이 이후에 나온 판 ${viol.length}, 강아지 이야기가 나온 판 ${puppy.length}(그중 「학교」 포함 ${puppyBad.length}). 이후 「학교」가 들어간 글: ${school.size}종 ${[...school].slice(0, 3).join(' / ')}` };
    },
  },
  {
    id: 'F-C12a2',
    title: '학업 중단 판의 강아지 이야기(school-puppy)에 「학교」가 없다',
    spec: mk({ era: 'past', pw: 2, age: 13, flags: ['left_school', 'early_work'], pending: ['school-puppy', ['keep', 'feed', 'pass']] }),
    rules: { 'school-puppy': 'keep' },
    shots: ['school-puppy'],
    n: 6,
    check(gs) {
      const bad = gs.filter((g) => allText(g, 'school-puppy').concat(g.hist.filter((h) => h.eventId === 'school-puppy').map((h) => `${h.text}${h.choice}`)).some((t) => /학교/.test(t)));
      const res = gs[0].hist.find((h) => h.eventId === 'school-puppy');
      return { verdict: bad.length === 0 && !!res ? 'PASS' : 'FAIL', actual: `${gs.length}판, 「학교」 포함 ${bad.length}판. 결과 문구: ${res ? res.text : '없음'}` };
    },
  },
  {
    id: 'F-C12b',
    title: '늦게 맞은 아이(child_late): 진로·독립 이벤트 미노출, 66~67세 「손주를 돌본다」 없음',
    spec: mk({ era: 'present', pw: 3, age: 36, flags: ['married', 'has_partner', 'child_postponed'], pending: ['youth-child-again', ['have', 'none']] }),
    rules: { 'youth-child-again': 'have' },
    shots: ['senior-gathering'],
    check(gs) {
      const late = gs.filter((g) => picked(g, 'youth-child-again', 'have'));
      const bad1 = late.filter((g) => hasEv(g, 'youth-child-again', ['middle-child-school', 'middle-child-leaves']));
      const gather = late.flatMap((g) => g.log.filter((l) => l.ev === 'senior-gathering' && l.age >= 66));
      const bad2 = gather.filter((l) => l.labels.some((x) => /손주를 돌본다/.test(x)));
      const bad3 = late.filter((g) => hasEv(g, 'youth-child-again', ['senior-grandchildren']) && g.hist.some((h) => h.eventId === 'senior-grandchildren' && h.age < 68));
      const lateKid = late.filter((g) => g.hist.some((h) => h.eventId === 'middle-late-child')).length;
      return { verdict: late.length === gs.length && bad1.length === 0 && bad2.length === 0 && bad3.length === 0 ? 'PASS' : 'FAIL', actual: `${late.length}/${gs.length}판 「이제라도 아이를 맞이한다」, 진로(아이의 앞날)·독립(비어 가는 방) 이벤트가 나온 판 ${bad1.length}, 66세 이상 「넉넉해진 시간」 패널 ${gather.length}개 중 「손주를 돌본다」 선택지 노출 ${bad2.length}, 늦게 맞은 아이 서술(middle-late-child)이 나온 판 ${lateKid}` };
    },
  },
  {
    id: 'F-C12c',
    title: '임종(부모님의 마지막 인사) 뒤 「부모님의 병환」 미노출 (+ 대조: 임종 전엔 병환이 나옴)',
    spec: mk({ era: 'present', pw: 3, age: 55, pending: ['middle-parents-farewell', ['stay', 'late', 'share']] }),
    rules: { 'middle-parents-farewell': 'stay' },
    shots: ['middle-parents-farewell'],
    async extra() {
      const ctrl = await runGames({ n: N, id: 'F-C12c-ctrl', state: mk({ era: 'present', pw: 3, age: 44 }), rules: {} });
      return ctrl.games;
    },
    check(gs, ctrl) {
      const bad = gs.filter((g) => hasEv(g, 'middle-parents-farewell', ['middle-parents-care']));
      const ctrlHit = ctrl.filter((g) => g.hist.some((h) => h.eventId === 'middle-parents-care')).length;
      return { verdict: bad.length === 0 && ctrlHit > 0 ? 'PASS' : 'FAIL', actual: `임종 뒤 병환 이벤트가 나온 판 ${bad.length}/${gs.length}. 대조군(44세부터 아무 조건 없이) ${ctrl.length}판 중 병환이 나온 판 ${ctrlHit}` };
    },
  },
  {
    id: 'F-C12d',
    title: '소원한 자식 → 「먼저 전화를 건다」 뒤 손주 이야기가 열림 (+ 대조: 「기다린다」면 계속 닫힘)',
    spec: mk({ era: 'present', pw: 3, age: 67, flags: ['has_child', 'child_distant', 'married'], pending: ['senior-estranged-child', ['call', 'letter', 'wait']] }),
    rules: { 'senior-estranged-child': 'call' },
    shots: ['senior-estranged-child', 'senior-grandchildren'],
    async extra() {
      const w = await runGames({ n: N, id: 'F-C12d-wait', state: mk({ era: 'present', pw: 3, age: 67, flags: ['has_child', 'child_distant', 'married'], pending: ['senior-estranged-child', ['call', 'letter', 'wait']] }), rules: { 'senior-estranged-child': 'wait' } });
      return w.games;
    },
    check(gs, wait) {
      const opened = (g) => hasEv(g, 'senior-estranged-child', ['senior-grandchildren']) || panelsAfter(g, 'senior-estranged-child').some((l) => l.labels.some((x) => /손주를 돌본다/.test(x)));
      const o = count(gs, opened);
      const w = count(wait, opened);
      const cleared = gs.filter((g) => !g.flags.includes('child_distant')).length;
      return { verdict: o > 0 && w === 0 ? 'PASS' : 'FAIL', actual: `전화한 ${gs.length}판 중 손주 이야기(손주 맡기 이벤트 또는 「손주를 돌본다」 선택지)가 열린 판 ${o} (child_distant 해제 ${cleared}판), 기다린 ${wait.length}판 중 열린 판 ${w}` };
    },
  },
  {
    id: 'F-C12e',
    title: '재회: 「만나서 이야기를 나눈다」 뒤 「다시 이어진 사이」가 나옴',
    spec: mk({ era: 'present', pw: 3, age: 30, flags: ['broke_up'], pending: ['youth-reunion', ['meet', 'reply', 'ignore']] }),
    rules: { 'youth-reunion': 'meet' },
    shots: ['youth-reunion', 'youth-second-chance'],
    check(gs) {
      const hit = count(gs, (g) => hasEv(g, 'youth-reunion', ['youth-second-chance']));
      const flagged = count(gs, (g) => g.seen['youth-second-chance'] !== undefined);
      return { verdict: hit >= gs.length * 0.6 ? 'PASS' : 'FAIL', actual: `${gs.length}판 중 「다시 이어진 사이」가 나온 판 ${hit} (${Math.round((hit / gs.length) * 100)}%)` };
    },
  },
  {
    id: 'F-C12f',
    title: '이혼(「따로 살기로 한다」) 뒤 배우자 문구 0건',
    spec: mk({ era: 'present', pw: 3, age: 50, flags: ['married', 'has_partner', 'has_child'], pending: ['middle-marriage-crisis', ['talk', 'space', 'apart']] }),
    rules: { 'middle-marriage-crisis': 'apart' },
    shots: ['middle-marriage-crisis'],
    check(gs) {
      const re = /배우자|아내|남편|부부|함께 늙/;
      const hits = new Map();
      for (const g of gs) {
        for (const h of afterEvents(g, 'middle-marriage-crisis')) {
          const t = `${h.title || ''} ${h.text || ''} ${h.choice || ''}`;
          if (re.test(t)) hits.set(h.eventId, (hits.get(h.eventId) || 0) + 1);
        }
        for (const l of panelsAfter(g, 'middle-marriage-crisis')) if (re.test(`${l.title} ${l.text} ${l.labels.join(' ')}`)) hits.set(l.ev, (hits.get(l.ev) || 0) + 1);
      }
      const spouseEv = count(gs, (g) => hasEv(g, 'middle-marriage-crisis', ['senior-spouse-care', 'middle-both-working']));
      return { verdict: hits.size === 0 && spouseEv === 0 ? 'PASS' : 'FAIL', actual: `${gs.length}판, 이혼 뒤 배우자 어휘가 보인 이벤트 ${hits.size}종 ${JSON.stringify([...hits])}, 배우자 전제 이벤트가 나온 판 ${spouseEv}` };
    },
  },
  {
    id: 'F-C12g',
    title: '무자녀(no_child) 판의 상속(남길 것과 쓸 것)·취미(늦게 시작한 일) 문구에 자식·손주 어휘 없음',
    spec: mk({ era: 'present', pw: 3, age: 50, flags: ['married', 'has_partner', 'no_child'], stats: { wealth: 70 }, seen: { 'youth-child': 30 } }),
    shots: ['senior-estate', 'middle-hobby'],
    check(gs) {
      const re = /자식|아이|손주|아들|딸|자녀|물려/;
      const seenEv = {};
      const bad = [];
      for (const g of gs) {
        for (const l of g.log) {
          if (['senior-estate', 'middle-hobby', 'senior-gathering', 'senior-retire', 'senior-memoir', 'senior-last-wishes', 'middle-retirement-prep', 'senior-travel'].includes(l.ev)) {
            seenEv[l.ev] = (seenEv[l.ev] || 0) + 1;
            const t = `${l.title} ${l.text} ${l.labels.join(' ')}`;
            if (re.test(t)) bad.push(`${l.ev}: ${t.slice(0, 60)}`);
          }
        }
        for (const h of g.hist) if (['senior-estate', 'middle-hobby', 'senior-gathering'].includes(h.eventId) && re.test(`${h.text}${h.choice || ''}`)) bad.push(`${h.eventId} 결과: ${h.text.slice(0, 60)}`);
      }
      const childEv = count(gs, (g) => g.hist.some((h) => ['middle-child-school', 'middle-child-grows', 'middle-child-leaves', 'senior-grandchildren', 'senior-grandchild-visit', 'senior-estranged-child'].includes(h.eventId)));
      return { verdict: bad.length === 0 && childEv === 0 && (seenEv['senior-estate'] || 0) > 0 && (seenEv['middle-hobby'] || 0) > 0 ? 'PASS' : 'FAIL', actual: `${gs.length}판, 확인한 패널 ${JSON.stringify(seenEv)}, 자식·손주 어휘가 보인 글 ${bad.length}건 ${[...new Set(bad)].slice(0, 3).join(' / ')}, 아이·손주 이벤트가 나온 판 ${childEv}` };
    },
  },
  {
    id: 'F-C12h',
    title: '기혼 판에는 「살 곳을 구하는 일」(youth-housing)이 열리지 않는다 (+ 대조: 미혼 판엔 열림)',
    spec: mk({ era: 'present', pw: 3, age: 22, flags: ['married', 'has_partner'] }),
    async extra() {
      const c = await runGames({ n: N, id: 'F-C12h-ctrl', state: mk({ era: 'present', pw: 3, age: 22, flags: [] }), rules: {} });
      return c.games;
    },
    check(gs, ctrl) {
      const bad = count(gs, (g) => g.hist.some((h) => h.eventId === 'youth-housing'));
      const ctrlHit = count(ctrl, (g) => g.hist.some((h) => h.eventId === 'youth-housing'));
      return { verdict: bad === 0 && ctrlHit > 0 ? 'PASS' : 'FAIL', actual: `기혼 ${gs.length}판 중 집 구하기 ${bad}판, 미혼 대조군 ${ctrl.length}판 중 ${ctrlHit}판` };
    },
  },
  {
    id: 'F-C13a',
    title: '거처: 「월세방을 구한다」 뒤 「오르는 월세」(R-061)가 나온다 (+ 대조: 집을 마련하면 안 나옴)',
    spec: mk({ era: 'present', pw: 3, age: 24, pending: ['youth-housing', ['rent', 'parents', 'loan']] }),
    rules: { 'youth-housing': 'rent' },
    shots: ['youth-housing', 'youth-rent-hike'],
    async extra() {
      const l = await runGames({ n: N, id: 'F-C13a-loan', state: mk({ era: 'present', pw: 3, age: 24, pending: ['youth-housing', ['rent', 'parents', 'loan']] }), rules: { 'youth-housing': 'loan' } });
      return l.games;
    },
    check(gs, loan) {
      const hit = count(gs, (g) => hasEv(g, 'youth-housing', ['youth-rent-hike']));
      const hitLoan = count(loan, (g) => hasEv(g, 'youth-housing', ['youth-rent-hike']));
      return { verdict: hit > 0 && hitLoan === 0 ? 'PASS' : 'FAIL', actual: `월세방 ${gs.length}판 중 월세 인상 ${hit}판, 집을 마련한 ${loan.length}판 중 ${hitLoan}판` };
    },
  },
  {
    id: 'F-C13b',
    title: '거처: 「혼자 먹는 저녁」(lives_alone) 뒤 집 구하기에서 「부모님 집에 머문다」가 막힌다 (+ 대조)',
    spec: mk({ era: 'present', pw: 3, age: 22, flags: ['lives_alone'], seen: { 'youth-lonely-city': 22 } }),
    shots: ['youth-housing'],
    async extra() {
      const c = await runGames({ n: N * 2, id: 'F-C13b-ctrl', state: mk({ era: 'present', pw: 3, age: 22, flags: [] }), rules: {} });
      return c.games;
    },
    check(gs, ctrl) {
      const panels = gs.flatMap((g) => g.log.filter((l) => l.ev === 'youth-housing'));
      const bad = panels.filter((l) => l.labels.some((x) => /부모님 집/.test(x)));
      const cpanels = ctrl.flatMap((g) => g.log.filter((l) => l.ev === 'youth-housing'));
      const cwith = cpanels.filter((l) => l.labels.some((x) => /부모님 집/.test(x))).length;
      return { verdict: panels.length > 0 && bad.length === 0 && cwith > 0 ? 'PASS' : 'FAIL', actual: `혼자 사는 판: 집 구하기 패널 ${panels.length}개 중 「부모님 집에 머문다」 노출 ${bad.length}. 대조군: 패널 ${cpanels.length}개 중 노출 ${cwith}` };
    },
  },
  {
    id: 'F-C13c',
    title: '거처: 시설 이주(「돌봄이 있는 곳으로 간다」) 뒤 손주 돌봄 없음 + R-094(2) 관찰(「매일 찾아가」·「동네 모임」)',
    spec: mk({ era: 'present', pw: 3, age: 72, flags: ['has_child', 'married'], pending: ['senior-move-home', ['stay', 'child', 'facility']] }),
    rules: { 'senior-move-home': 'facility' },
    shots: ['senior-move-home', 'senior-gathering'],
    check(gs) {
      const bad1 = count(gs, (g) => hasEv(g, 'senior-move-home', ['senior-grandchildren']));
      const bad2 = gs.flatMap((g) => panelsAfter(g, 'senior-move-home').filter((l) => l.ev === 'senior-gathering' && l.labels.some((x) => /손주를 돌본다/.test(x))));
      const gather = gs.flatMap((g) => panelsAfter(g, 'senior-move-home').filter((l) => l.ev === 'senior-gathering'));
      const club = gather.filter((l) => l.labels.some((x) => /동네 모임/.test(x))).length;
      const spouse = gs.flatMap((g) => g.hist.filter((h) => h.eventId === 'senior-spouse-care' && /매일 찾아가/.test(h.text)));
      return { verdict: bad1 === 0 && bad2.length === 0 ? 'PASS' : 'FAIL', actual: `${gs.length}판, 시설 이주 뒤 손주 맡기 이벤트 ${bad1}판, 「손주를 돌본다」 노출 ${bad2.length}. [R-094(2) 기록] 시설 판의 「넉넉해진 시간」 ${gather.length}개 중 「동네 모임에 나간다」 노출 ${club}, 간병 이벤트의 「매일 찾아가」 결과 ${spouse.length}회`, note: 'R-094(2)는 M6 관찰 항목(손대지 않음)' };
    },
  },
  {
    id: 'F-C14',
    title: '직장 없이 사업을 시작한 뒤 청년기 일자리 이벤트(R-072)가 나오지 않는다',
    spec: mk({ era: 'present', pw: 3, age: 27, flags: [], pending: ['youth-startup', ['start', 'decline']] }),
    rules: { 'youth-startup': 'start' },
    shots: ['youth-startup'],
    check(gs) {
      const gated = gatedBy('own_business').filter((x) => x !== 'youth-startup');
      const bad = gs.filter((g) => hasEv(g, 'youth-startup', gated));
      const ok = count(gs, (g) => picked(g, 'youth-startup', 'start'));
      return { verdict: bad.length === 0 && ok === gs.length ? 'PASS' : 'FAIL', actual: `${gs.length}판(사업 시작 ${ok}판), 닫혀야 할 이벤트(${gated.join(',')}) 중 뒤에 나온 판 ${bad.length}` };
    },
  },
  {
    id: 'F-C15a',
    title: '지난 세상 노년의 「낯선 기계」(1985년생) 문구',
    spec: mk({ era: 'past', pw: 2, age: 66, birthYear: 1985, flags: [], pending: ['senior-new-device', ['learn', 'avoid', 'ask']] }),
    n: 1,
    shots: ['senior-new-device'],
    check(gs) {
      const e = byId['senior-new-device'];
      const ids = e.choices.map((c) => c.id);
      return { verdict: 'JUDGE', actual: `본문: ${e.text} / 선택지: ${e.choices.map((c) => c.label).join(' | ')} (id ${ids.join(',')}) — 1985년생의 66세 노년에 맞는 소재인지는 스크린샷으로 판단`, note: '사람 판단' };
    },
  },
  {
    id: 'F-C16a',
    title: '[R-076 기록] 외동 판에도 「형제들과」가 나옴 — 부모님의 병환 이벤트',
    spec: mk({ era: 'present', pw: 3, age: 50, pending: ['middle-parents-care', ['home', 'facility', 'share']] }),
    n: 1,
    shots: ['middle-parents-care'],
    check() {
      const e = byId['middle-parents-care'];
      return { verdict: 'RECORD', actual: `게임에는 형제 정보가 없어 외동이어도 같은 글이 나온다: 「${e.text}」 / 선택지 「${e.choices.find((c) => c.id === 'share').label}」`, note: 'R-076 이월(기록만)' };
    },
  },
];

// 정확한 선택지 id 점검(주입한 pending이 실제 이벤트의 선택지 id인지)
for (const s of SC) {
  const m = s.spec(0).pending;
  if (m) {
    const ev = byId[m.eventId];
    const ids = (ev.choices || []).map((c) => c.id);
    if (!m.choiceIds.every((x) => ids.includes(x))) console.log('경고: 선택지 id 불일치', s.id, m.choiceIds, ids);
  }
}

const results = {};
for (const s of SC) {
  if (only !== 'all' && !s.id.startsWith(only)) continue;
  await runCase({ id: s.id, cat: 'C 콘텐츠 경로', title: s.title, steps: `저장 주입(나이·플래그·대기 선택지) → 실제 앱으로 끝까지 ${s.n || N}판 진행 → 연표·화면 문구 대조 (시간 배율 1000·가드 0)`, expected: '모순 문구·이벤트 0건', ts: true }, async () => {
    const r = await runGames({ id: s.id, n: s.n || N, state: s.spec, rules: s.rules || {}, shots: s.shots || [] });
    const stuck = r.games.filter((g) => g.done !== 'ending');
    let extra;
    if (s.extra) extra = await s.extra();
    const v = await s.check(r.games, extra);
    if (stuck.length) {
      v.verdict = 'FAIL';
      v.actual += ` | 끝까지 못 간 판 ${stuck.length}: ${stuck[0].done}`;
    }
    v.shots = r.shots;
    results[s.id] = { games: r.games.length };
    return v;
  });
}
await ctx.close();
await browser.close();
console.log('done');
