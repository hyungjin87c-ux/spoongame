import { describe, expect, it } from 'vitest';
import { TEXT_LIMITS, condContextOf, isEventEligible, type EventDef, type GameState, type SiblingKind } from '../src/core';
import { EVENT_FILES, EVENT_POOL } from '../src/data/events';
import { FM7A_APPROVALS, familyApprovalProblems, type TextApproval } from '../src/data/familyApproval';
import { FAMILY_LINE_HEAVY, FAMILY_LINE_ID, FAMILY_LINE_TEXT, GRAND_LABEL } from '../src/data/familyLineText';
import { FAMILY_DESIGN } from '../src/data/familyTables';
import { NOTE_CARDS } from '../src/data/noteCards';
import preMiddle from './fixtures/pre-fm7a-events/middle.json';
import preSenior from './fixtures/pre-fm7a-events/senior.json';
import preYouth from './fixtures/pre-fm7a-events/youth.json';
import { startLife } from '../scripts/simulateLib';

/**
 * FM7a 무거운 장면 문장 (SPEC-009 「FM7 나눔」 2절·7절, `docs/design/fm7a-event-texts.md` — 형진 님 2026-11-06 승인: T01~T10 추천안 · 부모·조부모 별세 줄 존대 「세상을 떠나셨습니다」 · T06 둘째 문장 다) · 확률 배율 1.0).
 *  ① 승인 게이트(완료 기준 1): `approved !== true`인 문장이 하나라도 있으면 그 번호를 대며 막는다. T06(어린 형제의 이른 별세)만 계획을 끄면 통과한다
 *  ② 문장 규칙 lint(완료 기준 2): FM7a 문장 전체의 느낌표·이모지·말줄임표·반말·금지 낱말 0건, 길이 한도
 *  ③ 줄 문구 출력(완료 기준 8): 승인된 문장과 글자까지 같다(주인공 성별 2 × 형제 호칭 6 × 받침 유무 × 나이대 표본), 한 줄은 연표에서 한 줄
 *  ④ 변형 사건(완료 기준 3): 원본과 문장 외 필드가 같고, 한 분이 먼저 떠난 판에서는 변형만 일어날 수 있다
 *  ⑤ 건드린 사건 목록: FM7a 전 원문(`tests/fixtures/pre-fm7a-events`)과 견줘 바뀐 사건은 이 표뿐이다 (승인한 문장을 몰래 고치지 못하게 글자도 잠근다)
 * 낱말 ↔ 조건 lint는 tests/eventLint.test.ts·tests/noteCards.test.ts, 줄의 모순 0은 tests/familyConsistency.test.ts, 줄이 나는 해·R-561·Q3 계획은 tests/familyTick.test.ts·tests/siblingLoss.test.ts.
 */

// ---------- ① 승인 게이트 ----------

