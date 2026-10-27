import { describe, expect, it } from 'vitest';
import { CITATION_COVERAGE_MIN, ERAS, eraBucketOf, lifeParamsOf, maxAgeOf, type GenerationId, type ProfileId, ERA_BANNED_WORDS, MANUAL_NOTE_ID, NOTE_CAUSE_WORDS, NOTE_EMOTION_WORDS, NOTE_ID_PATTERN, NOTE_LIMITS, NOTE_SAFETY_WORDS, NoteDataError, advanceUntilDecision, calendarYear, citationCoverage, citationFor, citationLinkProblems, connectedCitationIds, consumeNote, createSession, dueNote, lifeLineCount, lintNoteFile, noteCardPoolProblems, noteCount, noteFlagsRead, noteJitterAge, notePromptOf, notePromptProblems, noteQuestion, noteResponse, notesOf, sessionReducer, validateNoteFile, writeNote, type Era, type GameState, type NoteCardDef, type NoteFile, type Session, type SessionAction } from '../src/core';
import { validateTrackedEventFiles as validateEventFiles } from './helpers/withTracks';
import { NOTE_CARDS, NOTE_FILE_RAW, NOTE_MANUAL } from '../src/data/noteCards';
import { EVENT_POOL } from '../src/data/events';
import { generationDef } from '../src/data/generations';
import { CITATION_TABLE, getCitation } from '../src/data/citationsAccess';
import { runNoteSchedule } from '../scripts/noteScheduleLib';
import { SIM_PROFILES, chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 기록 카드 7종 (SPEC-003 M7c FR1·FR2 — docs/data/content-M7c.md 1·2절): 데이터 검증·문구 lint·`dueNote` 표 시험·소비/정지·세션 reducer·1000판 스케줄.
 * 입력 글의 규칙은 tests/notes.test.ts, 인생 불변은 tests/noteInvariance.test.ts.
 */

const card = (id: string): NoteCardDef => NOTE_CARDS.find((c) => c.id === id)!;
const ID = {
  infant: 'note-infant-memory',
  teen: 'note-teen-envy',
  love: 'note-first-love',
  romance: 'note-youth-romance',
  illness: 'note-illness',
  parents: 'note-parents-aging',
  midlife: 'note-midlife',
} as const;

/** 인생(life) 상태를 만들고 나이·플래그·본 이벤트·스탯·부모 나이를 덮어쓴다 (dueNote는 상태만 본다) */
function stateAt(age: number, o: { profile?: ProfileId; seed?: number; flags?: string[]; seen?: Record<string, number>; health?: number; parentAges?: [number, number]; pending?: boolean } = {}): GameState {
  const g = startLife(o.seed ?? 11, o.profile ?? 'alpha');
  const report = o.parentAges === undefined ? g.birthReport! : { ...g.birthReport!, mother: { ...g.birthReport!.mother, age: o.parentAges[0] }, father: { ...g.birthReport!.father, age: o.parentAges[1] } };
  return {
    ...g,
    age,
    flags: [...(o.flags ?? [])].sort(),
    seen: { ...(o.seen ?? {}) },
    stats: { ...g.stats, health: o.health ?? 70 },
    birthReport: report,
    pending: o.pending === true ? { eventId: 'x', key: `x@${age}`, age, choiceIds: ['a', 'b'] } : null,
  };
}
/** 실제 영유아 선택지 이벤트가 대기 중인 상태 (조건 없는 선택지 둘이 보이는 이벤트) */
function pendingAt(age: number): GameState {
  const ev = EVENT_POOL.events.find(
    (e) => e.choices !== undefined && e.stages.includes('infant') && e.conditions === undefined && e.eras === undefined && (e.ageRange?.min ?? 0) <= age && (e.ageRange?.max ?? 99) >= age && e.choices.filter((c) => c.requires === undefined).length >= 2,
  )!;
  const ids = ev.choices!.filter((c) => c.requires === undefined).slice(0, 2).map((c) => c.id);
  const g = stateAt(age, { seen: { [ev.id]: age } });
  return { ...g, lastChoiceAge: age, pending: { eventId: ev.id, key: `${ev.id}@${age}`, age, choiceIds: ids } };
}
const dueId = (g: GameState): string | null => dueNote(g)?.id ?? null;
/** 어느 나이에서 처음 뜨는가 (그 나이까지 앞 카드는 소비된 것으로 두고 `from`부터 `to`까지 훑는다) */
function firstDueAge(base: (age: number) => GameState, id: string, from: number, to: number): number | null {
  for (let a = from; a <= to; a++) if (dueId(base(a)) === id) return a;
  return null;
}

// ---------- 데이터 ----------

describe('notes.json: 카드 7종이 설명서 1-3절 표와 같다', () => {
  /** 사람이 적은 기대값 (content-M7c 1-3절) — 데이터 파일에서 가져오지 않는다 */
  const TABLE = [
    { id: ID.infant, topic: '영유아기 기억', order: 1, min: 5, max: 5, timing: 'asap' },
    { id: ID.teen, topic: '또래와 나', order: 2, min: 13, max: 17, timing: { jitter: { min: 13, max: 17 } } },
    { id: ID.love, topic: '첫사랑', order: 3, min: 15, max: 25, timing: { jitter: { min: 18, max: 22 } } },
    { id: ID.romance, topic: '마음을 나누는 일', order: 4, min: 20, max: 34, timing: { jitter: { min: 27, max: 32 } } },
    { id: ID.illness, topic: '아팠던 시간', order: 5, min: 30, max: 85, timing: 'asap' },
    { id: ID.parents, topic: '부모님의 나이듦', order: 6, min: 25, max: 60, timing: 'asap' },
    { id: ID.midlife, topic: '중년의 인생', order: 7, min: 45, max: 55, timing: { jitter: { min: 47, max: 53 } } },
  ] as const;

  it('정확히 7종이고 번호 순이며 id·주제·나이 창·때가 표와 같다', () => {
    expect(NOTE_CARDS.map((c) => c.id)).toEqual(TABLE.map((t) => t.id));
    for (const t of TABLE) {
      const c = card(t.id);
      expect(c.topic, t.id).toBe(t.topic);
      expect(c.order, t.id).toBe(t.order);
      expect(c.ageRange, t.id).toEqual({ min: t.min, max: t.max });
      expect(c.timing, t.id).toEqual(t.timing);
      expect(c.eras, `${t.id}: 세 시대 모두(eras 생략)`).toBeUndefined();
    }
  });

  it('조건·적격 갈래·제외 이벤트가 표와 같다 (③④ 변형 조건, ⑤ 두 갈래와 senior-illness-later 제외, ⑥ 부모 나이 65 이상·parents_gone 없음)', () => {
    expect(card(ID.love).variants).toEqual([{ when: { flags: ['first_love'] }, prompt: expect.any(String) }]);
    // ④: 이별 변형은 없다(M7c r2 D2 — 이별 사건은 늘 `has_partner`를 먼저 요구해 ④가 교제 시작에 이미 소비되므로 구조상 뜰 틈이 없었다). `has_partner`·`married` 변형 하나뿐
    const romance = card(ID.romance).variants!;
    expect(romance).toHaveLength(1);
    expect(romance[0].when).toEqual([{ flags: ['has_partner'] }, { flags: ['married'] }]);
    expect(card(ID.illness).triggers).toEqual([{ seenAny: ['middle-health-crisis', 'senior-illness'] }, { conditions: { stats: { health: { max: 35 } } }, minAge: 35 }]);
    expect(card(ID.illness).unlessSeen).toEqual(['senior-illness-later']);
    expect(card(ID.parents).conditions).toEqual({ parentAge: { min: 65 }, notFlags: ['parents_gone'] });
    for (const id of [ID.infant, ID.teen, ID.midlife]) {
      const c = card(id);
      expect([c.conditions, c.triggers, c.variants, c.unlessSeen], id).toEqual([undefined, undefined, undefined, undefined]);
    }
  });

  it('카드 id는 note- 형식이고 서로 다르며 수동 기록 id(note-manual)가 아니다. 이벤트 id는 note-로 시작하지 못한다 (seen 키 충돌 0)', () => {
    for (const c of NOTE_CARDS) {
      expect(NOTE_ID_PATTERN.test(c.id), c.id).toBe(true);
      expect(c.id).not.toBe(MANUAL_NOTE_ID);
    }
    expect(new Set(NOTE_CARDS.map((c) => c.id)).size).toBe(NOTE_CARDS.length);
    for (const ev of EVENT_POOL.events) expect(ev.id.startsWith('note-'), `이벤트 ${ev.id}`).toBe(false);
    // 검증기가 실제로 막는다(공허 통과 방지)
    const sample = { id: 'note-extra', title: '제목', text: '이벤트 본문은 열 글자 이상이어야 합니다.', stages: ['infant'], weight: 1, once: true };
    expect(() => validateEventFiles({ 'x.json': { events: [sample] } })).toThrow(/note-/);
    expect(() => validateEventFiles({ 'x.json': { events: [{ ...sample, id: 'infant-extra' }] } })).not.toThrow();
  });

  it('나이 창은 모든 세대의 사망 가능 나이 안이고, 때의 흔들림은 나이 창 안이다', () => {
    const maxAge = Math.min(...SIM_PROFILES.map((p) => maxAgeOf(lifeParamsOf(p, 2000))));
    for (const c of NOTE_CARDS) {
      expect(c.ageRange.max, c.id).toBeLessThanOrEqual(maxAge);
      if (c.timing !== 'asap') {
        expect(c.timing.jitter.min, c.id).toBeGreaterThanOrEqual(c.ageRange.min);
        expect(c.timing.jitter.max, c.id).toBeLessThanOrEqual(c.ageRange.max);
      }
    }
  });

  /** designer의 최종 문구 (docs/design/copy.md 7-1절, 2026-10-19; ④ 이별 변형은 M7c r2 D2로 삭제) — 사람이 옮겨 적은 기대값. 글자 수는 {이름}을 5자로 센 값(이름 최대 길이, T01) */
  const FINAL: Array<{ where: string; get: () => string; text: string; len: number }> = [
    { where: '① 기본', get: () => card(ID.infant).prompt, text: '다섯 살 무렵을 떠올려 보면, {이름}에게 기억나는 장면이나 느낌이 있습니까?', len: 44 },
    { where: '② 기본', get: () => card(ID.teen).prompt, text: '누군가가 부럽거나 샘이 났던 순간이 {이름}에게도 있습니까?', len: 34 },
    { where: '③ first_love', get: () => card(ID.love).variants![0].prompt, text: '마음을 전했던 그때를 떠올려 보면, {이름}에게 남아 있는 장면이나 느낌이 있습니까?', len: 48 },
    { where: '③ 기본', get: () => card(ID.love).prompt, text: '처음 누군가에게 마음이 갔던 기억이 {이름}에게 있습니까?', len: 33 },
    { where: '④ has_partner·married', get: () => card(ID.romance).variants![0].prompt, text: '함께하는 사람과 보낸 시간 가운데 {이름}에게 오래 남은 장면이 있습니까?', len: 42 },
    { where: '④ 기본', get: () => card(ID.romance).prompt, text: '누군가를 만나 마음을 나누는 일에 대해, {이름}에게 떠오르는 생각이 있습니까?', len: 45 },
    { where: '⑤ 기본', get: () => card(ID.illness).prompt, text: '몸이 아팠던 시간을 떠올려 보면, {이름}에게 남아 있는 마음이나 장면이 있습니까?', len: 47 },
    { where: '⑥ 기본', get: () => card(ID.parents).prompt, text: '부모님이 예전보다 나이 들었다고 느낀 순간이 {이름}에게 있습니까?', len: 38 },
    { where: '⑦ 기본', get: () => card(ID.midlife).prompt, text: '살아온 시간을 돌아보는 지금, {이름}에게 인생은 어떤 것처럼 느껴집니까?', len: 42 },
    { where: '수동', get: () => NOTE_MANUAL.prompt, text: '지금 {이름}의 마음에 남아 있는 장면이나 생각이 있습니까?', len: 34 },
  ];

  it('질문: 10문장이 designer 최종 문구(copy.md 7-1)와 글자까지 같고, {이름}을 5자로 센 길이가 표와 같다 (한 문장 ≤ 52자)', () => {
    const counted = (p: string) => p.replaceAll('{이름}', '가가가가가').length;
    for (const q of FINAL) {
      expect(q.get(), q.where).toBe(q.text);
      expect(counted(q.text), `${q.where}: ${counted(q.text)}자 (표 ${q.len}자)`).toBe(q.len);
      expect(q.len).toBeLessThanOrEqual(52);
    }
    expect(FINAL).toHaveLength(10);
    // 데이터에 있는 모든 질문이 위 10문장뿐이다 (표에 없는 문장이 몰래 늘지 않는다)
    const all = [NOTE_MANUAL.prompt, ...NOTE_CARDS.flatMap((c) => [c.prompt, ...(c.variants ?? []).map((v) => v.prompt)])];
    expect(all.sort()).toEqual(FINAL.map((q) => q.text).sort());
    expect(NOTE_MANUAL.topic).toBe('지금의 생각');
    // 연표 라벨 주제 (copy.md 7-1 끝, 모두 ≤ 7자)
    expect(NOTE_CARDS.map((c) => c.topic)).toEqual(['영유아기 기억', '또래와 나', '첫사랑', '마음을 나누는 일', '아팠던 시간', '부모님의 나이듦', '중년의 인생']);
  });

  it('최종 문구의 바뀐 점이 지켜진다: ①②⑥은 「있습니까?」 끝, 수동 질문은 「{이름}의 마음에」, 초안의 「이던 때」·「있었습니까」·「쏠렸던」·「만나고」는 없다', () => {
    const all = [NOTE_MANUAL.prompt, ...NOTE_CARDS.flatMap((c) => [c.prompt, ...(c.variants ?? []).map((v) => v.prompt)])].join(' | ');
    for (const old of ['이던 때', '있었습니까', '쏠렸던', '만나고', '{이름}에게 마음에']) expect(all, old).not.toContain(old);
    expect(NOTE_MANUAL.prompt).toContain('{이름}의 마음에');
    expect(card(ID.infant).prompt).toContain('다섯 살 무렵');
  });
});

describe('질문 lint (R7·S1~S4·R8)', () => {
  it('실제 notes.json은 문구 점검을 통과한다', () => {
    expect(lintNoteFile({ manual: NOTE_MANUAL, cards: [...NOTE_CARDS] })).toEqual([]);
  });

  it('모든 질문(기본·변형·수동 — 10문장): 한 문장, 물음표 하나, 합쇼체 「있습니까?」류 끝, 느낌표·이모지·마침표 없음, 조사는 에게·에게도·의뿐', () => {
    const all = [NOTE_MANUAL.prompt, ...NOTE_CARDS.flatMap((c) => [c.prompt, ...(c.variants ?? []).map((v) => v.prompt)])];
    expect(all).toHaveLength(10);
    for (const p of all) {
      expect(p.match(/\?/g), p).toHaveLength(1);
      expect(p.endsWith('?'), p).toBe(true);
      expect(/(?:있습니까|있었습니까|느껴집니까)\?$/.test(p), p).toBe(true);
      expect(/[!.…]/.test(p), p).toBe(false);
      for (const m of p.matchAll(/\{이름\}(.{0,3})/g)) expect(/^(?:에게도|에게|의)/.test(m[1]), `${p} → 이름 뒤 「${m[1]}」`).toBe(true);
      expect(notePromptProblems(p, 'x')).toEqual([]);
    }
  });

  it('lint가 실제로 잡는다(공허 통과 방지): 안전 낱말·이유 캐묻기·감정 낱말·이/가 조사·긴 문장·이모지·시대 낱말·잘못된 끝', () => {
    const base = '다섯 살이던 때를 떠올려 보면, {이름}에게 기억나는 장면이 있습니까?';
    expect(notePromptProblems(base, 'x')).toEqual([]);
    const bad: Array<[string, RegExp]> = [
      ['죽음을 떠올려 보면, {이름}에게 남은 장면이 있습니까?', /안전 기준/],
      ['학대받은 때를 떠올려 보면, {이름}에게 남은 장면이 있습니까?', /안전 기준/],
      ['왜 그랬는지 {이름}에게 기억나는 장면이 있습니까?', /원인·이유/],
      ['그 일 때문에 {이름}에게 남은 장면이 있습니까?', /원인·이유/],
      ['슬픔이 컸던 때를 떠올려 보면, {이름}에게 남은 장면이 있습니까?', /감정 낱말/],
      ['후회되는 장면이 {이름}에게 있습니까?', /감정 낱말/],
      ['다섯 살이던 때를 떠올려 보면, {이름}이 기억나는 장면이 있습니까?', /{이름} 뒤에는/],
      ['다섯 살이던 때를 떠올려 보면, {이름}은 기억나는 장면이 있습니까?', /{이름} 뒤에는/],
      ['다섯 살이던 때를 떠올려 보면서 오래도록 곰곰이 생각해 보았을 때 {이름}에게 기억나는 장면이나 느낌이 있습니까?', /52자를 넘는다/],
      ['다섯 살이던 때를 떠올려 보면, {이름}에게 기억나는 장면이 있습니까? 있습니까?', /물음표가 정확히 하나/],
      ['다섯 살이던 때를 떠올려 보면, {이름}에게 기억나는 장면이 있습니다.', /물음표가 정확히 하나|끝나야/],
      ['다섯 살이던 때를 떠올려 보면, {이름}에게 기억나는 장면이 있습니까!', /느낌표|물음표가 정확히 하나|끝나야/],
      ['다섯 살이던 때를 떠올려 보면, {이름}에게 기억나는 장면이 있나요?', /끝나야/],
      [`다섯 살이던 때를 떠올려 보면, {이름}에게 기억나는 장면이 ${String.fromCodePoint(0x1f600)} 있습니까?`, /이모지/],
      ['다섯 살이던 때를 떠올려 보면, {name}에게 기억나는 장면이 있습니까?', /자리 표시/],
      ['다섯 살이던 때를 떠올려 보면, {이름}에게 기억나는 장면이 있습니까.', /마침표|물음표/],
    ];
    for (const [prompt, re] of bad) expect(notePromptProblems(prompt, 'x').join('\n'), prompt).toMatch(re);
    // 시대 낱말(R8): 지난 세상에서 어울리지 않는 낱말은 카드의 시대에 따라 걸린다
    expect(notePromptProblems('스마트폰을 처음 만졌던 때를 떠올려 보면, {이름}에게 기억나는 장면이 있습니까?', 'x', ['past']).join('\n')).toMatch(/시대/);
    expect(notePromptProblems('스마트폰을 처음 만졌던 때를 떠올려 보면, {이름}에게 기억나는 장면이 있습니까?', 'x', ['present'])).toEqual([]);
  });

  it('금지·주의 낱말 목록이 설명서 1-2절과 같다 (S1·S2·S4)', () => {
    expect([...NOTE_SAFETY_WORDS]).toEqual(['자살', '자해', '목숨', '죽', '학대', '폭행', '폭력', '구타', '성폭', '성추행', '강간', '트라우마']);
    expect([...NOTE_CAUSE_WORDS]).toEqual(['왜', '어째서', '이유', '때문']);
    for (const w of ['행복', '기쁨', '슬픔', '외로움', '후회', '분노', '두려움']) expect(NOTE_EMOTION_WORDS.some((x) => x.startsWith(w.slice(0, 2)) || w.startsWith(x)), w).toBe(true);
    // 주제 낱말(부럽다·샘·아팠다·나이 들다·헤어짐)은 감정 목록에 없다
    for (const topic of ['부럽', '샘', '아팠', '나이 들', '헤어진']) expect(NOTE_EMOTION_WORDS.some((w) => topic.includes(w)), topic).toBe(false);
    for (const era of ERAS) for (const w of ERA_BANNED_WORDS[era]) for (const c of NOTE_CARDS) expect([c.prompt, ...(c.variants ?? []).map((v) => v.prompt)].some((p) => p.includes(w) && (c.eras ?? ERAS).includes(era)), `${c.id} ${w}`).toBe(false);
  });

  it('S3 전제 대조: 질문이 전제하는 것은 그 질문이 쓰이는 조건이 보증한다 — 조건 밖에는 중립 문장이다', () => {
    // [카드, 변형 번호 또는 기본, 질문이 전제하는 말, 그 전제를 보증하는 조건 설명]
    const premises: Array<{ id: string; variant: number | 'base'; word: string; guard: (c: NoteCardDef, v: number | 'base') => boolean }> = [
      { id: ID.love, variant: 0, word: '마음을 전했던', guard: (c) => JSON.stringify(c.variants![0].when) === JSON.stringify({ flags: ['first_love'] }) },
      { id: ID.romance, variant: 0, word: '함께하는 사람', guard: (c) => JSON.stringify(c.variants![0].when) === JSON.stringify([{ flags: ['has_partner'] }, { flags: ['married'] }]) },
      { id: ID.illness, variant: 'base', word: '아팠던', guard: (c) => c.triggers !== undefined && c.triggers.length === 2 },
      { id: ID.parents, variant: 'base', word: '부모님이', guard: (c) => c.conditions?.parentAge?.min === 65 && c.conditions.notFlags?.includes('parents_gone') === true },
    ];
    for (const p of premises) {
      const c = card(p.id);
      const prompt = p.variant === 'base' ? c.prompt : c.variants![p.variant].prompt;
      expect(prompt, `${p.id} ${p.variant}`).toContain(p.word);
      expect(p.guard(c, p.variant), `${p.id} ${p.variant}: 전제 「${p.word}」를 보증하는 조건`).toBe(true);
    }
    // 전제 낱말은 조건 밖의 기본 문장에 새어 나오지 않는다
    for (const w of ['마음을 전했던', '헤어진', '함께하는 사람']) {
      for (const c of NOTE_CARDS) expect(c.prompt.includes(w), `${c.id} 기본 문장에 「${w}」`).toBe(false);
    }
    expect(NOTE_MANUAL.prompt).not.toMatch(/마음을 전했던|헤어진|함께하는 사람|아팠던|부모님/);
  });
});

describe('validateNoteFile / noteCardPoolProblems: 데이터 검증이 실제로 잡는다', () => {
  const raw = NOTE_FILE_RAW as NoteFile;
  const clone = (): NoteFile => JSON.parse(JSON.stringify(raw)) as NoteFile;
  const mutate = (fn: (f: NoteFile) => void): unknown => {
    const f = clone();
    fn(f);
    return f;
  };
  const problemsOf = (input: unknown): string => {
    try {
      validateNoteFile(input);
    } catch (e) {
      expect(e).toBeInstanceOf(NoteDataError);
      return (e as NoteDataError).problems.join('\n');
    }
    return '';
  };

  it('실제 파일은 통과하고 번호 순 7장을 돌려준다', () => {
    const v = validateNoteFile(raw);
    expect(v.cards.map((c) => c.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(v.manual.topic).toBe('지금의 생각');
  });

  it('잘못된 데이터: 최상위·알 수 없는 항목·id 형식·id 중복·번호 중복·수동 id·주제 기호·나이 창·흔들림 범위·조건·변형·인용 모양', () => {
    expect(problemsOf(null)).toMatch(/최상위/);
    expect(problemsOf(mutate((f) => Object.assign(f, { extra: 1 })))).toMatch(/알 수 없는 항목 "extra"/);
    expect(problemsOf(mutate((f) => delete (f as unknown as Record<string, unknown>).manual))).toMatch(/"manual"/);
    expect(problemsOf(mutate((f) => (f.cards[0].id = 'infant-memory')))).toMatch(/note-/);
    expect(problemsOf(mutate((f) => (f.cards[0].id = MANUAL_NOTE_ID)))).toMatch(/수동 기록 전용/);
    expect(problemsOf(mutate((f) => (f.cards[1].id = f.cards[0].id)))).toMatch(/중복/);
    expect(problemsOf(mutate((f) => (f.cards[1].order = f.cards[0].order)))).toMatch(/번호.*중복/);
    expect(problemsOf(mutate((f) => (f.cards[0].topic = '기억 · 어릴 때')))).toMatch(/한글과 공백/);
    expect(problemsOf(mutate((f) => (f.cards[0].ageRange = { min: 9, max: 5 })))).toMatch(/ageRange/);
    expect(problemsOf(mutate((f) => (f.cards[1].timing = { jitter: { min: 10, max: 17 } })))).toMatch(/ageRange.*안이어야/);
    expect(problemsOf(mutate((f) => (f.cards[1].timing = 'later' as never)))).toMatch(/timing/);
    expect(problemsOf(mutate((f) => (f.cards[5].conditions = { flags: [] } as never)))).toMatch(/flags/);
    expect(problemsOf(mutate((f) => (f.cards[5].conditions = { gold: 1 } as never)))).toMatch(/알 수 없는 항목/);
    expect(problemsOf(mutate((f) => (f.cards[2].variants = [{ when: [], prompt: '질문은 열 글자 이상이어야 합니다 있습니까?' }])))).toMatch(/조건 배열/);
    expect(problemsOf(mutate((f) => (f.cards[4].triggers = [{}])))).toMatch(/비어 있으면/);
    expect(problemsOf(mutate((f) => (f.cards[4].unlessSeen = ['Bad Id'])))).toMatch(/이벤트 id 형식/);
    expect(problemsOf(mutate((f) => (f.cards[0].citation = 'c-37')))).toMatch(/인용 id 형식/);
    expect(problemsOf(mutate((f) => (f.cards[1].noCitation = 'Q' as never)))).toMatch(/사유 코드/);
    expect(problemsOf(mutate((f) => Object.assign(f.cards[0], { noCitation: 'D' })))).toMatch(/함께 쓸 수 없다/);
    expect(problemsOf(mutate((f) => (f.cards[0].maxLength = 141)))).toMatch(/maxLength/);
    expect(problemsOf(mutate((f) => (f.cards[0].prompt = '짧음')))).toMatch(/길이는/);
    expect(problemsOf(mutate((f) => (f.cards[0].prompt = ` ${f.cards[0].prompt}`)))).toMatch(/앞뒤 공백/);
  });

  it('noteCardPoolProblems: 읽는 플래그가 켜지는지·seenAny/unlessSeen이 실제 이벤트인지·이벤트 id와 겹치지 않는지 (실제 데이터는 0건)', () => {
    expect(noteCardPoolProblems(NOTE_CARDS, EVENT_POOL.events)).toEqual([]);
    expect([...noteFlagsRead(card(ID.romance))].sort()).toEqual(['has_partner', 'married']);
    expect([...noteFlagsRead(card(ID.parents))]).toEqual(['parents_gone']);
    expect([...noteFlagsRead(card(ID.love))]).toEqual(['first_love']);
    const typo = { ...card(ID.love), variants: [{ when: { flags: ['first_luv'] }, prompt: card(ID.love).prompt }] };
    expect(noteCardPoolProblems([typo], EVENT_POOL.events).join('\n')).toContain('first_luv');
    expect(noteCardPoolProblems([{ ...card(ID.illness), unlessSeen: ['no-such-event'] }], EVENT_POOL.events).join('\n')).toContain('no-such-event');
    expect(noteCardPoolProblems([card(ID.infant)], [{ ...EVENT_POOL.events[0], id: ID.infant }]).join('\n')).toContain('같은 id의 이벤트');
  });
});

describe('인용 (FR2·NC-9): ①만 c-102(r4 QI13 — 옛 경제학 논문 c-037을 심리·아동학 논문으로 교체), 나머지는 인용 박스를 그리지 않는다 — 기록 카드는 MD2 판정에 들지 않는다', () => {
  const YEAR: Record<Era, number> = { past: 1980, present: 2031, future: 2060 };

  it('① note-infant-memory는 c-102이고(경제학 논문 c-037은 아니다 — UX13-4) 나머지 여섯은 citation 없이 사유 코드만 있다 (② ③ ④ ⑥ ⑦ D, ⑤ X1)', () => {
    expect(card(ID.infant).citation).toBe('c-102');
    expect(card(ID.infant).citation).not.toBe('c-037'); // 5세 카드에 경제학 논문을 다시 붙이지 않는다
    expect(card(ID.infant).noCitation).toBeUndefined();
    const reasons: Record<string, string> = { [ID.teen]: 'D', [ID.love]: 'D', [ID.romance]: 'D', [ID.illness]: 'X1', [ID.parents]: 'D', [ID.midlife]: 'D' };
    for (const [id, code] of Object.entries(reasons)) {
      expect(card(id).citation, id).toBeUndefined();
      expect(card(id).noCitation, id).toBe(code);
    }
    // c-036·c-038 예약은 풀렸다 — 어느 기록 카드도 쓰지 않는다
    for (const c of NOTE_CARDS) expect(JSON.stringify(c.citation ?? ''), c.id).not.toMatch(/c-036|c-038/);
  });

  it('① 인용은 세 세상 모두에서 보이고 표시 문자열(머리말 + 요약)이 100자 이하이며, 머리말이 세상마다 맞다 (지난 「지금의 연구로는」 / 지금 없음 / 다가올 「지금 기준으로는」)', () => {
    const c = getCitation('c-102')!;
    expect(c.kind).toBe('research');
    expect(c.eras).toEqual(['past', 'present', 'future']);
    const view = (era: Era) => citationFor(card(ID.infant), era, YEAR[era]);
    for (const era of ERAS) {
      const v = view(era);
      expect(v, era).not.toBeNull();
      expect(v!.id).toBe('c-102');
      expect([...v!.text].length, `${era} 표시 문자열 ${[...v!.text].length}자`).toBeLessThanOrEqual(100);
    }
    expect(view('past')!.text.startsWith('지금의 연구로는 ')).toBe(true);
    expect(view('present')!.text).toBe(c.text);
    expect(view('future')!.text.startsWith('지금 기준으로는 ')).toBe(true);
    // 인용 박스 링크·DOI·URL을 그리지 않는다(EV6): 출처 줄에 주소가 없다
    for (const era of ERAS) expect(view(era)!.sourceLine).not.toMatch(/https?:|doi|10\.1126|pubmed|accesson/i);
  });

  it('나머지 카드 × 세 세상은 보일 인용이 없다(null) — 빈 박스 0', () => {
    for (const c of NOTE_CARDS.filter((x) => x.id !== ID.infant)) for (const era of ERAS) expect(citationFor(c, era, YEAR[era]), `${c.id} ${era}`).toBeNull();
  });

  it('연결 점검(citationLinkProblems)과 usedBy 양방향: c-102.usedBy는 note-infant-memory 하나이고 옛 c-037은 어느 카드에도 연결되지 않는다 (r4 QI13)', () => {
    expect(citationLinkProblems([], CITATION_TABLE, NOTE_CARDS)).toEqual([]);
    expect(getCitation('c-102')!.usedBy).toEqual([ID.infant]);
    expect(getCitation('c-037')!.usedBy, '경제학 논문 c-037 연결 0').toEqual([]);
    expect(citationLinkProblems([], CITATION_TABLE, [{ ...card(ID.infant), citation: 'c-999' }])[0]).toContain('기록 카드');
    expect(citationLinkProblems([], CITATION_TABLE.map((x) => (x.id === 'c-102' ? { ...x, usable: false } : x)), NOTE_CARDS)[0]).toContain('쓸 수 없다');
  });

  it('MD2 판정(정적 연결률·서로 다른 인용 수)에 기록 카드가 들지 않는다 — c-102는 이벤트에 연결되지 않았으므로 분모·분자 어디에도 없다', () => {
    expect(connectedCitationIds(EVENT_POOL.events)).not.toContain('c-102');
    expect(connectedCitationIds(EVENT_POOL.events)).not.toContain('c-037');
    const cov = citationCoverage(EVENT_POOL.events);
    for (const era of ERAS) {
      expect(cov[era].ids.some((id) => id.startsWith('note-')), era).toBe(false);
      expect(cov[era].rate, `1차 게이트 ${era}`).toBeGreaterThanOrEqual(CITATION_COVERAGE_MIN[era]);
      // 분모는 선택지 이벤트뿐이다
      expect(cov[era].total).toBe(EVENT_POOL.events.filter((e) => e.choices !== undefined && (e.eras === undefined || e.eras.includes(era))).length);
    }
  });

  it('calendarYear로 만든 실제 게임 속 연도에서도 ① 인용이 보인다 (세대 표본의 출생 첫 해·마지막 해 5세)', () => {
    for (const profile of SIM_PROFILES) {
      const { from, to } = generationDef(profile as GenerationId).birth;
      for (const birthYear of [from, to]) {
        const year = calendarYear(birthYear, 5);
        expect(citationFor(card(ID.infant), eraBucketOf(profile, year), year), `${profile} ${birthYear}`).not.toBeNull();
      }
    }
  });
});

// ---------- dueNote ----------

describe('dueNote 표 시험: 카드별 조건·시기·변형·창', () => {
  it('① 정확히 5세에만 뜬다 (4세·6세는 없다). 이미 본 카드·대기 중인 선택지·인생 단계 밖이면 뜨지 않는다', () => {
    expect(dueId(stateAt(4))).toBeNull();
    expect(dueId(stateAt(5))).toBe(ID.infant);
    expect(dueId(stateAt(6))).toBeNull();
    expect(dueId(stateAt(5, { seen: { [ID.infant]: 5 } }))).toBeNull();
    expect(dueId(stateAt(5, { pending: true })), '대기 중인 선택지가 있으면 해의 첫머리가 아니다').toBeNull();
    for (const phase of ['title', 'roulette', 'birth', 'ending'] as const) expect(dueNote({ ...stateAt(5), phase }), phase).toBeNull();
    expect(dueNote({ ...stateAt(5), character: null })).toBeNull();
  });

  it('모든 카드는 모든 세대에 나온다 (eras 생략)', () => {
    for (const profile of SIM_PROFILES) expect(dueId(stateAt(5, { profile })), profile).toBe(ID.infant);
  });

  it('② 13~17세의 시드로 정해진 나이에 뜬다: 흔들림은 13~17 안, 같은 시드는 늘 같은 나이, 시드마다 다르고 다섯 값이 모두 나온다', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const base = (age: number) => stateAt(age, { seed, seen: { [ID.infant]: 5 } });
      const at = firstDueAge(base, ID.teen, 6, 30)!;
      expect(at, `시드 ${seed}`).toBeGreaterThanOrEqual(13);
      expect(at).toBeLessThanOrEqual(17);
      expect(at, `시드 ${seed}: noteJitterAge`).toBe(noteJitterAge(card(ID.teen), seed));
      expect(firstDueAge(base, ID.teen, 6, 30), '같은 시드 → 같은 나이').toBe(at);
      seen.add(at);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([13, 14, 15, 16, 17]);
  });

  it('③ first_love 플래그가 켜져 있으면 15세 첫 적격 해에 바로, 없으면 시드로 정한 18~22세에 뜬다. 15세 전에는 플래그가 있어도 안 뜬다', () => {
    const withFlag = (age: number, seed = 5) => stateAt(age, { seed, flags: ['first_love'], seen: { [ID.infant]: 5, [ID.teen]: 13 } });
    expect(dueId(withFlag(14))).toBeNull();
    expect(dueId(withFlag(15))).toBe(ID.love);
    expect(notePromptOf(card(ID.love), withFlag(15))).toBe(card(ID.love).variants![0].prompt);
    const ages = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const without = (age: number) => stateAt(age, { seed, seen: { [ID.infant]: 5, [ID.teen]: 13 } });
      const at = firstDueAge(without, ID.love, 15, 25)!;
      expect(at, `시드 ${seed}`).toBeGreaterThanOrEqual(18);
      expect(at).toBeLessThanOrEqual(22);
      expect(at).toBe(noteJitterAge(card(ID.love), seed));
      expect(notePromptOf(card(ID.love), without(at)), '플래그가 없으면 중립 문장').toBe(card(ID.love).prompt);
      ages.add(at);
    }
    expect([...ages].sort((a, b) => a - b)).toEqual([18, 19, 20, 21, 22]);
  });

  it('④ has_partner · married 중 하나가 켜지면 20세 첫 적격 해에 바로 뜨고 변형 문장이 맞다. 없으면(이별만 켜진 판 포함) 시드로 정한 27~32세 — 이별 변형은 없다(M7c r2 D2)', () => {
    const base = { seen: { [ID.infant]: 5, [ID.teen]: 13, [ID.love]: 18 } };
    const prompt = (flags: string[]) => notePromptOf(card(ID.romance), stateAt(25, { flags, ...base }));
    const [partnered, neutral] = [card(ID.romance).variants![0].prompt, card(ID.romance).prompt];
    expect(dueId(stateAt(19, { flags: ['has_partner'], ...base }))).toBeNull();
    for (const flags of [['has_partner'], ['married'], ['has_partner', 'married']]) expect(dueId(stateAt(20, { flags, ...base })), flags.join()).toBe(ID.romance);
    // 이별만 켜진 판은 일찍 뜨지 않고(변형이 없다) 중립 문장이다. 「헤어진」 문장은 데이터 어디에도 없다 (잔존 0)
    expect(dueId(stateAt(20, { flags: ['broke_up'], ...base })), '이별만으로는 일찍 뜨지 않는다').toBeNull();
    expect(prompt(['broke_up'])).toBe(neutral);
    expect(JSON.stringify(NOTE_CARDS), '데이터에 broke_up·헤어진 문장이 없다').not.toMatch(/broke_up|헤어진/);
    expect(prompt(['has_partner'])).toBe(partnered);
    expect(prompt(['married'])).toBe(partnered);
    expect(prompt(['broke_up', 'has_partner']), 'broke_up과 has_partner가 함께여도 함께하는 사람 문장').toBe(partnered);
    expect(prompt(['broke_up', 'married'])).toBe(partnered);
    expect(prompt([])).toBe(neutral);
    expect(prompt(['first_love'])).toBe(neutral);
    const ages = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const at = firstDueAge((age) => stateAt(age, { seed, ...base }), ID.romance, 20, 34)!;
      expect(at).toBe(noteJitterAge(card(ID.romance), seed));
      expect(at).toBeGreaterThanOrEqual(27);
      expect(at).toBeLessThanOrEqual(32);
      ages.add(at);
    }
    expect([...ages].sort((a, b) => a - b)).toEqual([27, 28, 29, 30, 31, 32]);
  });

  it('⑤ 큰 병 사건(middle-health-crisis·senior-illness)을 본 뒤 첫 해에 뜬다. 건강 ≤ 35이고 35세 이상이어도 뜬다. senior-illness-later를 본 판·창 밖(30세 전·85세 뒤)·건강이 괜찮은 판은 안 뜬다', () => {
    // 다른 카드는 모두 본 것으로 둔다(⑤ 조건만 가려 보려고). 마지막 카드 나이가 시험 나이보다 2년 이상 앞서야 간격에 걸리지 않는다
    const early = { [ID.infant]: 5, [ID.teen]: 13, [ID.love]: 18, [ID.romance]: 22, [ID.parents]: 26 };
    const mid = { ...early, [ID.midlife]: 47 };
    for (const ev of ['middle-health-crisis', 'senior-illness']) {
      expect(dueId(stateAt(50, { seen: { ...mid, [ev]: 49 } })), ev).toBe(ID.illness);
      expect(dueId(stateAt(50, { seen: { ...mid, [ev]: 49, 'senior-illness-later': 50 } })), `${ev} + 임종에 가까운 사건`).toBeNull();
    }
    expect(dueId(stateAt(50, { seen: mid, health: 36 })), '건강 36').toBeNull();
    expect(dueId(stateAt(50, { seen: mid, health: 35 })), '건강 35').toBe(ID.illness);
    expect(dueId(stateAt(34, { seen: early, health: 20 })), '35세 전').toBeNull();
    expect(dueId(stateAt(35, { seen: early, health: 20 })), '35세').toBe(ID.illness);
    expect(dueId(stateAt(29, { seen: { ...early, 'middle-health-crisis': 28 } })), '30세 전').toBeNull();
    expect(dueId(stateAt(86, { seen: { ...mid, 'senior-illness': 80 } })), '85세 뒤').toBeNull();
    expect(dueId(stateAt(85, { seen: { ...mid, 'senior-illness': 80 } })), '85세').toBe(ID.illness);
  });

  it('⑥ 두 부모 중 나이 많은 쪽의 지금 나이가 65 이상일 때 뜬다: 25세·부모 40+40 → 65 / 24세는 아직 / parents_gone이면 안 뜬다 / 60세 뒤는 안 뜬다', () => {
    const seen = { [ID.infant]: 5, [ID.teen]: 13, [ID.love]: 18, [ID.romance]: 22 };
    expect(dueId(stateAt(24, { seen, parentAges: [40, 40] }))).toBeNull();
    expect(dueId(stateAt(25, { seen, parentAges: [40, 40] }))).toBe(ID.parents);
    expect(dueId(stateAt(25, { seen, parentAges: [30, 40] })), '나이 많은 쪽(아버지 40)').toBe(ID.parents);
    expect(dueId(stateAt(25, { seen, parentAges: [39, 38] }))).toBeNull();
    expect(dueId(stateAt(40, { seen, parentAges: [39, 38], flags: ['parents_gone'] }))).toBeNull();
    expect(dueId(stateAt(61, { seen, parentAges: [45, 45] }))).toBeNull();
    expect(dueId(stateAt(60, { seen, parentAges: [45, 45] }))).toBe(ID.parents);
  });

  it('⑦ 시드로 정한 47~53세에 뜬다 (45·46세에는 안 뜨고 55세 뒤는 없다)', () => {
    const seen = { [ID.infant]: 5, [ID.teen]: 13, [ID.love]: 18, [ID.romance]: 22, [ID.parents]: 26 };
    const ages = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const at = firstDueAge((age) => stateAt(age, { seed, seen }), ID.midlife, 45, 60)!;
      expect(at).toBe(noteJitterAge(card(ID.midlife), seed));
      expect(at).toBeGreaterThanOrEqual(47);
      expect(at).toBeLessThanOrEqual(53);
      ages.add(at);
    }
    expect([...ages].sort((a, b) => a - b)).toEqual([47, 48, 49, 50, 51, 52, 53]);
    expect(dueId(stateAt(56, { seen }))).toBeNull();
  });

  it('간격: 마지막 자동 카드와 2년 이상 떨어져야 하고(소비한 카드도 센다), 간격 때문에 못 뜬 카드는 자기 창 안에서 다음 적격 해에 뜬다', () => {
    const flags = ['first_love'];
    // ②를 15세에 보였다 → ③(first_love)은 15·16세에 못 뜨고 17세에 뜬다
    const after = (age: number) => stateAt(age, { seed: 5, flags, seen: { [ID.infant]: 5, [ID.teen]: 15 } });
    expect(dueId(after(15))).toBeNull();
    expect(dueId(after(16))).toBeNull();
    expect(dueId(after(17))).toBe(ID.love);
    // 창이 끝나면 사라진다: ①(5세)을 6세에 못 보였으면(간격 때문이 아니라 창이 5세뿐) 다시는 안 뜬다
    for (const age of [6, 7, 20]) expect(dueId(stateAt(age)), `${age}세`).not.toBe(ID.infant);
  });

  it('같은 해에 둘 이상 적격이면 카드 번호가 작은 쪽이 먼저다 (②와 ③)', () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((s) => noteJitterAge(card(ID.teen), s) <= 16)!;
    const g = stateAt(16, { seed, flags: ['first_love'], seen: { [ID.infant]: 5 } });
    expect(noteJitterAge(card(ID.teen), seed)).toBeLessThanOrEqual(16);
    expect(dueId(g)).toBe(ID.teen);
    expect(dueId(consumeNote(g, card(ID.teen)))).toBeNull(); // 같은 해 둘째는 없다
    expect(dueId({ ...consumeNote(g, card(ID.teen)), age: 18 })).toBe(ID.love);
  });

  it('판당 자동 카드는 7장을 넘지 않는다: 일곱 장을 본 판은 더 뜨지 않는다', () => {
    const all = Object.fromEntries(NOTE_CARDS.map((c, i) => [c.id, 5 + i * 3]));
    expect(dueNote({ ...stateAt(60), seen: all })).toBeNull();
    const six = { ...all };
    delete six[ID.midlife];
    expect(dueNote({ ...stateAt(53), seen: six })?.id ?? null).toBe(ID.midlife);
  });

  it('순수하다: 같은 상태 → 같은 답, 입력을 바꾸지 않고, rngState를 쓰지 않는다 (상태가 같으면 rngState가 달라도 같다)', () => {
    const g = Object.freeze({ ...stateAt(5), seen: Object.freeze({}), flags: Object.freeze([]) as unknown as string[] }) as GameState;
    expect(dueNote(g)).toBe(dueNote(g));
    expect(dueNote({ ...g, rngState: 123 })).toBe(dueNote({ ...g, rngState: 456 }));
    expect(g.seen).toEqual({});
    // 흔들림은 시드(game.seed)로만 정해진다
    expect(noteJitterAge(card(ID.teen), 1)).toBe(noteJitterAge(card(ID.teen), 1));
    expect(new Set(Array.from({ length: 50 }, (_, s) => noteJitterAge(card(ID.teen), s))).size).toBeGreaterThan(1);
    expect(noteJitterAge(card(ID.infant), 99), 'asap은 창의 첫 해').toBe(5);
  });

  it('noteQuestion: 변형 선택과 {이름} 채우기, 수동 기록은 고정 질문', () => {
    const g = stateAt(5);
    expect(noteQuestion(card(ID.infant), g)).toBe(`다섯 살 무렵을 떠올려 보면, ${g.character!.name}에게 기억나는 장면이나 느낌이 있습니까?`);
    expect(noteQuestion(null, g)).toBe(`지금 ${g.character!.name}의 마음에 남아 있는 장면이나 생각이 있습니까?`);
    expect(noteQuestion(card(ID.infant), g)).not.toContain('{');
  });
});

