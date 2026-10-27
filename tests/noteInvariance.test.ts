import { describe, expect, it } from 'vitest';
import { NOTE_LIMITS, isNoteKey, notesOf, parseGame, playToEnd, serializeGame, type ProfileId } from '../src/core';
import { SIM_PROFILES, startLife } from '../scripts/simulateLib';
import { lifeView, playSession, skipIt, writeIt } from './helpers/notes';

/**
 * 인생 불변 (SPEC-003 M7c 완료 기준 2, S9·R6 숨은 효과 0): 같은 시드·같은 선택에서 기록 카드를 어떻게 다루든 인생이 같다 —
 *  (a) 카드를 모두 쓴 판 (b) 모두 건너뛴(마음속에 담고 살기) 판 (c) 자동 모드 판 (d) `noteCards`를 끈 판 (e) 「다음 결정으로」로 몬 판
 * 의 `stats`·`assets`·`flags`·`seen`(note- 키 제외)·`rngState`·`history`(note 줄 제외)를 비롯한 **상태 전체**가 같고, 화면에 시트가 없는 판(`ignore`)·순수 엔진(`playToEnd`)과도 같다.
 * 세 시대 × 200판. 세션 reducer로 몰고 선택은 늘 첫 번째 선택지다.
 */
const SEEDS = Array.from({ length: 200 }, (_, i) => 1000 + i * 7);
const first = (s: { pending: { choiceIds: string[] } | null }): string => s.pending!.choiceIds[0];

describe.each(SIM_PROFILES)('카드 응답 방식이 인생을 바꾸지 않는다 (%s)', (era: ProfileId) => {
  it('쓴 판 · 건너뛴 판 · 자동 모드 판 · 카드를 끈 판 · 다음 결정으로 판 · 시트 없는 판 · 순수 엔진: 상태가 같다 (200판)', () => {
    let writtenRows = 0;
    let lives = 0;
    let withCards = 0;
    for (const seed of SEEDS) {
      const start = startLife(seed, era);
      const a = playSession(start, { respond: writeIt });
      const b = playSession(start, { respond: skipIt });
      const c = playSession(start, { settings: { autoMode: true } });
      const d = playSession(start, { settings: { noteCards: false } });
      const e = playSession(start, { respond: writeIt, useSkip: true });
      const f = playSession(start, { handling: 'ignore' });
      const pure = playToEnd(start, first).state;
      const want = lifeView(pure);
      for (const [name, r] of [['쓴 판', a], ['건너뛴 판', b], ['자동 모드', c], ['카드 끈 판', d], ['다음 결정으로', e], ['시트 없는 판', f]] as const) {
        expect(r.session.game.phase, `${name} #${seed}`).toBe('ending');
        expect(lifeView(r.session.game), `${name} 시드 ${seed}`).toEqual(want);
      }
      lives++;
      // 쓴 판: 시트가 뜬 카드마다 연표에 한 줄 — 7장 이하, 카드 id가 서로 다르고 seen에 소비 표시가 있다
      const rows = notesOf(a.session.game);
      expect(rows.length, `쓴 판 시드 ${seed}`).toBe(a.asked.length);
      expect(rows.length).toBeLessThanOrEqual(NOTE_LIMITS.autoCards);
      expect(a.asked.map((x) => x.id)).toEqual(rows.map((n) => n.cardId));
      expect(rows.map((n) => n.age)).toEqual(a.asked.map((x) => x.age));
      writtenRows += rows.length;
      if (rows.length > 0) withCards++;
      // 건너뛴 판: 줄 없음, 같은 카드가 소비됐다
      expect(notesOf(b.session.game)).toEqual([]);
      const seenKeys = (g: { seen: Record<string, number> }) => Object.keys(g.seen).filter(isNoteKey).sort();
      expect(seenKeys(b.session.game), `건너뛴 판 시드 ${seed}`).toEqual(seenKeys(a.session.game));
      // 자동 모드·카드 끈 판: 시트 없이 소비 — 줄 없음, 같은 카드가 같은 나이에 소비된다
      for (const r of [c, d, e]) expect(r.asked).toEqual(r === e ? a.asked : []);
      expect(notesOf(c.session.game)).toEqual([]);
      expect(notesOf(d.session.game)).toEqual([]);
      expect(seenKeys(c.session.game), `자동 모드 시드 ${seed}`).toEqual(seenKeys(a.session.game));
      expect(seenKeys(d.session.game), `카드 끈 판 시드 ${seed}`).toEqual(seenKeys(a.session.game));
      // 시트 없는 판: 카드를 보지도 않는다 — note- 키 0, 줄 0
      expect(seenKeys(f.session.game)).toEqual([]);
      expect(notesOf(f.session.game)).toEqual([]);
      // 저장 → 복원이 쓴 글까지 같다
      expect(parseGame(serializeGame(a.session.game)), `저장→복원 시드 ${seed}`).toEqual(a.session.game);
    }
    expect(lives).toBe(200);
    expect(withCards, '공허 통과 방지: 카드가 뜬 판이 대부분이다').toBeGreaterThan(190);
    expect(writtenRows / lives, '판당 평균 쓴 카드').toBeGreaterThan(5.5);
  }, 600_000);

  it('관찰 2: 해마다 수동 기록을 하나씩 더해도(기록 40개까지) 인생이 같다 — 기록 줄·note- 표시만 빼면 기록 없는 순수 엔진 상태와 toEqual (200판)', () => {
    let fullLives = 0;
    let manualRows = 0;
    for (const seed of SEEDS) {
      const start = startLife(seed, era);
      const m = playSession(start, { respond: writeIt, manualNotes: true });
      const g = m.session.game;
      expect(g.phase, `수동 기록 판 #${seed}`).toBe('ending');
      expect(lifeView(g), `수동 기록 판 시드 ${seed}`).toEqual(lifeView(playToEnd(start, first).state));
      // 기록은 40개를 넘지 않고, 수동 기록은 카드 없는 줄이다
      const rows = notesOf(g);
      expect(rows.length).toBeLessThanOrEqual(NOTE_LIMITS.total);
      const manual = rows.filter((n) => n.cardId === null);
      manualRows += manual.length;
      expect(rows.length - manual.length, '카드 줄은 자동 카드 한도 안').toBeLessThanOrEqual(NOTE_LIMITS.autoCards);
      // 40개에 이른 뒤에는 자동 카드가 시트를 요구하지 않는다 — 소비만 된다(R-411)
      const asked = m.asked.length;
      expect(asked, '시트가 뜬 카드 수 = 카드 줄 수').toBe(rows.length - manual.length);
      if (rows.length === NOTE_LIMITS.total) fullLives++;
      // 저장 → 복원
      expect(parseGame(serializeGame(g)), `저장→복원 시드 ${seed}`).toEqual(g);
    }
    expect(fullLives, '공허 통과 방지: 대부분의 판이 40개를 채웠다').toBeGreaterThan(150);
    expect(manualRows / SEEDS.length, '판당 평균 수동 기록').toBeGreaterThan(30);
  }, 600_000);
});