describe('승인 게이트 (완료 기준 1, RG11 방식)', () => {
  const sibLossOn = FAMILY_DESIGN.siblingLoss.value.enabled;

  it('실제 승인 표: T01~T10이 모두 approved: true이고 문제가 없다 — 이 표가 통과해야 배포 빌드(check:events)가 통과한다', () => {
    expect(FM7A_APPROVALS.map((a) => a.id)).toEqual(['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10']);
    for (const a of FM7A_APPROVALS) expect(a.approved, `${a.id} ${a.what}`).toBe(true);
    expect(familyApprovalProblems(FM7A_APPROVALS, sibLossOn)).toEqual([]);
    // T06만 예외 표지가 있다
    expect(FM7A_APPROVALS.filter((a) => a.optional === true).map((a) => a.id)).toEqual(['T06']);
  });

  it('공허 통과 방지: 합성으로 한 항목을 approved: false로 바꾸면 그 번호를 대며 실패한다 (T01~T05·T07~T10)', () => {
    for (const target of FM7A_APPROVALS.filter((a) => a.optional !== true)) {
      const synthetic: TextApproval[] = FM7A_APPROVALS.map((a) => (a.id === target.id ? { ...a, approved: false } : a));
      const problems = familyApprovalProblems(synthetic, sibLossOn);
      expect(problems, target.id).toHaveLength(1);
      expect(problems[0], target.id).toContain(target.id);
      expect(problems[0]).toContain('승인 전');
    }
  });

  it('T06만 예외: 승인되지 않아도 계획을 끄면 통과하고(나머지 시험이 같이 통과), 계획이 켜져 있으면 T06 번호를 대며 막는다', () => {
    const t06Off: TextApproval[] = FM7A_APPROVALS.map((a) => (a.id === 'T06' ? { ...a, approved: false } : a));
    expect(familyApprovalProblems(t06Off, false), '계획을 끄면 T06 미승인은 문제가 아니다').toEqual([]);
    const on = familyApprovalProblems(t06Off, true);
    expect(on).toHaveLength(1);
    expect(on[0]).toContain('T06');
    // T06이 아닌 항목이 미승인이면 계획을 꺼도 막힌다
    const t07Off: TextApproval[] = FM7A_APPROVALS.map((a) => (a.id === 'T07' ? { ...a, approved: false } : a));
    expect(familyApprovalProblems(t07Off, false)[0]).toContain('T07');
  });

  it('승인 표가 깨진 것도 잡는다: 번호가 겹치거나 덮는 코드 위치가 없다', () => {
    expect(familyApprovalProblems([...FM7A_APPROVALS, FM7A_APPROVALS[0]], sibLossOn).join('\n')).toContain('겹친다');
    expect(familyApprovalProblems([{ id: 'T99', what: '시험', approved: true, covers: [] }], sibLossOn).join('\n')).toContain('covers');
  });

  it('승인 표가 덮는 코드 위치가 실제로 있다: 줄 id · 사건 id · 선택지 id · 글감 카드 (이름만 남고 코드가 사라진 승인이 없다)', () => {
    const lineIds = new Set<string>(Object.values(FAMILY_LINE_ID));
    for (const a of FM7A_APPROVALS) {
      for (const where of a.covers) {
        const [kind, rest] = [where.slice(0, where.indexOf(':')), where.slice(where.indexOf(':') + 1)];
        if (kind === 'line') expect(lineIds.has(rest), `${a.id} ${where}`).toBe(true);
        else if (kind === 'event') expect(EVENT_POOL.byId.has(rest), `${a.id} ${where}`).toBe(true);
        else if (kind === 'choice') {
          const [eid, cid] = rest.split('/');
          expect(EVENT_POOL.byId.get(eid)?.choices?.some((c) => c.id === cid), `${a.id} ${where}`).toBe(true);
        } else if (kind === 'note') expect(NOTE_CARDS.some((c) => c.id === rest), `${a.id} ${where}`).toBe(true);
        else throw new Error(`${a.id}: 알 수 없는 위치 ${where}`);
      }
    }
  });

  it('계획의 스위치는 한 곳(design.siblingLoss.enabled)이고 승인된 T06과 함께 켜져 있다 — 배율은 1.0(실제 생명표 그대로, 형진 님 2026-11-06)', () => {
    const rule = FAMILY_DESIGN.siblingLoss.value;
    expect(rule).toEqual({ enabled: true, scale: 1, maxBirthYear: 1969, sibAge: { min: 1, max: 11 }, heroAge: { min: 1, max: 19 } });
    expect(FAMILY_LINE_HEAVY[FAMILY_LINE_ID.sibLost]).toBe('loss');
  });
});

// ---------- ③ 줄 문구 출력 ----------

/** 형제 호칭 6가지(주인공 성별 2 × 종류 4 중 겹치는 것을 합친 것) — 사람이 적은 기대값(받침이 있으면 「이」, 없으면 「가」) */
const SIB_TABLE: ReadonlyArray<{ player: 'male' | 'female'; kind: SiblingKind; subject: string }> = [
  { player: 'male', kind: 'olderBrother', subject: '형이' },
  { player: 'male', kind: 'olderSister', subject: '누나가' },
  { player: 'female', kind: 'olderBrother', subject: '오빠가' },
  { player: 'female', kind: 'olderSister', subject: '언니가' },
  { player: 'male', kind: 'youngerBrother', subject: '남동생이' },
  { player: 'male', kind: 'youngerSister', subject: '여동생이' },
  { player: 'female', kind: 'youngerBrother', subject: '남동생이' },
  { player: 'female', kind: 'youngerSister', subject: '여동생이' },
];

