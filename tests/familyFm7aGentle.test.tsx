import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GENERATION_IDS, heavyKindOfEntry, heavyKindOfEvent, type HistoryEntry } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { FAMILY_LINE_HEAVY, FAMILY_LINE_ID, FAMILY_LINE_TEXT, familyLineViewText } from '../src/data/familyLineText';
import { HEAVY_KIND_TEXT } from '../src/data/gentleText';
import { LogCard } from '../src/ui/dash/LogCard';
import { visibleText } from './helpers/visible';
import { lifeSteps, seedsFor } from './helpers/familyLife';

/**
 * FM7a의 새 줄·변형 카드와 「무거운 장면 가리기」 (SPEC-009 「FM7 나눔」 완료 기준 10, SPEC-005 방식 A): 가림 분류는 `loss`(「돌봄과 이별」)·`home`(「집안 사정」) 그대로이고, 가림을 켠 인생 기록에서 문장 노출이 0이다.
 * 사건마다 대체 문구를 따로 쓰지 않는다(분류 이름만 보인다). 7000판 전수의 분류 누락 0(`heavyKindOfEntry`)은 tests/familyConsistency.test.ts(`FAMILY_INV_LIVES=1000`)가 센다.
 */

const line = (age: number, eventId: string, text: string): HistoryEntry => ({ age, kind: 'event', text, eventId });

/** FM7a 줄 네 종류 + 변형 사건의 결과 줄 (분류가 붙은 줄만) */
const ROWS: HistoryEntry[] = [
  line(8, FAMILY_LINE_ID.parentGone, FAMILY_LINE_TEXT.parentGone('mother', 34, true)),
  line(11, FAMILY_LINE_ID.grandGone, FAMILY_LINE_TEXT.grandGone(1, 78, true)),
  line(13, FAMILY_LINE_ID.parentsApart, FAMILY_LINE_TEXT.parentsApart('father')),
  line(6, FAMILY_LINE_ID.sibLost, FAMILY_LINE_TEXT.sibLost('male', 'olderBrother', 6)),
  (() => {
    const ev = EVENT_POOL.byId.get('middle-parents-care-mother-gone')!;
    const c = ev.choices!.find((x) => x.id === 'home')!;
    return { age: 55, kind: 'choice', title: ev.title, text: c.result, choice: c.label, eventId: ev.id } as HistoryEntry;
  })(),
];
/** 가림 대상이 아닌 줄 (동생 출생·독립, 단계) — 이 줄들은 가리지 않는다 */
const PLAIN: HistoryEntry[] = [
  line(2, FAMILY_LINE_ID.sibBorn, FAMILY_LINE_TEXT.sibBorn('female')),
  line(21, FAMILY_LINE_ID.sibLeft, FAMILY_LINE_TEXT.sibLeft('male', 'olderBrother', 3, true)),
];

const render = (history: readonly HistoryEntry[], gentle: boolean): string => renderToStaticMarkup(<LogCard history={history} live gentle={gentle} />);

describe('FM7a 줄·변형 카드의 가림 연동 (완료 기준 10)', () => {
  it('분류: 부모·조부모·형제 별세는 loss(돌봄과 이별), 이혼·별거는 home(집안 사정) — 변형 사건 4개는 원본과 같은 loss, 분류 이름은 그대로다', () => {
    expect(HEAVY_KIND_TEXT.loss).toBe('돌봄과 이별');
    expect(HEAVY_KIND_TEXT.home).toBe('집안 사정');
    expect(FAMILY_LINE_HEAVY[FAMILY_LINE_ID.parentGone]).toBe('loss');
    expect(FAMILY_LINE_HEAVY[FAMILY_LINE_ID.grandGone]).toBe('loss');
    expect(FAMILY_LINE_HEAVY[FAMILY_LINE_ID.sibLost]).toBe('loss');
    expect(FAMILY_LINE_HEAVY[FAMILY_LINE_ID.parentsApart]).toBe('home');
    expect(ROWS.map((h) => heavyKindOfEntry(h))).toEqual(['loss', 'loss', 'home', 'loss', 'loss']);
    for (const id of ['middle-parents-care-mother-gone', 'middle-parents-care-father-gone', 'middle-parents-farewell-mother-gone', 'middle-parents-farewell-father-gone']) expect(heavyKindOfEvent(EVENT_POOL.byId.get(id)), id).toBe('loss');
    for (const h of PLAIN) expect(heavyKindOfEntry(h), h.eventId).toBeNull();
  });

  it('끄면 모든 줄이 원문이고, 켜면 FM7a 줄·변형 결과 줄의 문장이 한 글자도 보이지 않고 「무거운 일이 있었습니다 · {분류}」만 보인다 (분류가 없는 줄은 그대로)', () => {
    const history = [...PLAIN, ...ROWS];
    const off = visibleText(render(history, false));
    for (const h of history) expect(off, `끈 상태: ${h.eventId}`).toContain(familyLineViewText(h.eventId, h.text, 'korean')); // 별세 나이는 한국 나이로 읽힌다(SPEC-019)
    const html = render(history, true);
    const on = visibleText(html);
    for (const h of ROWS) {
      expect(on, `가림: ${h.eventId} 문장`).not.toContain(h.text);
      // 문장의 핵심 낱말(나이·호칭)도 새지 않는다
      expect(on, `가림: ${h.eventId}`).not.toContain('세상을 떠');
      if (h.choice !== undefined) expect(on, `가림: ${h.eventId} 고른 길`).not.toContain(h.choice);
    }
    for (const h of PLAIN) expect(on, h.eventId).toContain(h.text);
    expect(html.match(/data-veiled="true"/g)).toHaveLength(ROWS.length);
    for (const row of [`9세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.loss}`, `12세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.loss}`, `14세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.home}`, `7세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.loss}`, `56세 무거운 일이 있었습니다 ${HEAVY_KIND_TEXT.loss}`]) {
      expect([...html.matchAll(/<li class="log__row[^"]*" data-kind="[a-z]+" data-veiled="true"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => visibleText(m[0], { ariaHidden: true })).some((t) => t.startsWith(row)), row).toBe(true);
    }
  });

  it('실제 판 7세대 × 60판: 가림을 켜면 판 끝 인생 기록의 모든 가족 줄이 분류된 줄은 가려지고 분류 없는 줄(동생 출생·독립)은 그대로 보인다 — 어린 형제의 별세 줄이 든 판이 실제로 있다', () => {
    let sib = 0;
    let rows = 0;
    GENERATION_IDS.forEach((gen, gi) => {
      for (const seed of seedsFor(60, gi)) {
        const last = lifeSteps(seed, gen).slice(-1)[0].state;
        const fam = last.history.filter((h) => (h.eventId ?? '').startsWith('fam-'));
        if (fam.length === 0) continue;
        rows++;
        const on = visibleText(render(fam, true));
        for (const h of fam) {
          const kind = heavyKindOfEntry(h);
          expect(kind === null ? on.includes(h.text) : !on.includes(h.text), `${gen}/${seed} ${h.eventId} (${kind})`).toBe(true);
          if (h.eventId === FAMILY_LINE_ID.sibLost) sib++;
        }
      }
    });
    expect(rows, '가족 줄이 있는 판').toBeGreaterThan(300);
    expect(sib, '어린 형제의 별세 줄').toBeGreaterThan(2);
  });
});
