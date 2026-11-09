import { describe, expect, it } from 'vitest';
import copySrc from '../docs/design/copy.md?raw';
import modelSrc from '../docs/data/ask-model.md?raw';
import petFile from '../src/data/events/ask-pet.json';
import {
  askPoolProblems,
  askProblems,
  createEventPool,
  lintEvent,
  playToEnd,
  possibleAgesOf,
  validateEventFiles,
  type EventDef,
} from '../src/core';
import {
  ASK_CHOICE_LABELS,
  ASK_EFFECTS,
  ASK_EVENT_IDS,
  ASK_KIND_INFO,
  ASK_PET_ENABLED,
  ASK_PET_EVENT_IDS,
  ASK_UNKNOWN_IMPACT_TEXT,
  ASK_WEIGHT_LADDER,
  askEventIdsFor,
} from '../src/data/askTable';
import { EVENT_FILES, EVENT_POOL } from '../src/data/events';
import { PARENT_DECISION_TABLE, parentTableCountsFor } from '../src/data/parentDecisionTable';
import { parentTableProblems } from '../src/core';
import { startLife } from '../scripts/simulateLib';

/**
 * 조르기 사건 데이터 (SPEC-011 AK7·AK9 스위치, `docs/design/copy.md` 20절 원본 · `docs/data/ask-model.md` 1-3절·12절 `EVENT` 줄):
 *  ① JSON의 모든 문장이 copy.md 20-3 표와 **글자 단위로 같다**(기계로 옮겼고 손으로 고치지 않았다) · 표의 「자」 수도 맞다
 *  ② 공통 필드(나이·시대 구간·가중·선택지·`noCitation: D`)가 설계 문서 `EVENT` 줄·20-2와 같다
 *  ③ 반려동물 스위치(`ASK_PET_ENABLED` = 꺼짐): 풀·분류표·집계·게임에 반려동물 0건, 켜짐으로 가정하면 9건이 모두 통과한다
 *  ④ 고정 한 줄·라벨 상수
 */

interface DocEvent {
  id: string;
  fields: Record<string, string>;
  counts: Record<string, number>;
}

/** copy.md 20-3의 표를 읽는다: `**`id`**` 머리 아래 `| `필드` | 문장 | 자 |` 줄 */
function docEvents(): DocEvent[] {
  const start = copySrc.indexOf('### 20-3.');
  const end = copySrc.indexOf('### 20-4.');
  const parts = copySrc.slice(start, end).split(/\n\*\*`(ask-[a-z]+-[a-d])`\*\*/);
  const out: DocEvent[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const fields: Record<string, string> = {};
    const counts: Record<string, number> = {};
    for (const line of parts[i + 1].split('\n')) {
      const m = /^\| `([a-zA-Z.]+)` \| (.*) \| (\d+) \|$/.exec(line);
      if (m !== null) {
        fields[m[1]] = m[2];
        counts[m[1]] = Number(m[3]);
      }
    }
    out.push({ id: parts[i], fields, counts });
  }
  return out;
}

const DOC = docEvents();
const petEvents = (petFile as { events: unknown[] }).events as EventDef[];
const allEvents: EventDef[] = [...(EVENT_POOL.events.filter((e) => e.ask !== undefined) as EventDef[]), ...(ASK_PET_ENABLED ? [] : petEvents)];

/** 설계 문서 12절 `EVENT | id | 종류 | yearFrom | yearTo | 나이 최소 | 나이 최대 | 가중 | 스위치` 줄 */
function modelRows(): string[][] {
  const m = /```ask-table\n([\s\S]*?)```/.exec(modelSrc)!;
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('EVENT |'))
    .map((l) => l.split('|').map((c) => c.trim()));
}