describe('줄 문구 출력 = 승인된 문장 (완료 기준 8)', () => {
  it('T01·T02 fam-parent-gone: 존대 「세상을 떠나셨습니다」, 19세 이하는 아이가 본 것 한 줄(「집 안이 한동안 조용했습니다.」)이 붙고 20세 이상은 한 문장이다', () => {
    expect(FAMILY_LINE_TEXT.parentGone('mother', 34, true)).toBe('어머니가 34세에 세상을 떠나셨습니다. 집 안이 한동안 조용했습니다.');
    expect(FAMILY_LINE_TEXT.parentGone('father', 41, true)).toBe('아버지가 41세에 세상을 떠나셨습니다. 집 안이 한동안 조용했습니다.');
    expect(FAMILY_LINE_TEXT.parentGone('father', 63, false)).toBe('아버지가 63세에 세상을 떠나셨습니다.');
    expect(FAMILY_LINE_TEXT.parentGone('mother', 58, false)).toBe('어머니가 58세에 세상을 떠나셨습니다.');
  });

  it('T03·T04 fam-gp-gone: 네 호칭 모두 「가」, 함께 살던 분이면 「함께 살던 」이 앞에 붙는다', () => {
    const labels = ['친할아버지가', '친할머니가', '외할아버지가', '외할머니가'];
    expect(GRAND_LABEL).toEqual(['친할아버지', '친할머니', '외할아버지', '외할머니']);
    labels.forEach((who, i) => {
      expect(FAMILY_LINE_TEXT.grandGone(i, 81)).toBe(`${who} 81세에 세상을 떠나셨습니다.`);
      expect(FAMILY_LINE_TEXT.grandGone(i, 78, true)).toBe(`함께 살던 ${who} 78세에 세상을 떠나셨습니다.`);
    });
    expect(FAMILY_LINE_TEXT.grandGone(1, 78, true)).toBe('함께 살던 친할머니가 78세에 세상을 떠나셨습니다.');
    expect(FAMILY_LINE_TEXT.grandGone(3, 81)).toBe('외할머니가 81세에 세상을 떠나셨습니다.');
  });

  it('T05 fam-parents-apart: 떠나는 쪽을 문장이 지목하지 않는다 — 「부모님이 따로 살게 되었습니다. 이후 {남는 분}와 함께 지냈습니다.」', () => {
    expect(FAMILY_LINE_TEXT.parentsApart('mother')).toBe('부모님이 따로 살게 되었습니다. 이후 아버지와 함께 지냈습니다.');
    expect(FAMILY_LINE_TEXT.parentsApart('father')).toBe('부모님이 따로 살게 되었습니다. 이후 어머니와 함께 지냈습니다.');
    for (const who of ['mother', 'father'] as const) expect(FAMILY_LINE_TEXT.parentsApart(who)).not.toMatch(/집을 떠|떠나|이혼|별거/);
  });

  it('T06 fam-sib-lost: 주인공 성별 2 × 형제 호칭 6 × 받침 유무 × 별세 나이 표본(1·6·11) 모두 승인된 문장과 같다 (둘째 문장 다)) 「어른들은 한동안 말을 아꼈습니다.」)', () => {
    expect(new Set(SIB_TABLE.map((r) => r.subject)).size).toBe(6);
    for (const row of SIB_TABLE) {
      for (const a of [1, 6, 11]) {
        expect(FAMILY_LINE_TEXT.sibLost(row.player, row.kind, a), `${row.player} ${row.kind} ${a}`).toBe(`${a}살이던 ${row.subject} 세상을 떠났습니다. 어른들은 한동안 말을 아꼈습니다.`);
      }
    }
    expect(FAMILY_LINE_TEXT.sibLost('male', 'olderBrother', 6)).toBe('6살이던 형이 세상을 떠났습니다. 어른들은 한동안 말을 아꼈습니다.');
    // 라) 후보 「집에서는 말수가 줄어든 날이 이어졌습니다」는 데이터에 없다 (고르지 않은 꼴은 두지 않는다, R-627)
    expect(FAMILY_LINE_TEXT.sibLost('female', 'youngerSister', 3)).not.toContain('말수');
  });

  it('고르지 않은 꼴(비존대 부모·조부모 별세)의 문장은 코드 어디에도 없다 (R-627) — 한 줄은 한 문장 또는 두 문장이고 연표에서 한 줄이다(줄바꿈 없음)', () => {
    const all: string[] = [];
    for (const who of ['mother', 'father'] as const) for (const early of [true, false]) all.push(FAMILY_LINE_TEXT.parentGone(who, 34, early));
    for (let i = 0; i < 4; i++) all.push(FAMILY_LINE_TEXT.grandGone(i, 80), FAMILY_LINE_TEXT.grandGone(i, 80, true));
    for (const row of SIB_TABLE) all.push(FAMILY_LINE_TEXT.sibLost(row.player, row.kind, 5));
    all.push(FAMILY_LINE_TEXT.parentsApart('mother'), FAMILY_LINE_TEXT.parentsApart('father'));
    for (const t of all) {
      expect(t, t).not.toContain('\n');
      expect(t.split(/(?<=\.)\s/).length, t).toBeLessThanOrEqual(2);
    }
    for (const t of all.filter((x) => /어머니가|아버지가|할머니가|할아버지가/.test(x) && x.includes('세상을'))) expect(t, t).toContain('떠나셨습니다');
    for (const t of all.filter((x) => /형이|누나가|오빠가|언니가|동생이/.test(x))) expect(t, t).toContain('떠났습니다');
  });
});

