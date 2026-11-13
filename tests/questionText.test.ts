import { describe, expect, it } from 'vitest';
import { QUESTION_MAX_CHARS, questionProblems, validateEventFiles, type EventDef } from '../src/core';
import { EVENT_FILES, EVENT_POOL } from '../src/data/events';

/**
 * SPEC-014 QS3 · 완료 기준 1·7·8 — 결정 줄 질문 문장 94개.
 * ① 선택지 이벤트 94개 전부에 `question`이 있고 서술 이벤트(50개)에는 없다.
 * ② 승인 문서(`docs/design/question-text-*.md`의 「승인 2026-11-08」 추천 문장)와 **글자 단위로 같다** — 승인된 값만 데이터에 있다(완료 기준 8).
 * ③ 문장 규칙: 「…할까?」 한 문장·≤ 30자·94개 서로 다름·사람 주어·평가어·계층어·숫자·제목 단순 의문 변환·선택지 문구 반복 0(`questionProblems`).
 * ④ 스키마가 모양(선택지 이벤트에만·「까?」 꼴·길이)을 막는다. 글꼴 조각 밖 글자 0은 `tests/fonts.test.tsx`가 `src/**` 전체로 지킨다.
 */

const fsSpec = 'node:fs';
const fs = (await import(/* @vite-ignore */ fsSpec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
const DOC_FILES = ['infant', 'school', 'youth', 'middle', 'senior'] as const;
const COUNTS: Record<(typeof DOC_FILES)[number], number> = { infant: 15, school: 17, youth: 22, middle: 22, senior: 18 };

/** 승인 문서 표의 「추천 질문」(굵은 글자 첫 칸)을 id별로 읽는다. 행마다 승인 칸에 「승인 2026-11-08」이 있어야 한다 */
function approved(stage: (typeof DOC_FILES)[number]): Map<string, string> {
  const text = fs.readFileSync(new URL(`../docs/design/question-text-${stage}.md`, import.meta.url), 'utf-8');
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!/^\| \d+ \|/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim());
    const id = /`([a-z0-9-]+)`/.exec(cells[2])![1];
    const bold = cells.find((c, i) => i > 2 && /^\*\*.+\*\*$/.test(c))!;
    expect(cells[cells.length - 2], `${id} 승인 칸`).toContain('승인 2026-11-08');
    out.set(id, bold.slice(2, -2));
  }
  return out;
}

/** SPEC-018 PL5의 새 선택지 사건(질문 원본은 `docs/data/content-018-PL5.md`) */
const PL5_NEW = ['school-lessons', 'school-high-pick'];

const ALL = new Map<string, string>();
for (const stage of DOC_FILES) for (const [id, q] of approved(stage)) ALL.set(id, q);

describe('QS3 ① 94개 전부 있다', () => {
  // 승인 문서(question-text-*.md)가 다루는 것은 2026-11-08의 94개다. 조르기 사건 7개(SPEC-011 AK7)의 질문은 `docs/design/copy.md` 20절이 원본이고 `tests/askEvents.test.ts`가 글자 단위로 대조한다.
  // SPEC-018 PL5(결정 후속 237)의 새 사건 2개(G1·G2)와 진로 카드 2개(`pick`)의 질문은 `docs/data/content-018-PL5.md` 3절이 원본이다 — 아래 「PL5」 묶음이 글자 단위로 대조한다
  const askEvents = EVENT_POOL.events.filter((e) => e.ask !== undefined);
  const choiceEvents = EVENT_POOL.events.filter((e) => e.choices !== undefined && e.ask === undefined && !PL5_NEW.includes(e.id));

  it('선택지 이벤트 94개(영유아 15 · 학창 17 · 청년 22 · 중년 22 · 노년 18)에 question이 있고 서술 이벤트에는 없다 — 조르기 사건 7개도 question이 있다', () => {
    expect(choiceEvents).toHaveLength(94);
    expect(askEvents).toHaveLength(7);
    for (const e of [...choiceEvents, ...askEvents]) expect(typeof e.question, e.id).toBe('string');
    // 서술 사건에는 질문이 없다 — 진로 카드(`pick`, 정의 선택지 없음)는 PL5부터 선택 카드로서 질문을 갖는다(아래 「PL5」 묶음)
    for (const e of EVENT_POOL.events.filter((x) => x.choices === undefined && x.pick === undefined)) expect(e.question, e.id).toBeUndefined();
    for (const stage of DOC_FILES) {
      const key = Object.keys(EVENT_FILES).find((k) => k.endsWith('/' + stage + '.json'))!;
      const events = (EVENT_FILES[key] as { events: Array<{ id: string; choices?: unknown; question?: string; ask?: unknown }> }).events;
      expect(events.filter((e) => e.choices !== undefined && e.question !== undefined && e.ask === undefined && !PL5_NEW.includes(e.id)), stage).toHaveLength(COUNTS[stage]);
    }
  });

  it('승인 문서의 94개 id와 데이터의 선택지 이벤트 id가 같다', () => {
    expect(ALL.size).toBe(94);
    expect([...ALL.keys()].sort()).toEqual(choiceEvents.map((e) => e.id).sort());
  });
});

describe('QS3 ② 승인 문장과 글자 단위로 같다', () => {
  it('94개 모두 문서의 추천 문장과 데이터의 question이 한 글자도 다르지 않다', () => {
    const diff: string[] = [];
    for (const [id, q] of ALL) if (EVENT_POOL.byId.get(id)?.question !== q) diff.push(`${id}: 문서「${q}」 ≠ 데이터「${EVENT_POOL.byId.get(id)?.question}」`);
    expect(diff).toEqual([]);
  });

  it('묶음별 개수가 승인표와 같다', () => {
    for (const stage of DOC_FILES) expect(approved(stage).size, stage).toBe(COUNTS[stage]);
  });
});