describe('AK7 ① JSON의 문장 = copy.md 20-3 표 (글자 단위)', () => {
  it('표에 사건 9개가 있고 사건마다 9필드(제목·본문·질문·결과 6·참는다)가 있다', () => {
    expect(DOC.map((d) => d.id)).toEqual([...ASK_EVENT_IDS, ...ASK_PET_EVENT_IDS]);
    for (const d of DOC) expect(Object.keys(d.fields).sort(), d.id).toEqual(['beg.askDenied', 'beg.result', 'endure.result', 'question', 'tantrum.askDenied', 'tantrum.askStrained', 'tantrum.result', 'text', 'title']);
  });

  it('표의 「자」 수가 실제 글자 수와 같다(공백·구두점 포함) — 81문장 전수', () => {
    const bad: string[] = [];
    for (const d of DOC) for (const [k, v] of Object.entries(d.fields)) if ([...v].length !== d.counts[k]) bad.push(`${d.id}.${k}: ${[...v].length} ≠ ${d.counts[k]}`);
    expect(bad).toEqual([]);
    expect(DOC.reduce((n, d) => n + Object.keys(d.fields).length, 0)).toBe(81);
  });

  it('데이터의 모든 문장이 표와 한 글자도 다르지 않다 (반려동물 둘은 ask-pet.json — 스위치가 꺼져 있어도 같다)', () => {
    const diff: string[] = [];
    for (const d of DOC) {
      const ev = allEvents.find((e) => e.id === d.id);
      expect(ev, d.id).toBeDefined();
      const c = (id: string) => ev!.choices!.find((x) => x.id === id)!;
      const got: Record<string, string | undefined> = {
        title: ev!.title,
        text: ev!.text,
        question: ev!.question,
        'beg.result': c('beg').result,
        'beg.askDenied': c('beg').askDenied,
        'tantrum.result': c('tantrum').result,
        'tantrum.askDenied': c('tantrum').askDenied,
        'tantrum.askStrained': c('tantrum').askStrained,
        'endure.result': c('endure').result,
      };
      for (const [k, v] of Object.entries(d.fields)) if (got[k] !== v) diff.push(`${d.id}.${k}: 문서「${v}」 ≠ 데이터「${got[k]}」`);
    }
    expect(diff).toEqual([]);
  });

  it('R-669·R-667(남은 부분) 반영: toy-c `askStrained` = 「상자를 두고 울고 버텼지만 빈손이었습니다. …」, lessons-a 비고는 「교실·도장」', () => {
    const c = allEvents.find((e) => e.id === 'ask-toy-c')!.choices!.find((x) => x.id === 'tantrum')!;
    expect(c.askStrained).toBe('상자를 두고 울고 버텼지만 빈손이었습니다. 그 뒤 며칠, 집안 어른과 눈을 잘 마주치지 않았습니다.');
    expect(copySrc).toContain('피아노와 태권도 (8) | 교실·도장(「학원」 0) |');
    expect(copySrc).toContain('본문 ≤ 74(최대 70, `ask-lessons-a`) · 질문 ≤ 30(최대 29, `ask-toy-c`·`ask-lessons-c`)');
  });
});