// ---------- 소비 · 정지 ----------

describe('advanceUntilDecision의 기록 카드 옵션 (ignore · stop · consume)', () => {
  const start = startLife(2, 'alpha');

  it('기본(ignore)은 카드를 보지 않아 기존 동작과 같다: seen에 note- 키가 없고, 옵션을 명시한 ignore와 상태가 같다', () => {
    const base = advanceUntilDecision(start);
    const explicit = advanceUntilDecision(start, undefined, 'ignore');
    expect(explicit.state).toEqual(base.state);
    expect(explicit.stoppedForNote).toBeUndefined();
    expect(Object.keys(base.state.seen).some((k) => k.startsWith('note-'))).toBe(false);
  });

  it('stop: 카드가 뜰 차례인 해의 첫머리에서 멈추고 카드를 알려 준다. 카드를 처리하면 이어서 간다. 이미 그 자리면 한 걸음도 가지 않는다', () => {
    let g: GameState = start;
    let guard = 0;
    for (;;) {
      if (guard++ > 20) throw new Error('5세에 닿지 못했다');
      if (g.pending !== null) {
        g = sessionReducer(createSession(g, { speed: 1, autoMode: false }), { type: 'choose', key: g.pending.key, choiceId: g.pending.choiceIds[0] }, undefined, 'ignore').game;
        continue;
      }
      const r = advanceUntilDecision(g, undefined, 'stop');
      if (r.stoppedForNote !== undefined) {
        expect(r.stoppedForNote.id).toBe(ID.infant);
        expect(r.state.age).toBe(5);
        expect(r.state.pending).toBeNull();
        expect(advanceUntilDecision(r.state, undefined, 'stop').state, '이미 그 자리라면 움직이지 않는다').toBe(r.state);
        expect(advanceUntilDecision(r.state, undefined, 'stop').stoppedForNote?.id).toBe(ID.infant);
        const after = advanceUntilDecision(consumeNote(r.state, r.stoppedForNote), undefined, 'stop');
        expect(after.state.age).toBeGreaterThanOrEqual(5);
        expect(after.stoppedForNote === undefined || after.stoppedForNote.id !== ID.infant).toBe(true);
        return;
      }
      g = r.state;
    }
  });

  it('consume: 멈추지 않고 소비하며 간다 — 인생은 ignore와 같고 seen에 note- 키만 더해진다', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s0 = startLife(seed, 'alpha');
      let a = s0;
      let b = s0;
      for (let i = 0; i < 40 && a.phase === 'life'; i++) {
        const ra = advanceUntilDecision(a, undefined, 'ignore');
        const rb = advanceUntilDecision(b, undefined, 'consume');
        expect(rb.stoppedForNote).toBeUndefined();
        const strip = (g: GameState) => ({ ...g, seen: Object.fromEntries(Object.entries(g.seen).filter(([k]) => !k.startsWith('note-'))) });
        expect(strip(rb.state), `시드 ${seed} #${i}`).toEqual(strip(ra.state));
        a = ra.state;
        b = rb.state;
        if (a.pending !== null && b.pending !== null) {
          const pick = a.pending.choiceIds[0];
          a = sessionReducer(createSession(a, { speed: 1, autoMode: false }), { type: 'choose', key: a.pending.key, choiceId: pick }, undefined, 'ignore').game;
          b = sessionReducer(createSession(b, { speed: 1, autoMode: false }), { type: 'choose', key: b.pending!.key, choiceId: pick }, undefined, 'ignore').game;
        }
      }
      expect(Object.keys(b.seen).some((k) => k.startsWith('note-'))).toBe(true);
    }
  });
});