// ---------- ② 문장 규칙 lint ----------

/**
 * 금지 낱말 표 (`docs/design/fm7a-event-texts.md` 1절 규칙 3·4·5·7과 같은 표 — 완료 기준 2). 글자 포함으로 검사하되 허용 낱말(「병환」)이 든 자리를 먼저 뺀다(R-623: 제목 「병환」이 「병」으로 걸리지 않게).
 */
const BANNED: Readonly<Record<string, readonly string[]>> = {
  '사인·원인·책임': ['병', '사고', '암', '돌연', '때문', '탓', '잘못', '책임', '원망', '버렸', '원인', '자살', '자해', '학대', '폭력', '중독', '사망', '숨졌'],
  '평가어·위로 상투어': ['안타깝', '불행', '비극', '가엾', '하늘나라', '별이 되', '좋은 곳', '천사', '편히 쉬', '명복', '애도'],
  '아이 속마음': ['슬펐', '무서웠', '두려웠', '외로웠', '울었'],
  종교: ['하느님', '부처', '기도', '영혼', '천국', '극락', '신께'],
  '수저 등급명': ['금수저', '은수저', '동수저', '흙수저', '수저'],
};
const ALLOWED_WORDS = ['병환'];

/** FM7a 문장 전체: 줄 문구 표본 + 변형 사건 4개 + 「본가」 선택지 + 글감 변형 — [위치, 글, 종류] */
function fm7aSentences(): Array<{ where: string; text: string; kind: 'line' | 'title' | 'text' | 'result' | 'label' | 'note' }> {
  const out: Array<{ where: string; text: string; kind: 'line' | 'title' | 'text' | 'result' | 'label' | 'note' }> = [];
  for (const who of ['mother', 'father'] as const) {
    for (const early of [true, false]) out.push({ where: `parentGone/${who}/${early}`, text: FAMILY_LINE_TEXT.parentGone(who, 34, early), kind: 'line' });
    out.push({ where: `parentsApart/${who}`, text: FAMILY_LINE_TEXT.parentsApart(who), kind: 'line' });
  }
  for (let i = 0; i < 4; i++) for (const w of [false, true]) out.push({ where: `grandGone/${i}/${w}`, text: FAMILY_LINE_TEXT.grandGone(i, 80, w), kind: 'line' });
  for (const r of SIB_TABLE) out.push({ where: `sibLost/${r.player}/${r.kind}`, text: FAMILY_LINE_TEXT.sibLost(r.player, r.kind, 7), kind: 'line' });
  for (const id of ['middle-parents-care-mother-gone', 'middle-parents-care-father-gone', 'middle-parents-farewell-mother-gone', 'middle-parents-farewell-father-gone', 'youth-housing']) {
    const ev = EVENT_POOL.byId.get(id) as EventDef;
    out.push({ where: `${id}.title`, text: ev.title, kind: 'title' }, { where: `${id}.text`, text: ev.text, kind: 'text' });
    for (const c of ev.choices ?? []) out.push({ where: `${id}.${c.id}.label`, text: c.label, kind: 'label' }, { where: `${id}.${c.id}.result`, text: c.result, kind: 'result' });
  }
  const note = NOTE_CARDS.find((c) => c.id === 'note-parents-aging')!;
  for (const v of note.variants ?? []) out.push({ where: 'note-parents-aging.variant', text: v.prompt, kind: 'note' });
  return out;
}