describe('AK7 ② 공통 필드 = 설계 문서 EVENT 줄 · 20-2', () => {
  const rows = modelRows();

  it('설계 문서 EVENT 9줄 ↔ 사건 데이터: id · 종류 · 시대 구간(yearRange) · 나이 범위 · 가중 · 스위치(pet)', () => {
    expect(rows.map((r) => r[1])).toEqual([...ASK_EVENT_IDS, ...ASK_PET_EVENT_IDS]);
    for (const r of rows) {
      const ev = allEvents.find((e) => e.id === r[1])!;
      expect(ev, r[1]).toBeDefined();
      expect(ev.ask, r[1]).toEqual({ kind: r[2] });
      expect(ev.yearRange?.from === undefined ? '-' : String(ev.yearRange.from), `${r[1]} yearFrom`).toBe(r[3]);
      expect(ev.yearRange?.to === undefined ? '-' : String(ev.yearRange.to), `${r[1]} yearTo`).toBe(r[4]);
      expect([ev.ageRange?.min, ev.ageRange?.max], `${r[1]} 나이`).toEqual([Number(r[5]), Number(r[6])]);
      expect(ev.weight, `${r[1]} 가중`).toBe(Number(r[7]));
      expect(r[8] === 'pet', `${r[1]} 스위치 표지`).toBe(r[2] === 'pet');
    }
  });

  it('20-2 공통 필드: stages [infant, school] · common · once · noCitation D · 나이 4~12(장난감)·5~12 · 가중 45/40/30 · 선택지 id·라벨 고정 · endure 효과 = 표', () => {
    for (const ev of allEvents) {
      const info = ASK_KIND_INFO[ev.ask!.kind];
      expect(ev.stages, ev.id).toEqual(['infant', 'school']);
      expect(ev.track, ev.id).toBe('common');
      expect(ev.once, ev.id).toBe(true);
      expect(ev.noCitation, ev.id).toBe('D');
      expect(ev.citation, ev.id).toBeUndefined();
      expect(ev.ageRange, ev.id).toEqual({ min: info.ageMin, max: info.ageMax });
      const ladder = ASK_WEIGHT_LADDER[ev.ask!.kind];
      expect(ev.weight, ev.id).toBeGreaterThanOrEqual(ladder.min);
      expect(ev.weight, ev.id).toBeLessThanOrEqual(ladder.max);
      expect(ev.choices!.map((c) => [c.id, c.label]), ev.id).toEqual([['beg', ASK_CHOICE_LABELS.beg], ['tantrum', ASK_CHOICE_LABELS.tantrum], ['endure', ASK_CHOICE_LABELS.endure]]);
      expect(ev.choices!.every((c) => c.requires === undefined), ev.id).toBe(true);
      expect(ev.choices![2].effects, ev.id).toEqual(ASK_EFFECTS.endure);
      expect(ev.heavy, ev.id).toBeUndefined();
      expect(possibleAgesOf(ev).length, ev.id).toBeGreaterThan(0);
    }
    expect(ASK_CHOICE_LABELS).toEqual({ beg: '조른다', tantrum: '떼를 쓴다', endure: '참는다' });
  });

  it('반려동물 사건은 notFlags pet_dog·pet_cat·pet_other 셋을 모두 읽고 lint(L1~L9)를 통과한다 — 스위치가 꺼져 있어도 켤 날을 위해 통과한다', () => {
    for (const ev of petEvents) {
      expect(ev.conditions?.notFlags, ev.id).toEqual(['pet_dog', 'pet_cat', 'pet_other']);
      expect(askProblems(ev), ev.id).toEqual([]);
      expect(lintEvent(ev), ev.id).toEqual([]);
    }
    // 같은 종류 yearRange가 겹치지 않는다 (pool 단위 lint)
    expect(askPoolProblems([...(EVENT_POOL.events as EventDef[]), ...petEvents])).toEqual([]);
  });

  it('조르기 사건 7개의 lint가 통과한다 (check:events와 같은 함수) · 시대어·가족 낱말·상표는 0', () => {
    for (const ev of EVENT_POOL.events.filter((e) => e.ask !== undefined)) {
      expect(askProblems(ev), ev.id).toEqual([]);
      expect(lintEvent(ev), ev.id).toEqual([]);
    }
  });

  it('지난 세상(~2000) 조르기 사건에 「학원」·「스마트폰」·「태블릿」·「로봇」이 없고 「로봇」은 다가올 세상 사건(lessons-c)에만 있다 (결정 K3 · 완료 기준 15)', () => {
    const textOf = (ev: EventDef): string => JSON.stringify([ev.title, ev.text, ev.question, ev.choices!.map((c) => [c.label, c.result, c.askDenied, c.askStrained])]);
    for (const ev of allEvents) {
      const eras = EVENT_POOL.byId.get(ev.id)?.eras ?? (ev.yearRange?.to !== undefined && ev.yearRange.to <= 2000 ? ['past'] : undefined);
      if (eras !== undefined && eras.length === 1 && eras[0] === 'past') {
        for (const w of ['학원', '스마트폰', '태블릿', '로봇', '휴대전화', '화면', '인터넷']) expect(textOf(ev), `${ev.id}: ${w}`).not.toContain(w);
      }
      if (ev.id !== 'ask-lessons-c') expect(textOf(ev), ev.id).not.toContain('로봇');
    }
  });
});