describe('세션 reducer: 멈춤 · 소비 · 응답 (FR5~FR7)', () => {
  const send = (s: Session, a: SessionAction, handling?: 'live' | 'ignore'): Session => sessionReducer(s, a, undefined, handling);
  const session = (g: GameState, extra: Partial<Parameters<typeof createSession>[1]> = {}) => createSession(g, { speed: 1, autoMode: false, ...extra });
  const at5 = () => stateAt(5);

  it('수동 + 켜짐: 카드가 뜰 차례면 advance·skip이 멈춘다(같은 세션을 돌려준다). 응답하면 진행이 이어진다', () => {
    const s = session(at5());
    expect(noteResponse(s.settings, s.game)).toBe('stop');
    expect(send(s, { type: 'advance', fromAge: 5 })).toBe(s);
    expect(send(s, { type: 'skip' })).toBe(s);
    const dismissed = send(s, { type: 'dismissNote', cardId: ID.infant });
    expect(dueNote(dismissed.game)).toBeNull();
    const moved = send(dismissed, { type: 'advance', fromAge: 5 });
    expect(moved).not.toBe(dismissed);
    expect(moved.game.age === 6 || moved.game.pending !== null).toBe(true);
  });

  it('자동 모드이거나 noteCards가 꺼져 있으면 시트 없이 소비한다: 진행이 막히지 않고 seen에 표시되며 연표 줄이 없다', () => {
    for (const extra of [{ autoMode: true }, { noteCards: false }, { autoMode: true, noteCards: false }]) {
      const s = session(at5(), extra);
      expect(noteResponse(s.settings, s.game), JSON.stringify(extra)).toBe('consume');
      const moved = send(s, { type: 'advance', fromAge: 5 });
      expect(moved.game.seen[ID.infant], JSON.stringify(extra)).toBe(5);
      expect(noteCount(moved.game)).toBe(0);
      expect(moved.game.age === 6 || moved.game.pending !== null).toBe(true);
      const skipped = send(session(at5(), { noteCards: false }), { type: 'skip' });
      expect(skipped.game.seen[ID.infant]).toBe(5);
    }
  });

  it('R-411 기록이 40개에 이르면 자동 카드를 시트 없이 소비한다 — 같은 함수(noteResponse)가 reducer와 화면 파생 판정에 쓰이고, 39개에서는 시트가 뜬다. 진행은 막히지 않고 연표 40줄은 그대로다', () => {
    const withNotes = (g: GameState, n: number): GameState => {
      let out = g;
      for (let i = 0; i < n; i++) {
        const next = writeNote(out, { cardId: null, text: `기록 ${i + 1}` });
        expect(next, `${i + 1}번째 기록`).not.toBe(out);
        out = next;
      }
      return out;
    };
    // 39개: 평소와 같다(멈춤 → 시트)
    const at39 = session(withNotes(at5(), 39));
    expect(noteCount(at39.game)).toBe(39);
    expect(noteResponse(at39.settings, at39.game)).toBe('stop');
    expect(send(at39, { type: 'advance', fromAge: 5 }), '39개에서는 시트가 뜰 차례라 진행이 멈춘다').toBe(at39);
    // 40개: 소비
    const at40 = session(withNotes(at5(), 40));
    expect(noteCount(at40.game)).toBe(40);
    expect(dueId(at40.game), '자동 카드는 여전히 적격이다').toBe(ID.infant);
    expect(noteResponse(at40.settings, at40.game)).toBe('consume');
    const moved = send(at40, { type: 'advance', fromAge: 5 });
    expect(moved).not.toBe(at40);
    expect(moved.game.seen[ID.infant], '소비 표시만 남는다').toBe(5);
    expect(noteCount(moved.game), '연표 40줄 유지').toBe(40);
    expect(moved.game.history.filter((h) => h.kind === 'note').map((h) => h.text)).toEqual(Array.from({ length: 40 }, (_, i) => `기록 ${i + 1}`));
    expect(moved.game.age === 6 || moved.game.pending !== null, '진행이 멈추지 않는다').toBe(true);
    // skip·choose·autoChoose 경로도 같다
    expect(send(at40, { type: 'skip' }).game.seen[ID.infant]).toBe(5);
    const g4 = withNotes(pendingAt(4), 40);
    const key = g4.pending!.key;
    expect(send(session(g4), { type: 'choose', key, choiceId: g4.pending!.choiceIds[0] }).game.seen[ID.infant], 'choose 뒤 새 해 첫머리 카드도 소비').toBe(5);
    expect(send(session(g4, { autoMode: true }), { type: 'autoChoose', key }).game.seen[ID.infant]).toBe(5);
    // 40개 안내 시트는 수동 기록(버튼)으로만 — writeNote는 41번째를 받지 않는다
    expect(writeNote(at40.game, { cardId: null, text: '41번째' })).toBe(at40.game);
    // 같은 해 39개에서 뜬 자동 카드를 1번으로 저장하면 40개가 되고 이후 자동 카드는 소비된다
    const saved = send(at39, { type: 'saveNote', cardId: ID.infant, text: '마흔 번째' });
    expect(noteCount(saved.game)).toBe(40);
    expect(noteResponse(saved.settings, saved.game)).toBe('consume');
    // 조건 하나라도 맞으면 소비는 그대로: 설정 쪽 소비도 40개와 무관하게 소비
    expect(noteResponse({ autoMode: true, noteCards: true }, at39.game)).toBe('consume');
    expect(noteResponse({ autoMode: false, noteCards: false }, at39.game)).toBe('consume');
  });

  it('소비 모드에서는 해를 마친 직후 새 해 첫머리의 카드도 바로 소비한다 (choose·autoChoose 뒤) — 멈춤 모드는 파생이라 소비하지 않는다', () => {
    const g = pendingAt(4);
    const key = g.pending!.key;
    const pick = g.pending!.choiceIds[0];
    const off = send(session(g, { noteCards: false }), { type: 'choose', key, choiceId: pick });
    expect(off.game.age).toBe(5);
    expect(off.game.seen[ID.infant]).toBe(5);
    const auto = send(session(g, { autoMode: true }), { type: 'autoChoose', key });
    expect(auto.game.age).toBe(5);
    expect(auto.game.seen[ID.infant]).toBe(5);
    const manual = send(session(g), { type: 'choose', key, choiceId: pick });
    expect(manual.game.age).toBe(5);
    expect(manual.game.seen[ID.infant], '멈춤 모드는 파생이라 소비하지 않는다').toBeUndefined();
    expect(dueId(manual.game)).toBe(ID.infant);
    // 시트 없는 화면(ignore)도 소비하지 않는다
    expect(send(session(g, { noteCards: false }), { type: 'choose', key, choiceId: pick }, 'ignore').game.seen[ID.infant]).toBeUndefined();
  });

  it('handling = ignore(시트가 없는 화면·시뮬레이션): 진행 액션이 카드를 보지 않는다 — seen·저장이 카드 도입 전과 같다', () => {
    const s = session(at5());
    const moved = send(s, { type: 'advance', fromAge: 5 }, 'ignore');
    expect(moved.game.seen[ID.infant]).toBeUndefined();
    expect(moved.game.age === 6 || moved.game.pending !== null).toBe(true);
    const skipped = send(s, { type: 'skip' }, 'ignore');
    expect(Object.keys(skipped.game.seen).filter((k) => k.startsWith('note-'))).toEqual([]);
  });

  it('dismissNote: 지금 뜰 차례인 카드만 소비하고 연타·다른 카드·카드가 없을 때는 같은 객체다', () => {
    const s = session(at5());
    expect(send(s, { type: 'dismissNote', cardId: ID.teen })).toBe(s);
    const once = send(s, { type: 'dismissNote', cardId: ID.infant });
    expect(once).not.toBe(s);
    expect(once.game.seen[ID.infant]).toBe(5);
    expect(noteCount(once.game)).toBe(0);
    expect(send(once, { type: 'dismissNote', cardId: ID.infant }), '연타').toBe(once);
    const at7 = session(stateAt(7));
    expect(send(at7, { type: 'dismissNote', cardId: ID.infant }), '창이 끝난 카드는 소비할 것이 없다').toBe(at7);
  });

  it('saveNote(자동 카드): 연표에 note 줄을 더하고 카드를 소비한다 — 줄 모양은 나이·종류·주제·글·카드 id. 연타는 한 건', () => {
    const s = session(at5());
    const saved = send(s, { type: 'saveNote', cardId: ID.infant, text: '  마당에서   놀던 기억 ' });
    expect(saved).not.toBe(s);
    const row = saved.game.history.at(-1)!;
    expect(row).toEqual({ age: 5, kind: 'note', title: '영유아기 기억', text: '마당에서 놀던 기억', eventId: ID.infant });
    expect(saved.game.seen[ID.infant]).toBe(5);
    expect(notesOf(saved.game)).toEqual([{ age: 5, cardId: ID.infant, text: '마당에서 놀던 기억' }]);
    expect(send(saved, { type: 'saveNote', cardId: ID.infant, text: '두 번째' }), '이미 소비된 카드').toBe(saved);
    // 스탯·자산·플래그·rngState는 그대로
    for (const k of ['stats', 'assets', 'flags', 'rngState', 'age', 'pending'] as const) expect(saved.game[k], k).toEqual(s.game[k]);
  });

  it('saveNote: 빈 입력(공백만·보이지 않는 글자만)은 기록하지 않고 카드는 그대로 뜬 채다. 다른 카드·문자열이 아닌 글도 무시', () => {
    const s = session(at5());
    for (const text of ['', '   ', '\n\t', String.fromCodePoint(0x3164), String.fromCodePoint(0x200b)]) {
      expect(send(s, { type: 'saveNote', cardId: ID.infant, text }), JSON.stringify(text)).toBe(s);
    }
    expect(dueId(s.game)).toBe(ID.infant);
    expect(send(s, { type: 'saveNote', cardId: ID.teen, text: '글' })).toBe(s);
    expect(send(s, { type: 'saveNote', cardId: ID.infant, text: 7 as unknown as string })).toBe(s);
  });

  it('saveNote(수동 기록, cardId null): 언제든(결정 대기 중·자동 모드·일시정지 중에도) 쓸 수 있고 소비 표시는 없다. 연표 eventId는 note-manual', () => {
    for (const g of [stateAt(30), { ...stateAt(30), paused: true }, stateAt(30, { pending: true })]) {
      const s = session(g, { autoMode: true });
      const saved = send(s, { type: 'saveNote', cardId: null, text: '지금 든 생각' });
      expect(saved.game.history.at(-1)).toEqual({ age: 30, kind: 'note', title: '지금의 생각', text: '지금 든 생각', eventId: MANUAL_NOTE_ID });
      expect(Object.keys(saved.game.seen).filter((k) => k.startsWith('note-'))).toEqual([]);
      expect(saved.game.paused, '일시정지 상태는 그대로').toBe(g.paused);
      expect(notesOf(saved.game)).toEqual([{ age: 30, cardId: null, text: '지금 든 생각' }]);
    }
  });

  it('수동 기록 연타: expectCount(열 때의 기록 수)가 있으면 이미 늘어난 상태의 두 번째 제출은 무시되어 1건이다', () => {
    const s = session(stateAt(30));
    const open = noteCount(s.game);
    const first = send(s, { type: 'saveNote', cardId: null, text: '하나', expectCount: open });
    const second = send(first, { type: 'saveNote', cardId: null, text: '하나', expectCount: open });
    expect(second).toBe(first);
    expect(noteCount(second.game)).toBe(1);
    // expectCount가 없으면 연달아 쓸 수 있다(서로 다른 기록)
    expect(noteCount(send(first, { type: 'saveNote', cardId: null, text: '둘' }).game)).toBe(2);
  });

  it('기록은 인생 전체 40개까지: 40개 뒤의 41번째는 생기지 않는다 (연타해도). 자동 카드도 같은 한도', () => {
    let s = session(stateAt(30));
    for (let i = 0; i < 40; i++) s = send(s, { type: 'saveNote', cardId: null, text: `기록 ${i}` });
    expect(noteCount(s.game)).toBe(NOTE_LIMITS.total);
    for (let i = 0; i < 5; i++) expect(send(s, { type: 'saveNote', cardId: null, text: '넘침' })).toBe(s);
    const full = session({ ...s.game, age: 50 });
    expect(dueId(full.game)).not.toBeNull();
    expect(send(full, { type: 'saveNote', cardId: dueId(full.game), text: '자동 카드도 넘침' })).toBe(full);
    // 카드는 담아 둘 수 있다
    expect(dueId(send(full, { type: 'dismissNote', cardId: dueId(full.game)! }).game)).not.toBe(dueId(full.game));
  });

  it('showTitle(나가기) 중에는 기록 액션을 받지 않는다', () => {
    const s = { ...session(at5()), showTitle: true };
    expect(send(s, { type: 'saveNote', cardId: ID.infant, text: '글' })).toBe(s);
    expect(send(s, { type: 'dismissNote', cardId: ID.infant })).toBe(s);
  });

  it('setNoteCards: 설정만 바꾸고 같은 값·불리언이 아닌 값은 무시한다. 게임 상태는 그대로', () => {
    const s = session(at5());
    expect(s.settings.noteCards).toBe(true);
    expect(send(s, { type: 'setNoteCards', on: true })).toBe(s);
    const off = send(s, { type: 'setNoteCards', on: false });
    expect(off.settings.noteCards).toBe(false);
    expect(off.game).toBe(s.game);
    expect(send(off, { type: 'setNoteCards', on: 'no' as unknown as boolean })).toBe(off);
    expect(send(off, { type: 'setNoteCards', on: true }).settings.noteCards).toBe(true);
  });

  it('꺼진 동안 지나간 카드는 돌아오지 않는다: 끈 채 5세를 지나고 켜면 ①은 다시 뜨지 않고 이후 카드부터 뜬다', () => {
    const off = send(session(at5(), { noteCards: false }), { type: 'advance', fromAge: 5 });
    const on = send(off, { type: 'setNoteCards', on: true });
    expect(on.game.seen[ID.infant]).toBe(5);
    expect(dueId({ ...on.game, pending: null })).not.toBe(ID.infant);
  });

  it('다시 태어나기: 이전 판의 기록 글이 새 판 상태 어디에도 없다 (rebirth·beginNew)', () => {
    const secret = '다시 태어나면 사라질 글';
    const written = writeNote(stateAt(30), { cardId: null, text: secret });
    expect(JSON.stringify(written)).toContain(secret);
    const ended = { ...written, phase: 'ending' as const, death: { age: 30, cause: '병' } };
    const reborn = sessionReducer(createSession(ended, { speed: 1, autoMode: false }), { type: 'rebirth', seed: 77 });
    expect(JSON.stringify(reborn.game)).not.toContain(secret);
    expect(reborn.game.history).toEqual([]);
    expect(reborn.game.seen).toEqual({});
    const exited = { ...createSession(written, { speed: 1, autoMode: false }), showTitle: true };
    const fresh = sessionReducer(exited, { type: 'beginNew', seed: 5 });
    expect(JSON.stringify(fresh.game)).not.toContain(secret);
    expect(noteCount(fresh.game)).toBe(0);
  });
});