describe('문장 규칙 lint (완료 기준 2): FM7a 문장 전체', () => {
  const all = fm7aSentences();

  it('공허 통과 방지: 줄 문구 표본·변형 사건 글·글감 변형이 실제로 모였다', () => {
    expect(all.filter((s) => s.kind === 'line').length).toBe(22); // 부모 별세 4 + 이혼 2 + 조부모 8 + 형제 8
    expect(all.filter((s) => s.kind === 'text').length).toBe(5);
    expect(all.filter((s) => s.kind === 'note').length).toBe(2);
  });

  it('느낌표·이모지·말줄임표·물음표(글감 질문만 하나)가 없고, 줄·사건 문장은 합쇼체(…습니다.)로 끝난다', () => {
    for (const s of all) {
      expect(s.text, s.where).not.toMatch(/[!！…]|\.\.\./);
      expect(/\p{Extended_Pictographic}/u.test(s.text), s.where).toBe(false);
      if (s.kind === 'note') expect((s.text.match(/\?/g) ?? []).length, s.where).toBe(1);
      else expect(s.text, s.where).not.toContain('?');
      if (s.kind === 'line' || s.kind === 'text' || s.kind === 'result') for (const sentence of s.text.split(/(?<=\.)\s/)) expect(sentence, `${s.where}: ${sentence}`).toMatch(/(?:습니다|니다)\.$/);
      expect(s.text, s.where).not.toMatch(/[ㄱ-ㅎㅏ-ㅣ]/);
    }
  });

  it('금지 낱말 표(사인·원인·책임 · 평가어·위로 상투어 · 아이 속마음 · 종교 · 수저 등급명)의 낱말이 0건이다 — 허용 낱말(병환)이 든 자리는 먼저 빼고 본다', () => {
    for (const s of all) {
      let t = s.text;
      for (const ok of ALLOWED_WORDS) t = t.split(ok).join('');
      for (const [group, words] of Object.entries(BANNED)) for (const w of words) expect(t.includes(w), `${s.where}: ${group} 「${w}」 — ${s.text}`).toBe(false);
      // 금액·보급률 숫자가 없다 (나이·햇수 숫자만 허용)
      expect(s.text, s.where).not.toMatch(/\d+\s*(?:원|만 원|억|%|퍼센트)/);
    }
    // lint가 실제로 잡는다(공허 통과 방지): 허용 낱말을 빼지 않은 제목 「병환」은 「병」으로 걸린다
    expect('아버지의 병환'.includes('병')).toBe(true);
    expect('아버지의 병환'.split('병환').join('').includes('병')).toBe(false);
  });

  it('길이 한도: 한 문장 ≤ 52자 · 사건 본문 ≤ 74자 · 결과 ≤ 84자 · 제목 ≤ 16자 · 선택지 ≤ 24자(TEXT_LIMITS), 줄 전체 ≤ 2문장, 글감 질문은 {이름}을 5자로 센다', () => {
    for (const s of all) {
      const counted = s.text.replaceAll('{이름}', '가가가가가');
      for (const sentence of counted.split(/(?<=[.?])\s/)) expect(sentence.length, `${s.where}: ${sentence}`).toBeLessThanOrEqual(TEXT_LIMITS.sentence);
      if (s.kind === 'text') expect(counted.length, s.where).toBeLessThanOrEqual(TEXT_LIMITS.text);
      if (s.kind === 'result') expect(counted.length, s.where).toBeLessThanOrEqual(TEXT_LIMITS.result);
      if (s.kind === 'title') expect(counted.length, s.where).toBeLessThanOrEqual(TEXT_LIMITS.title);
      if (s.kind === 'label') expect(counted.length, s.where).toBeLessThanOrEqual(TEXT_LIMITS.label);
      if (s.kind === 'line') expect(counted.split(/(?<=\.)\s/).length, s.where).toBeLessThanOrEqual(2);
    }
  });

  it('가족 이름이 문장에 없다: 줄 문구는 이름을 읽지 않고(호칭만), 문장 안에 한글 이름 모양의 고유명이 없다 (FS2 예외 ②)', () => {
    for (const s of all.filter((x) => x.kind === 'line')) expect(s.text, s.where).not.toMatch(/[김이박최정강조윤장임][가-힣]{1,2}(?:이|가)\s세상/);
  });
});

// ---------- ④ 변형 사건 ----------