describe('AK9 스위치 ASK_PET_ENABLED — 이번 배포는 꺼짐: 풀·분류표·집계·게임에 반려동물 0건, 켜짐으로 가정하면 9건', () => {
  it('꺼짐: 이벤트 파일 목록에 ask-pet.json이 없고 풀의 조르기 사건은 7개, 분류표 행 7, 집계 askCards 7 · selfCards 16', () => {
    expect(ASK_PET_ENABLED).toBe(false);
    expect(Object.keys(EVENT_FILES)).not.toContain('./ask-pet.json');
    expect(EVENT_POOL.events.filter((e) => e.ask !== undefined).map((e) => e.id)).toEqual([...ASK_EVENT_IDS]);
    expect(EVENT_POOL.events.some((e) => e.ask?.kind === 'pet' || /^ask-pet-/.test(e.id))).toBe(false);
    expect(Object.keys(PARENT_DECISION_TABLE).filter((id) => /^ask-/.test(id))).toEqual([...ASK_EVENT_IDS]);
    expect(Object.keys(PARENT_DECISION_TABLE).some((id) => id.startsWith('ask-pet-'))).toBe(false);
    expect(parentTableCountsFor(ASK_PET_ENABLED)).toMatchObject({ selfCards: 16, askCards: 7 });
    expect(askEventIdsFor(false)).toHaveLength(7);
  });

  it('켜짐으로 가정: 풀 9건 · 분류표 9행 · 집계 askCards 9 · selfCards 18이 모두 맞고 문제가 없다 (스위치 상수만 바꾸면 되는 구조)', () => {
    // `pet_cat`·`pet_other`를 켜는 사건은 아직 데이터에 없다 — FM7b 반려동물 묶음의 몫이다(AK9의 선행 조건). 그 사건이 들어온 것처럼 합성 파일 하나를 더해 켜짐을 시험한다
    const fm7b = {
      note: '시험용 합성 — 모티브로만 새로 쓴 글',
      events: [
        {
          id: 'school-zz-pets',
          title: '시험용 입양',
          text: '시험용 장면입니다. 반려동물 플래그를 켜는 사건입니다.',
          stages: ['school'],
          track: 'common',
          weight: 1,
          once: true,
          choices: [
            { id: 'cat', label: '고양이를 들인다', result: '고양이를 들였습니다.', effects: { setFlags: ['pet_cat'] } },
            { id: 'other', label: '작은 동물을 들인다', result: '작은 동물을 들였습니다.', effects: { setFlags: ['pet_other'] } },
          ],
        },
      ],
    };
    // 합성 파일 없이 켜면 읽는 플래그를 켜는 사건이 없어 로드가 실패한다 — 켤 때는 FM7b가 먼저라는 뜻이다(스위치 주석)
    expect(() => validateEventFiles({ ...EVENT_FILES, './ask-pet.json': petFile })).toThrow(/pet_cat/);
    const on = createEventPool(validateEventFiles({ ...EVENT_FILES, './ask-pet.json': petFile, './zz-fm7b.json': fm7b }));
    const asks = on.events.filter((e) => e.ask !== undefined);
    expect(asks.map((e) => e.id)).toEqual([...ASK_EVENT_IDS, ...ASK_PET_EVENT_IDS]);
    expect(askEventIdsFor(true)).toHaveLength(9);
    const table = { ...PARENT_DECISION_TABLE, ...Object.fromEntries(ASK_PET_EVENT_IDS.map((id) => [id, { areas: ['ask' as const] }])) };
    expect(parentTableProblems(on.events.filter((e) => e.id !== 'school-zz-pets'), table)).toEqual([]);
    expect(parentTableCountsFor(true)).toMatchObject({ selfCards: 18, askCards: 9 });
    // 켜짐일 때의 한 종류 1장: 강아지 두 사건은 서로의 askPeers다
    expect(on.byId.get('ask-pet-a')!.askPeers).toEqual(['ask-pet-b']);
    expect(askPoolProblems(on.events as EventDef[])).toEqual([]);
  });

  it('꺼진 상태에서 게임에 나오지 않는다: 자동 100판 · 무작위 100판 어느 연표에도 ask-pet 줄이 없고 조르기가 pet_dog를 켠 판이 없다 (school-puppy가 아닌 입양 0)', () => {
    let petFlagFromAsk = 0;
    for (let seed = 1; seed <= 100; seed++) {
      for (const strategy of ['auto', 'first'] as const) {
        const end = playToEnd(startLife(seed, seed % 2 === 0 ? 'alpha' : 'genx'), strategy === 'auto' ? null : (s) => s.pending!.choiceIds[0]).state;
        expect(end.history.some((h) => /^ask-pet-/.test(h.eventId ?? '')), `${strategy}#${seed}`).toBe(false);
        expect(Object.keys(end.seen).some((id) => id.startsWith('ask-pet-')), `${strategy}#${seed} seen`).toBe(false);
        if (end.flags.includes('pet_dog') && end.history.some((h) => h.eventId?.startsWith('ask-') && h.kind === 'choice' && h.text.includes('강아지'))) petFlagFromAsk++;
      }
    }
    expect(petFlagFromAsk).toBe(0);
  });
});

describe('AK8 고정 한 줄 상수', () => {
  it('「들어주실지는 알 수 없습니다」 — 상수 한 곳, 확률의 방향·숫자를 말하지 않는다 (G4)', () => {
    expect(ASK_UNKNOWN_IMPACT_TEXT).toBe('들어주실지는 알 수 없습니다');
    expect(ASK_UNKNOWN_IMPACT_TEXT).not.toMatch(/\d|높|낮|확률|형편|어렵/);
    expect([...ASK_UNKNOWN_IMPACT_TEXT].length).toBe(15); // 공백 포함 15자(copy.md 20-2)
  });
});