describe('writeNote (상태 함수)', () => {
  it('인생 단계가 아니면 아무것도 하지 않는다. 글은 finalizeNote로 정규화되어 저장된다', () => {
    const g = stateAt(30);
    const ending = { ...g, phase: 'ending' as const };
    expect(writeNote(ending, { cardId: null, text: '글' })).toBe(ending);
    const out = writeNote(g, { cardId: null, text: `<b>가</b>${String.fromCodePoint(0x202e)}  나\n\n\n다\n라\n마` });
    expect(out.history.at(-1)!.text).toBe('<b>가</b> 나\n다\n라 마');
  });

  it('lifeLineCount: note 줄은 연표 줄 수에서 빠진다 (시계 resetKey가 수동 기록에 되감기지 않게, 5-3절)', () => {
    const g = stateAt(30);
    const before = lifeLineCount(g.history);
    const out = writeNote(g, { cardId: null, text: '글' });
    expect(out.history.length).toBe(g.history.length + 1);
    expect(lifeLineCount(out.history)).toBe(before);
  });
});

// ---------- 스케줄 시뮬레이션 ----------

describe('카드 스케줄 (완료 기준 1): 세대 표본 3종 × 1000판, dueNote 소비 모드', () => {
  for (const era of SIM_PROFILES) {
    it(`${era}: 판당 ≤ 7장 · 같은 종류 ≤ 1 · 한 해 ≤ 1장 · 간격 ≥ 2년 · 창 밖 0장 · 에러 0 — 평균 카드 수가 6.0~7.0 안`, () => {
      const r = runNoteSchedule(era, 1000, (seed) => chooserFor('auto', seed), 1);
      expect(r.problems, `${era} 불변식 위반`).toEqual([]);
      expect(r.lives).toBe(1000);
      expect(r.meanCards, `${era} 판당 평균 카드 ${r.meanCards.toFixed(2)}`).toBeGreaterThanOrEqual(6.0);
      expect(r.meanCards).toBeLessThanOrEqual(7.0);
      expect(r.meanCardsLong, `${era} 70세 이상 평균 ${r.meanCardsLong.toFixed(2)}`).toBeGreaterThanOrEqual(6.0);
      // 카드 종류별 도달률: ⑤만 조건부(큰 병·건강 하락)이고 나머지 여섯은 거의 모든 판에 뜬다
      for (const c of NOTE_CARDS) {
        if (c.id === ID.illness) {
          expect(r.reach[c.id], `${era} ${c.id}`).toBeGreaterThan(0.2);
          expect(r.reach[c.id]).toBeLessThan(0.9);
        } else expect(r.reach[c.id], `${era} ${c.id}`).toBeGreaterThan(0.95);
      }
      // 뜬 나이는 모두 창 안이고 결정적 카드는 정해진 나이에 뜬다
      expect(r.ages[ID.infant]).toMatchObject({ min: 5, max: 5 });
      for (const c of NOTE_CARDS) {
        expect(r.ages[c.id].min, c.id).toBeGreaterThanOrEqual(c.ageRange.min);
        expect(r.ages[c.id].max, c.id).toBeLessThanOrEqual(c.ageRange.max);
      }
      // 결정 카드와 같은 해에 겹치는 비율은 보고용이다 — 기록 카드가 해의 첫머리, 결정 카드가 해의 끝이라 겹쳐도 시트가 이어서 열린다(NC-7)
      expect(r.overlap).toBeGreaterThan(0);
      expect(r.overlap).toBeLessThan(0.6);
    });
  }

  it('스케줄 점검이 실제로 잡는다(공허 통과 방지): 간격·창·중복·같은 해 위반을 넣은 가짜 한 판', async () => {
    const { scheduleProblems } = await import('../scripts/noteScheduleLib');
    const base = { seed: 1, deathAge: 80 };
    expect(scheduleProblems({ ...base, shown: [{ id: ID.infant, age: 5, withDecision: false }, { id: ID.teen, age: 14, withDecision: false }] })).toEqual([]);
    expect(scheduleProblems({ ...base, shown: [{ id: ID.teen, age: 14, withDecision: false }, { id: ID.love, age: 15, withDecision: false }] }).join()).toContain('간격');
    expect(scheduleProblems({ ...base, shown: [{ id: ID.teen, age: 14, withDecision: false }, { id: ID.love, age: 14, withDecision: false }] }).join()).toContain('한 해');
    expect(scheduleProblems({ ...base, shown: [{ id: ID.infant, age: 6, withDecision: false }] }).join()).toContain('나이 창');
    expect(scheduleProblems({ ...base, shown: [{ id: ID.teen, age: 14, withDecision: false }, { id: ID.teen, age: 16, withDecision: false }] }).join()).toContain('두 번');
    expect(scheduleProblems({ ...base, shown: NOTE_CARDS.concat(NOTE_CARDS).slice(0, 8).map((c, i) => ({ id: c.id, age: c.ageRange.min + i, withDecision: false })) }).join()).toContain('최대 7');
  });
});