describe('「남은 한 분」 변형 사건 (T07·T08, 완료 기준 3)', () => {
  const PAIRS: ReadonlyArray<{ base: string; gone: 'mother' | 'father'; left: '아버지' | '어머니' }> = [
    { base: 'middle-parents-care', gone: 'mother', left: '아버지' },
    { base: 'middle-parents-care', gone: 'father', left: '어머니' },
    { base: 'middle-parents-farewell', gone: 'mother', left: '아버지' },
    { base: 'middle-parents-farewell', gone: 'father', left: '어머니' },
  ];
  const variantOf = (p: (typeof PAIRS)[number]): EventDef => EVENT_POOL.byId.get(`${p.base}-${p.gone}-gone`)!;
  /** 변형을 원본과 견주는 글자: id·제목·본문·`home` 결과(문장)와 한 분이 떠난 판을 가르는 플래그 조건만 빼고 모두 같아야 한다 */
  const full = (ev: EventDef): string => {
    const o = JSON.parse(JSON.stringify(ev)) as EventDef;
    for (const ch of o.choices ?? []) if (ch.id === 'home') ch.result = '';
    return JSON.stringify({ ...o, id: '', title: '', text: '', conditions: { parentAge: o.conditions?.parentAge } });
  };

  it('변형 4개가 풀에 있고 원본은 그대로 있으며 이름이 원본 id + -mother-gone·-father-gone이다', () => {
    for (const p of PAIRS) {
      expect(EVENT_POOL.byId.has(p.base), p.base).toBe(true);
      expect(variantOf(p), `${p.base}-${p.gone}-gone`).toBeDefined();
    }
    expect(EVENT_POOL.events.filter((e) => /-(?:mother|father)-gone$/.test(e.id))).toHaveLength(4);
  });

  it('변형은 원본과 문장 외 필드가 같다: id·제목·본문·home 결과(병환)·플래그 조건을 뺀 JSON이 일치한다 (선택지 id·효과·weight·once·heavy·인용·나이 조건·choices requires·보너스)', () => {
    for (const p of PAIRS) {
      const base = EVENT_POOL.byId.get(p.base)!;
      const v = variantOf(p);
      expect(full(v), `${v.id}`).toBe(full(base));
      expect(v.choices!.map((c) => c.id), v.id).toEqual(base.choices!.map((c) => c.id));
      expect(v.ageRange, v.id).toEqual(base.ageRange);
      expect(v.conditions?.parentAge, v.id).toEqual(base.conditions?.parentAge);
      expect(v.weight, v.id).toBe(base.weight);
      expect(v.once, v.id).toBe(true);
      expect(v.heavy, v.id).toEqual({ kind: 'loss' });
      expect(v.heavy, v.id).toEqual(base.heavy);
    }
  });

  it('변형의 조건: flags [{먼저 떠난 분}_gone] · notFlags [parents_gone], 원본은 notFlags [parents_gone, mother_gone, father_gone] — 한 분이 떠난 판에서는 변형만, 떠나지 않은 판에서는 원본만 후보다', () => {
    for (const p of PAIRS) {
      const v = variantOf(p);
      expect(v.conditions?.flags, v.id).toEqual([`${p.gone}_gone`]);
      expect(v.conditions?.notFlags, v.id).toEqual(['parents_gone']);
    }
    for (const base of ['middle-parents-care', 'middle-parents-farewell']) expect([...(EVENT_POOL.byId.get(base)!.conditions?.notFlags ?? [])].sort(), base).toEqual(['father_gone', 'mother_gone', 'parents_gone']);

    // 실제 후보 판정: 부모 나이가 맞는 상태에서 플래그만 바꿔 본다
    const s0: GameState = startLife(11, 'genx');
    const eligible = (id: string, flags: string[], age: number): boolean => {
      const ctx = condContextOf({ ...s0, flags, age });
      const ev = EVENT_POOL.byId.get(id)!;
      return isEventEligible(ev, { ...ctx, age, year: s0.character!.birthYear + age, seen: {}, family: { ...ctx.family!, motherBirthAge: 40, fatherBirthAge: 40 } });
    };
    for (const [base, age] of [['middle-parents-care', 55], ['middle-parents-farewell', 60]] as const) {
      const where = (flags: string[]): string[] => [base, `${base}-mother-gone`, `${base}-father-gone`].filter((id) => eligible(id, flags, age));
      expect(where([]), `${base}: 두 분 모두 계신 판`).toEqual([base]);
      expect(where(['mother_gone']), `${base}: 어머니가 먼저 떠난 판(남은 분 아버지)`).toEqual([`${base}-mother-gone`]);
      expect(where(['father_gone']), `${base}: 아버지가 먼저 떠난 판(남은 분 어머니)`).toEqual([`${base}-father-gone`]);
      expect(where(['mother_gone', 'parents_gone']), `${base}: 두 분 모두 떠난 판`).toEqual([]);
      expect(where(['parents_gone']), `${base}: 사별 사건이 두 분을 맡은 판`).toEqual([]);
    }
  });

  it('승인된 문장: 제목·본문·「직접 모시고 돌본다」 결과가 글자까지 같다 (T07, T08) — 어머니가 남은 판은 「아버지」를 「어머니」로 바꾼 같은 문장', () => {
    for (const p of PAIRS) {
      const v = variantOf(p);
      if (p.base === 'middle-parents-care') {
        expect(v.title).toBe(`${p.left}의 병환`);
        expect(v.text).toBe(`홀로 남으신 ${p.left}의 몸이 눈에 띄게 약해지셨습니다. 누가, 어디서, 어떻게 돌볼지 가족이나 친척과 이야기를 나눌 때가 왔습니다.`);
        expect(v.choices!.find((c) => c.id === 'home')!.result).toBe(`${p.left}를 곁에 모시고 직접 돌보았습니다. 몸은 고되었지만 가까이 있다는 사실이 서로에게 위안이었습니다.`);
        // 다른 두 선택지(시설·나누어 맡기)의 결과에는 부모 낱말이 없어 원본 그대로다
        for (const id of ['facility', 'share']) expect(v.choices!.find((c) => c.id === id)!.result, id).toBe(EVENT_POOL.byId.get(p.base)!.choices!.find((c) => c.id === id)!.result);
      } else {
        expect(v.title).toBe('마지막 인사');
        expect(v.text).toBe(`홀로 남으신 ${p.left}가 마지막 숨을 몰아쉬시는 날이 왔습니다. 연락을 받은 것은 평범한 낮이었습니다.`);
        for (const c of v.choices!) expect(c.result, c.id).toBe(EVENT_POOL.byId.get(p.base)!.choices!.find((x) => x.id === c.id)!.result);
      }
      expect(JSON.stringify(v), v.id).not.toMatch(/(?<!조)부모님/);
    }
    // 원본 문장은 그대로다(두 분이 함께 계신 판)
    expect(EVENT_POOL.byId.get('middle-parents-care')!.text).toBe('부모님의 몸이 눈에 띄게 약해지셨습니다. 누가, 어디서, 어떻게 돌볼지 가족이나 친척과 이야기를 나눌 때가 왔습니다.');
    expect(EVENT_POOL.byId.get('middle-parents-farewell')!.text).toBe('부모님이 마지막 숨을 몰아쉬시는 날이 왔습니다. 연락을 받은 것은 평범한 낮이었습니다.');
  });
});