describe('QS3 ③ 문장 규칙(완료 기준 1·7)', () => {
  const qs = EVENT_POOL.events.filter((e) => e.question !== undefined).map((e) => ({ id: e.id, q: e.question! }));

  it('questionProblems 가 빈 배열이다 (있음·유일·주어·평가어·숫자·제목 변환·선택지 반복)', () => {
    expect(questionProblems(EVENT_POOL.events)).toEqual([]);
  });

  it('모두 「…할까?」 꼴 한 문장 — 「까?」로 끝나고 물음표는 맨 끝 하나, 길이 ≤ 30자', () => {
    expect(QUESTION_MAX_CHARS).toBe(30);
    for (const { id, q } of qs) {
      expect(q, id).toMatch(/까\?$/);
      expect(q.split('?').length - 1, `${id} 물음표 수`).toBe(1);
      expect(q.length, id).toBeLessThanOrEqual(30);
      expect(q, id).not.toMatch(/[!！]|요\?|습니까/); // 합쇼체·해요체 아님, 느낌표 없음
    }
  });

  it('105개(94 + 조르기 7 + PL5 새 사건 2 + 진로 카드 2)가 서로 다르다 (공허 통과 방지)', () => {
    expect(qs).toHaveLength(105);
    expect(new Set(qs.map((x) => x.q)).size).toBe(105);
  });

  it('사람 주어·평가어·계층어·시대 판단어·숫자 0건 (검사기가 실제로 잡는지 합성 사례로 확인)', () => {
    const ev = (over: Partial<EventDef>): EventDef => ({ ...(EVENT_POOL.byId.get('infant-care') as EventDef), ...over });
    expect(questionProblems([ev({ question: '아이가 갈까 말까?' })])).not.toEqual([]);
    expect(questionProblems([ev({ question: '옳은 길로 갈까?' })])).not.toEqual([]);
    expect(questionProblems([ev({ question: '가난한 집, 어디로 갈까?' })])).not.toEqual([]);
    expect(questionProblems([ev({ question: '3곳 중 어디로 갈까?' })])).not.toEqual([]);
    expect(questionProblems([ev({ question: '맡겨지는 낮?' })])).not.toEqual([]);
    expect(questionProblems([ev({ question: undefined })])).not.toEqual([]); // 선택지 이벤트에는 있어야 한다
  });
});

describe('QS1 스키마: question 의 모양', () => {
  const file = (over: Record<string, unknown>) => ({
    note: '모티브로만 새로 쓴 글',
    events: [
      {
        id: 'test-ask-q',
        title: '시험 사건',
        text: '시험으로 만든 사건의 본문 문장입니다. 선택지가 둘 있습니다.',
        stages: ['school'],
        track: 'common',
        weight: 1,
        once: true,
        choices: [
          { id: 'a', label: '가 한다', result: '가를 했습니다. 아무 일도 없었습니다.' },
          { id: 'b', label: '나 한다', result: '나를 했습니다. 아무 일도 없었습니다.' },
        ],
        ...over,
      },
    ],
  });
  const problems = (over: Record<string, unknown>): string => {
    try {
      validateEventFiles({ 'test.json': file(over) });
      return '';
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };

  it('올바른 질문은 통과한다', () => {
    expect(problems({ question: '시험 삼아, 갈까 말까?' })).toBe('');
  });

  it('「까?」로 끝나지 않거나 물음표가 둘이거나 문자열이 아니거나 길이를 넘으면 막는다', () => {
    expect(problems({ question: '시험 삼아 가자.' })).toContain('question');
    expect(problems({ question: '갈까? 말까?' })).toContain('question');
    expect(problems({ question: 7 })).toContain('question');
    expect(problems({ question: `${'가'.repeat(QUESTION_MAX_CHARS)}할까?` })).toContain('question');
    expect(problems({ question: ' 갈까 말까?' })).toContain('question');
  });

  it('선택지가 없는 서술 이벤트에는 question 을 쓸 수 없다', () => {
    const f = file({ question: '갈까 말까?' });
    delete (f.events[0] as Record<string, unknown>).choices;
    let msg = '';
    try {
      validateEventFiles({ 'test.json': f });
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg).toContain('선택지 이벤트에만');
  });
});

describe('PL5 질문 문장: 확정 문서(content-018-PL5.md 3절)와 글자 단위로 같다 [결정 후속 237]', () => {
  const doc = fs.readFileSync(new URL('../docs/data/content-018-PL5.md', import.meta.url), 'utf-8');
  const want: Array<[string, string]> = [
    ['school-lessons', '학교가 끝난 오후, 무엇을 할까?'],
    ['school-high-pick', '원서를 쓰는 중학교 마지막 해, 어디로 갈까?'],
    ['job-pick-field', '무슨 일을 할지 정할 때, 어느 길로 갈까?'],
    ['job-pick-detail', '마음에 둔 분야에서, 어느 직무에 지원할까?'],
  ];
  it('네 사건의 question이 문서에 굵게 적힌 문장과 같다', () => {
    for (const [id, q] of want) {
      expect(EVENT_POOL.byId.get(id)?.question, id).toBe(q);
      expect(doc, `${id}: 문서에 굵은 질문이 있다`).toContain(`**${q}**`);
    }
  });
});