// ---------- ⑤ 건드린 사건 목록 ----------

describe('FM7a가 건드린 사건은 이 목록뿐이다 (FM7a 전 원문과 견준다)', () => {
  type Raw = { id: string } & Record<string, unknown>;
  const rawOf = (file: string): Raw[] => (EVENT_FILES[`./${file}.json`] as { events: Raw[] }).events;
  const before: Record<string, Raw[]> = { youth: (preYouth as { events: Raw[] }).events, middle: (preMiddle as { events: Raw[] }).events, senior: (preSenior as { events: Raw[] }).events };

  /** 바뀐 사건 id → 바뀐 최상위·선택지 필드 이름 */
  function changes(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const file of Object.keys(before)) {
      const now = rawOf(file);
      const byId = new Map(now.map((e) => [e.id, e]));
      for (const old of before[file]) {
        const cur = byId.get(old.id);
        if (cur === undefined) {
          out.set(old.id, ['(삭제됨)']);
          continue;
        }
        const keys = new Set([...Object.keys(old), ...Object.keys(cur)]);
        const diff: string[] = [];
        for (const k of keys) {
          if (k === 'choices') {
            const a = (old.choices ?? []) as Array<Record<string, unknown>>;
            const b = (cur.choices ?? []) as Array<Record<string, unknown>>;
            if (a.length !== b.length) diff.push('choices 개수');
            a.forEach((c, i) => {
              for (const ck of new Set([...Object.keys(c), ...Object.keys(b[i] ?? {})])) if (JSON.stringify(c[ck]) !== JSON.stringify(b[i]?.[ck])) diff.push(`${String(c.id)}.${ck}`);
            });
          } else if (JSON.stringify(old[k]) !== JSON.stringify(cur[k])) diff.push(k);
        }
        if (diff.length > 0) out.set(old.id, diff.sort());
      }
      // 새로 생긴 사건
      const oldIds = new Set(before[file].map((e) => e.id));
      for (const e of now) if (!oldIds.has(e.id)) out.set(e.id, ['(새 사건)']);
    }
    return out;
  }

  it('바뀐 사건: 병환·임종 원본(조건) · 새 변형 4개 · 비어 가는 방(본문) · senior-alone(조건) · youth-housing(「본가」 라벨·결과) — 나머지 사건은 한 글자도 바뀌지 않았다', () => {
    const got = changes();
    expect(Object.fromEntries([...got].sort(([a], [b]) => (a < b ? -1 : 1)))).toEqual({
      'middle-child-leaves': ['text'],
      'middle-parents-care': ['conditions'],
      'middle-parents-care-father-gone': ['(새 사건)'],
      'middle-parents-care-mother-gone': ['(새 사건)'],
      'middle-parents-farewell': ['conditions'],
      'middle-parents-farewell-father-gone': ['(새 사건)'],
      'middle-parents-farewell-mother-gone': ['(새 사건)'],
      'senior-alone': ['conditions'],
      'youth-housing': ['parents.label', 'return.label', 'return.result'],
    });
  });

  it('T09 youth-housing: 「본가」 — 선택지 이름 둘과 「돌아간다」 결과 한 곳만 바뀌고 효과·조건·선택지 id·「머문다」 결과는 그대로다 (모든 판에서)', () => {
    const ev = EVENT_POOL.byId.get('youth-housing')!;
    expect(ev.choices!.find((c) => c.id === 'parents')!.label).toBe('본가에 머문다');
    expect(ev.choices!.find((c) => c.id === 'return')!.label).toBe('본가로 돌아간다');
    expect(ev.choices!.find((c) => c.id === 'return')!.result).toBe('짐을 싸 본가로 돌아갔습니다. 한 식탁에 앉는 저녁이 다시 늘었고 살림도 가벼워졌습니다. 독립은 한 걸음 물러섰습니다.');
    expect(ev.choices!.find((c) => c.id === 'parents')!.result).toBe('집을 나서지 않기로 했습니다. 돈은 아꼈지만 독립은 조금씩 미뤄졌습니다.');
    expect(JSON.stringify(ev)).not.toContain('부모님');
    expect(ev.choices!).toHaveLength(4);
    expect(ev.conditions).toEqual({ notFlags: ['own_home', 'married'] });
  });

  it('R-586 「비어 가는 방」(P안): 본문 첫 문장만 바뀌고 발생 조건·효과(경제)·child_left 세터는 그대로다, 비무거운 문장이다', () => {
    const ev = EVENT_POOL.byId.get('middle-child-leaves')!;
    expect(ev.text).toBe('집 안의 아이 방이 비어 있었습니다. 불 꺼진 방을 지나칠 때마다 걸음이 느려졌습니다.');
    expect(ev.heavy).toBeUndefined();
    expect(ev.conditions).toEqual({ flags: ['has_child'], notFlags: ['child_left', 'child_late'] });
    expect(ev.effects).toEqual({ stats: { relationships: -2, happiness: -1 }, assets: { net: 600 }, setFlags: ['child_left'] });
    expect(ev.ageRange).toEqual({ min: 58, max: 64 });
  });

  it('R-586 senior-alone: notFlags에 lives_with_child가 더해졌고 나머지 조건은 그대로다', () => {
    expect(EVENT_POOL.byId.get('senior-alone')!.conditions).toEqual({ assets: { dwelling: ['rent', 'jeonse', 'own'] }, notFlags: ['married', 'moved_home', 'lives_with_child'] });
  });

  it('T10 글감 note-parents-aging: 변형 둘만 더해졌고 기본 문장·조건·주제 이름은 그대로다', () => {
    const c = NOTE_CARDS.find((x) => x.id === 'note-parents-aging')!;
    expect(c.prompt).toBe('부모님이 예전보다 나이 들었다고 느낀 순간이 {이름}에게 있습니까?');
    expect(c.topic).toBe('부모님의 나이듦');
    expect(c.conditions).toEqual({ parentAge: { min: 65 }, notFlags: ['parents_gone'] });
    expect(c.variants).toEqual([
      { when: { flags: ['mother_gone'] }, prompt: '아버지가 예전보다 나이 들었다고 느낀 순간이 {이름}에게 있습니까?' },
      { when: { flags: ['father_gone'] }, prompt: '어머니가 예전보다 나이 들었다고 느낀 순간이 {이름}에게 있습니까?' },
    ]);
    expect(c.variants!.every((v) => !v.prompt.includes('홀로 남으신'))).toBe(true);
  });
});
