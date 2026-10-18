import { describe, expect, it } from 'vitest';
import {
  DOMINANCE_EXCEPTIONS,
  ERAS,
  ERA_BANNED_WORDS,
  FUTURE_WORLD_WORDS,
  MIN_REPEAT_COOLDOWN,
  NEW_WORLD_WORDS,
  OLD_WORLD_WORDS,
  PAST_ALLOWED_NEW_WORDS,
  STATE_WORD_RULES,
  TEXT_LIMITS,
  bannedWordsFor,
  choiceBalanceProblems,
  conditionsCompatible,
  lintEvent,
  lintEventData,
  lintEventFiles,
  lintEvents,
  maskQuotes,
  maxVisibleChoices,
  splitSentences,
  stateWordProblems,
  stripSafePhrases,
  textPartsOf,
  toneOf,
  validateEventFiles,
  visibleChoiceProblems,
  visibleChoiceSets,
  worstCaseVisibleChoiceIds,
  type EventDef,
  type Tone,
} from '../src/core';
import * as core from '../src/core';
import { LENGTH_SAMPLE_IDS, lengthSample } from '../e2e/lengthSamples';
import { EVENT_POOL } from '../src/data/events';

/**
 * 이벤트 문구 점검(src/core/eventLint.ts) 단위 테스트. `npm run check:events`(= 빌드)와 `npm test`가 같은 함수를 쓴다(QA 사용감 8).
 * 점검이 "아무것도 못 잡는" 일이 없도록, 규칙마다 일부러 어긴 글이 실제로 걸리는지 본다.
 */

/** 점검을 모두 통과하는 기준 이벤트 */
const base = (over: Record<string, unknown> = {}): EventDef =>
  validateEventFiles({
    'x.json': {
      events: [
        {
          id: 'lint-base',
          title: '기준 이벤트',
          text: '조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.',
          stages: ['youth'],
          weight: 10,
          once: true,
          choices: [
            { id: 'a', label: '창문을 연다', result: '창문을 열었습니다. 바람이 방 안으로 들어왔습니다.', effects: { stats: { happiness: 1 } } },
            { id: 'b', label: '그대로 둔다', result: '그대로 두었습니다. 오후는 천천히 저물었습니다.', effects: { stats: { health: 1 } } },
          ],
          ...over,
        },
      ],
    },
  })[0];

const withText = (text: string) => base({ text });
const withLabel = (label: string) => base({ choices: [{ id: 'a', label, result: '창문을 열었습니다. 바람이 방 안으로 들어왔습니다.' }, { id: 'b', label: '그대로 둔다', result: '그대로 두었습니다. 오후는 천천히 저물었습니다.' }] });
const withResult = (result: string) => base({ choices: [{ id: 'a', label: '창문을 연다', result }, { id: 'b', label: '그대로 둔다', result: '그대로 두었습니다. 오후는 천천히 저물었습니다.' }] });
const joined = (ev: EventDef) => lintEvent(ev).join('\n');

describe('기준: 규칙을 지킨 이벤트는 통과한다', () => {
  it('기준 이벤트는 문제가 없다', () => {
    expect(lintEvent(base())).toEqual([]);
    expect(lintEvents([base()])).toEqual([]);
  });

  it('textPartsOf는 제목·본문·선택지 라벨·결과를 모두 내놓는다', () => {
    const parts = textPartsOf(base());
    expect(parts.map((p) => p.kind).sort()).toEqual(['label', 'label', 'result', 'result', 'text', 'title']);
    expect(parts.every((p) => p.where.startsWith('lint-base'))).toBe(true);
  });
});

describe('어조 규칙: 어긴 글은 반드시 걸린다 (SPEC "담담한 회고 어조, 느낌표·이모지·과장 금지")', () => {
  const cases: Array<[string, EventDef, string]> = [
    ['본문의 느낌표', withText('조용한 오후였다! 창밖으로 바람이 지나갔습니다.'), '느낌표'],
    ['전각 느낌표', withText('조용한 오후였다！ 창밖으로 바람이 지나갔습니다.'), '느낌표'],
    ['결과의 느낌표', withResult('창문을 열었다! 바람이 방 안으로 들어왔습니다.'), '느낌표'],
    ['라벨의 느낌표', withLabel('창문을 연다!'), '느낌표'],
    ['제목의 느낌표', base({ title: '기준 이벤트!' }), '느낌표'],
    ['물음표', withText('이대로 괜찮을까 싶었다? 창밖으로 바람이 지나갔습니다.'), '물음표'],
    ['말줄임표(…)', withText('조용한 오후였다… 창밖으로 바람이 지나갔습니다.'), '말줄임표'],
    ['말줄임표(...)', withText('조용한 오후였습니다... 창밖으로 바람이 지나갔습니다.'), '말줄임표'],
    ['이모지', withText('조용한 오후였다 \u{1F60A} 창밖으로 바람이 지나갔습니다.'), '이모지'],
    ['그림 기호', withText('조용한 오후였다 ★ 창밖으로 바람이 지나갔습니다.'), '이모지'],
    ['URL(https)', withText('조용한 오후였습니다. https://example.org 창밖으로 바람이 지나갔습니다.'), 'URL'],
    ['URL(www)', withText('조용한 오후였습니다. www.example 창밖으로 바람이 지나갔습니다.'), 'URL'],
    ['달력 연도(2031년)', withText('2031년 조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.'), '달력 연도'],
    ['달력 연도(1990년대)', withText('1990년대의 조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.'), '달력 연도'],
    ['달력 연도(80년대)', withText('80년대의 조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.'), '달력 연도'],
    ['실제 상호', withText('삼성 건물 앞을 지났습니다. 창밖으로 바람이 지나갔습니다.'), '실제 상호'],
    ['실제 사건', withText('월드컵이 열리던 오후였습니다. 창밖으로 바람이 지나갔습니다.'), '실제 상호'],
    ['실존 직함(대통령)', withText('대통령이 지나간 오후였습니다. 창밖으로 바람이 지나갔습니다.'), '실제 상호'],
    ['인터넷 말투(ㅋㅋ)', withText('조용한 오후였다 ㅋㅋ 창밖으로 바람이 지나갔습니다.'), '인터넷 말투'],
    ['과장(대박)', withText('대박 조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.'), '인터넷 말투'],
    ['과장(엄청)', withText('엄청 조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.'), '인터넷 말투'],
    ['원문 인용 표지', withText('출처를 밝히면 조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.'), '인용'],
    ['본문이 "~다."로 끝나지 않음', withText('조용한 오후였습니다. 창밖으로 바람이 지나갔어요.'), '서술체'],
    ['구어체 종결(~요.)', withText('조용한 오후였어요. 창밖으로 바람이 지나갔습니다.'), '구어체'],
    ['결과가 "~다."로 끝나지 않음', withResult('창문을 열었습니다. 바람이 방 안으로 들어왔다'), '서술체'],
    ['라벨이 "~다"로 끝나지 않음', withLabel('창문을 열까'), '서술체'],
    ['라벨 끝 마침표', withLabel('창문을 연다.'), '마침표'],
    ['제목 끝 마침표', base({ title: '기준 이벤트.' }), '마침표'],
  ];
  for (const [name, ev, fragment] of cases) {
    it(`${name} -> 걸린다 ("${fragment}")`, () => {
      const out = joined(ev);
      expect(out, '문제가 보고되지 않았다').not.toBe('');
      expect(out).toContain(fragment);
    });
  }

  it('문제 메시지에는 이벤트 id·위치·문제 글이 들어 있다 (어디를 고칠지 바로 보인다)', () => {
    const out = lintEvent(withResult('창문을 열었다! 바람이 방 안으로 들어왔습니다.'));
    expect(out.some((m) => m.includes('lint-base.choices[0](a).result') && m.includes('느낌표') && m.includes('창문을 열었다!'))).toBe(true);
  });
});

/** 한 글에서 인용(대사)만의 문장을 뺀 문장들의 어체 */
const tonesOf = (value: string): Tone[] => splitSentences(value).sentences.filter((s) => !s.quoteOnly).map((s) => toneOf(s.core));

describe('어체 판정 (M7e-1, 마스터 결정 C1·R2): 본문·결과는 문장마다 합쇼체 「~습니다./~ㅂ니다.」', () => {
  const HAPSYO = [
    '창문을 열었습니다.',
    '친구는 조용히 웃었습니다.',
    '그 방은 작은 방 하나였습니다.',
    '매일 아침 같은 길을 걷습니다.',
    '바람이 방 안으로 들어옵니다.',
    '그는 학교에 갑니다.',
    '이곳은 오래된 마을입니다.',
    '일을 새로 시작합니다.',
    '어머니는 말이 없으셨습니다.',
    '친구가 먼저 손을 내밀었다고 합니다.',
  ];
  const HAERA = [
    '창문을 열었다.',
    '친구는 조용히 웃었다.',
    '그 방은 작은 방 하나였다.',
    '매일 아침 같은 길을 걷는다.',
    '바람이 방 안으로 들어온다.',
    '그는 학교에 간다.',
    '이곳은 오래된 마을이다.',
    '일을 새로 시작한다.',
    '어머니는 말이 없으셨다.',
    '문은 열렸으나 대답은 없었다.',
  ];
  const OTHER = [
    '창문을 열었어요.', // 해요체
    '창문을 열었어.', // 반말
    '창문을 열었음.', // 명사형
    '창문을 열었습니다', // 마침표 없음
    '창문을 열었니다.', // 받침 ㅂ이 없는 「~니다」(오타)
    '창문을 열었네.', // 하게체
  ];

  it('합쇼체 문장 10개는 합쇼체로 판정된다 (「~습니다.」「~ㅂ니다.」 — 받침 ㅂ 앞 글자 포함)', () => {
    for (const s of HAPSYO) expect(tonesOf(s), s).toEqual(['hapsyo']);
  });

  it('해라체 문장 10개는 해라체로 판정된다 (「~했다.」「~한다.」「~이다.」)', () => {
    for (const s of HAERA) expect(tonesOf(s), s).toEqual(['haera']);
  });

  it('그 밖의 종결(해요체·반말·명사형·마침표 없음·받침 없는 「~니다」)은 other', () => {
    for (const s of OTHER) expect(tonesOf(s), s).toEqual(['other']);
  });

  it('문장 끝만 본다: 가운데의 연결 어미는 상관없다 (「~했습니다만 ~했다.」는 해라체, 「~했다고 합니다.」는 합쇼체)', () => {
    expect(tonesOf('문은 열었습니다만 대답은 없었다.')).toEqual(['haera']);
    expect(tonesOf('문은 열었으나 대답은 없었다고 합니다.')).toEqual(['hapsyo']);
  });

  it('여러 문장은 문장마다 판정한다', () => {
    expect(tonesOf('창문을 열었습니다. 바람이 들어왔다. 오후는 저물었습니다.')).toEqual(['hapsyo', 'haera', 'hapsyo']);
  });

  describe('이벤트 점검: 모든 이벤트는 합쇼체여야 한다', () => {
    it('합쇼체 본문은 통과한다 (합쇼체 문장 10개)', () => {
      for (const s of HAPSYO) expect(lintEvent(withText(`${s} 창밖으로 바람이 지나갔습니다.`)), s).toEqual([]);
    });

    it('해라체 문장이 하나라도 있으면 걸린다 (문장 10개 · 처음 · 가운데 · 끝, 본문 · 결과)', () => {
      for (const s of HAERA) {
        const out = joined(withText(`${s} 창밖으로 바람이 지나갔습니다.`));
        expect(out, s).toContain('해라체 종결');
        expect(out, s).toContain(s);
      }
      expect(joined(withText('조용한 오후였습니다. 창밖으로 바람이 지나갔다.'))).toContain('해라체 종결');
      expect(joined(withText('조용한 오후였습니다. 바람이 불었다. 창밖으로 구름이 지나갔습니다.'))).toContain('해라체 종결');
      const out = joined(withResult('창문을 열었다. 바람이 방 안으로 들어왔습니다.'));
      expect(out).toContain('choices[0](a).result');
      expect(out).toContain('해라체 종결');
    });

    it('해요체·반말·명사형 종결은 「합쇼체 서술체로 끝나지 않는다」로 걸린다', () => {
      for (const s of OTHER) expect(joined(withText(`창밖으로 바람이 지나갔습니다. ${s}`)), s).toContain('서술체');
    });

    it('이모지·느낌표·구어체·실제 이름 같은 기존 규칙은 합쇼체에서도 그대로 걸린다', () => {
      expect(joined(withText('조용한 오후였습니다! 창밖으로 바람이 지나갔습니다.'))).toContain('느낌표');
      expect(joined(withText('조용한 오후였어요. 창밖으로 바람이 지나갔습니다.'))).toContain('구어체');
      expect(joined(withText('삼성 건물 앞을 지났습니다. 창밖으로 바람이 지나갔습니다.'))).toContain('실제 상호');
      expect(joined(withText('엄청 조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.'))).toContain('인터넷 말투');
      expect(joined(withText('조용한 오후였습니다… 창밖으로 바람이 지나갔습니다.'))).toContain('말줄임표');
    });

    it('제목·선택지 라벨은 합쇼체 판정 대상이 아니다: 라벨은 지금처럼 「~다」로 끝나는 규칙 그대로다 (마스터 결정 R2)', () => {
      expect(lintEvent(withLabel('창문을 연다'))).toEqual([]);
      expect(lintEvent(withLabel('창문을 엽니다'))).toEqual([]);
      expect(lintEvent(base({ title: '조용한 오후' }))).toEqual([]);
      expect(joined(withLabel('창문을 열어요'))).toContain('서술체');
      expect(joined(withLabel('창문을 열까'))).toContain('서술체');
    });
  });

  describe('인용 부호 금지 (M7a r3, REV R-360 (a)안, 마스터 결정 47) · 소수점·괄호', () => {
    // 본문·결과에서 큰따옴표·작은따옴표·낫표를 쓰지 않는다 — 대사는 간접화법으로. 아래 두 문장 분리 함수(tonesOf·splitSentences)는 인용을 가리는 순수 계산으로 남아 있지만
    // lint는 부호가 있는 글 자체를 막는다(인용으로 감싼 해라체·반말 대사가 어체 점검을 건너뛰는 구멍).
    const QUOTE_MESSAGE = '인용 부호';

    it('본문·결과에 인용 부호가 하나라도 있으면 걸린다: 큰따옴표 · “ ” · ‘ ’ · 작은따옴표 · 낫표 「 」 · 『 』', () => {
      for (const [open, close] of [['"', '"'], ['“', '”'], ['‘', '’'], ['「', '」'], ['『', '』'], ["'", "'"]]) {
        const v = `${open}어서 가자.${close} 하고 친구가 말했습니다.`;
        expect(joined(withText(`${v} 창밖으로 바람이 지나갔습니다.`)), `본문 ${v}`).toContain(QUOTE_MESSAGE);
        expect(joined(withResult(`${v} 바람이 방 안으로 들어왔습니다.`)), `결과 ${v}`).toContain(QUOTE_MESSAGE);
      }
    });

    it('해라체·반말 대사 — 「괜찮아.」 — 는 더 이상 통과하지 않는다 (r2까지의 통과 단언이 구멍이었다: 마스터 결정 47은 대사의 해요체·반말 불허)', () => {
      expect(joined(withText('친구가 활짝 웃었습니다. "괜찮아."'))).toContain(QUOTE_MESSAGE);
      expect(joined(withText('"괜찮아." "고마워." 친구가 웃었습니다.'))).toContain(QUOTE_MESSAGE);
      expect(joined(withText('"가자." 하고 친구가 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toContain(QUOTE_MESSAGE);
      // 간접화법은 통과한다
      expect(lintEvent(withText('친구가 괜찮다고 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toEqual([]);
      expect(lintEvent(withText('친구는 어서 가자고 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toEqual([]);
    });

    it('본문 전체를 인용 부호로 감싸 어체·마침표 요구를 건너뛰는 구멍이 막혔다: 「"아이는 울었다." "어른이 달랬다."」', () => {
      const v = '"아이는 울었다." "어른이 달랬다."';
      expect(splitSentences(v).sentences.every((x) => x.quoteOnly)).toBe(true); // 문장 분리 함수는 여전히 인용만의 문장으로 본다
      expect(joined(withText(v))).toContain(QUOTE_MESSAGE); // lint는 부호 자체를 막는다
      expect(joined(withText('“아이는 울었다” “어른이 달랬다”'))).toContain(QUOTE_MESSAGE);
    });

    it('제목·선택지 라벨은 이 금지의 대상이 아니다 (본문·결과만)', () => {
      expect(joined(withLabel('"창문"을 연다'))).not.toContain(QUOTE_MESSAGE);
    });

    it('인용 부호가 없는 글의 풀: 실제 이벤트 140개의 본문·결과에 인용 부호가 0건이다', () => {
      expect(EVENT_POOL.events.flatMap((e) => lintEvent(e)).filter((m) => m.includes(QUOTE_MESSAGE))).toEqual([]);
    });

    it('큰따옴표 안의 해라체 대사는 어체 판정 함수(toneOf·splitSentences)에서 가려진다 — lint 밖의 순수 계산으로 남겨 둔 동작', () => {
      expect(tonesOf('"가자." 하고 친구가 말했습니다.')).toEqual(['hapsyo']);
    });

    it('따옴표 종류 — “ ” · ‘ ’ · 낫표 「 」 · 『 』 · 작은따옴표 — 문장 분리 함수에서는 모두 같다', () => {
      for (const [open, close] of [['“', '”'], ['‘', '’'], ['「', '」'], ['『', '』'], ["'", "'"]]) {
        const v = `${open}어서 가자.${close} 하고 친구가 말했습니다.`;
        expect(tonesOf(v), v).toEqual(['hapsyo']);
      }
    });

    it('대사 안에 마침표가 여럿이어도 한 문장이다 (대사 안 마침표는 문장을 가르지 않는다)', () => {
      const { sentences } = splitSentences('"가자. 어서." 하고 친구가 말했습니다. 바람이 불었습니다.');
      expect(sentences).toHaveLength(2);
      expect(sentences[0].raw).toBe('"가자. 어서." 하고 친구가 말했습니다.');
    });

    it('대사만으로 된 문장은 문장 분리 함수에서 인용만의 문장(quoteOnly)이다 — lint는 부호 자체를 막으므로 이 면제는 본문·결과에 닿지 않는다', () => {
      const v = '친구가 활짝 웃었습니다. "괜찮아."';
      const { sentences } = splitSentences(v);
      expect(sentences.map((s) => s.quoteOnly)).toEqual([false, true]);
    });

    it('대사가 있어도 따옴표 밖 서술이 해라체이면 걸린다 (대사로 서술을 가릴 수 없다)', () => {
      expect(tonesOf('"가자." 하고 친구가 말했다.')).toEqual(['haera']);
      expect(joined(withText('"가자." 하고 친구가 말했다. 창밖으로 바람이 지나갔습니다.'))).toContain('해라체 종결');
      expect(joined(withText('"가자." 친구가 말했습니다. 창밖으로 바람이 지나갔다.'))).toContain('해라체 종결');
      // 서술이 대사 뒤에 마침표만 붙는 명사형 종결도 걸린다
      expect(tonesOf('친구가 처음 한 말은 "엄마".')).toEqual(['other']);
    });

    it('인용 부호 안이어도 다른 규칙은 그대로 적용된다: 느낌표 · 구어체 종결(~요) · 실제 이름 (기존 규칙 유지)', () => {
      expect(joined(withText('"가자!" 하고 친구가 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toContain('느낌표');
      expect(joined(withText('"그만 해요." 하고 친구가 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toContain('구어체');
      expect(joined(withText('"삼성이야." 하고 친구가 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toContain('실제 상호');
    });

    it('인용 부호가 짝이 맞지 않으면 걸린다 (뒤를 통째로 인용으로 삼키지 않도록)', () => {
      expect(joined(withText('"가자 하고 친구가 말했습니다. 창밖으로 바람이 지나갔다.'))).toContain('인용 부호가 짝이 맞지 않는다');
      expect(joined(withText('가자” 하고 친구가 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toContain('인용 부호가 짝이 맞지 않는다');
      expect(joined(withText('「가자 하고 친구가 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toContain('인용 부호가 짝이 맞지 않는다');
      expect(maskQuotes('"가자 하고').unbalanced).toBe(true);
      expect(maskQuotes('"가자." 하고').unbalanced).toBe(false);
    });

    it('maskQuotes: 같은 길이로 가려 글자 위치가 그대로 맞는다', () => {
      const v = '친구는 "가자." 하고 말했습니다.';
      const { masked } = maskQuotes(v);
      expect(masked).toHaveLength(v.length);
      expect(masked.startsWith('친구는 ')).toBe(true);
      expect(masked.endsWith(' 하고 말했습니다.')).toBe(true);
      expect(masked).not.toContain('가자');
    });

    it('소수점·번호의 마침표는 문장 끝이 아니다 (「3.2kg」「1.5배」)', () => {
      const { sentences } = splitSentences('몸무게는 3.2kg이었습니다. 키는 평균의 1.5배였습니다.');
      expect(sentences.map((s) => s.raw)).toEqual(['몸무게는 3.2kg이었습니다.', '키는 평균의 1.5배였습니다.']);
      expect(tonesOf('몸무게는 3.2kg이었습니다.')).toEqual(['hapsyo']);
      expect(lintEvent(withText('몸무게는 3.2kg이었습니다. 키는 평균의 1.5배였습니다.'))).toEqual([]);
      // 해라체도 같은 방식으로 문장이 나뉜다
      expect(tonesOf('몸무게는 3.2kg이었다. 키는 평균의 1.5배였다.')).toEqual(['haera', 'haera']);
    });

    it('문장 끝 마침표 뒤의 닫는 괄호는 문장에 붙는다 (「(오래된 일입니다.)」)', () => {
      const { sentences } = splitSentences('(오래된 일입니다.) 지금도 기억합니다.');
      expect(sentences.map((s) => s.raw)).toEqual(['(오래된 일입니다.)', '지금도 기억합니다.']);
      expect(tonesOf('(오래된 일입니다.) 지금도 기억합니다.')).toEqual(['hapsyo', 'hapsyo']);
      expect(tonesOf('(오래된 일이다.)')).toEqual(['haera']);
    });

    it('한 문장 길이는 인용 부호를 포함한 원문으로 센다', () => {
      const quoted = `"${'가'.repeat(TEXT_LIMITS.sentence)}." 하고 말했습니다.`;
      expect(joined(withText(`${quoted} 바람이 불었습니다.`))).toContain('한 문장이');
    });
  });

  describe('이행 장치 없음 (M7e-3, 마스터 결정: 해라체 이행 목록·옛 길이 한도를 걷어냈다)', () => {
    const haeraBase = () =>
      base({
        text: '조용한 오후였다. 창밖으로 바람이 지나갔다.',
        choices: [
          { id: 'a', label: '창문을 연다', result: '창문을 열었다. 바람이 방 안으로 들어왔다.', effects: { stats: { happiness: 1 } } },
          { id: 'b', label: '그대로 둔다', result: '그대로 두었다. 오후는 천천히 저물었다.', effects: { stats: { health: 1 } } },
        ],
      });

    it('해라체 이벤트는 어느 점검 경로로도 통과하지 못한다 — 면제 수단이 없다 (lintEvent·lintEvents·lintEventData)', () => {
      expect(joined(haeraBase())).toContain('해라체 종결');
      expect(lintEvents([haeraBase()]).join('\n')).toContain('해라체 종결');
      expect(lintEventData([haeraBase()], { 'a.json': { note: '모티브로만 새로 쓴 글이다.', events: [] } }).join('\n')).toContain('해라체 종결');
    });

    it('이행 장치의 이름이 코어 모듈에 남아 있지 않다: 해라체 이행 목록 · 옛 길이 한도 · 이행 목록 점검 · 이벤트별 한도 함수', () => {
      for (const name of ['LEGACY_HAERACHE_IDS', 'LEGACY_HAERACHE_SET', 'LEGACY_TEXT_LIMITS', 'legacyListProblems', 'limitsFor']) {
        expect(Object.keys(core), name).not.toContain(name);
      }
    });

    it('한 이벤트에 해라체와 합쇼체가 섞여도 해라체 문장이 걸린다 (「어체가 섞였다」는 예외가 아니라 그냥 해라체 오류다)', () => {
      const mixed = base({ text: '조용한 오후였다. 창밖으로 바람이 지나갔습니다.' });
      expect(joined(mixed)).toContain('해라체 종결');
    });
  });
});

describe('해설 종결 금지 (M7e-3, 마스터 결정 E-11): 본문·결과의 문장이 「~것입니다」「~것이었습니다」「~때문입니다」로 끝나면 걸린다 — 대상을 가리키는 「그것입니다」는 통과한다', () => {
  const EXPLAIN = '해설 종결';
  const CAUGHT = [
    '끝내 하지 못한 말이 있던 것입니다.',
    '그날 일을 한 번도 말하지 않았던 것입니다.',
    '그렇게 한참을 기다렸던 것이었습니다.',
    '말을 아낀 것이었습니다.',
    '아무도 몰랐기 때문입니다.',
    '다들 바빴기 때문입니다',
    '아이가 떠나지 못한 것입니다',
  ];
  const PASSED = [
    '손에 쥔 것은 오래된 편지 한 장이었습니다.',
    '그가 찾던 것이 바로 그것입니다.',
    '남은 것은 이것입니다.',
    '필요한 것은 저것입니다.',
    '창밖의 것들이 조용히 지나갔습니다.',
    '아이의 손은 따뜻했습니다.',
    '모든 것이 달라졌습니다.',
  ];

  it.each(CAUGHT)('본문에서 걸린다: %s', (sentence) => {
    expect(joined(withText(`조용한 오후였습니다. ${sentence}`))).toContain(EXPLAIN);
  });

  it.each(CAUGHT)('선택지 결과에서도 걸린다: %s', (sentence) => {
    expect(joined(withResult(`창문을 열었습니다. ${sentence}`))).toContain(EXPLAIN);
  });

  it.each(PASSED)('통과한다: %s', (sentence) => {
    const out = joined(withText(`조용한 오후였습니다. ${sentence}`));
    expect(out, out).not.toContain(EXPLAIN);
  });

  it('제목·라벨에는 적용하지 않는다 (R2: 라벨은 명사구/「~한다」) — 해설 종결은 본문·결과의 서술 문장 규칙이다', () => {
    expect(joined(withLabel('그것이 마음이 가는 것이다'))).not.toContain(EXPLAIN);
  });

  it('실제 풀에는 해설 종결이 한 곳도 없다 (재작성 때 모두 장면 서술로 바꿨다)', () => {
    const hits = EVENT_POOL.events.flatMap((ev) => lintEvent(ev).filter((p) => p.includes(EXPLAIN)).map((p) => `${ev.id}: ${p}`));
    expect(hits).toEqual([]);
  });
});

describe('라벨·제목은 한글과 공백만 (M7e-4 C20, QA-003-M7e 2회차): 가운뎃점·쉼표·괄호·슬래시·숫자·영문이 든 글은 걸리고 한글·공백뿐인 글은 통과한다', () => {
  const RULE = '한글과 공백만';
  // 라벨 「가족·친척과 의논해 치른다」의 가운뎃점이 버튼 접근성 이름에 그대로 들어가 QA C20에 걸렸다 — 규칙이 없던 명세 누락
  const CAUGHT = [
    '가족·친척과 의논해 치른다', // 가운뎃점 (C20 원인)
    '먼저 말을 건다, 그러고 만다', // 쉼표
    '창문(큰 것)을 연다', // 괄호
    '위쪽/아래쪽을 본다', // 슬래시
    '2번째 창문을 연다', // 숫자
    'Wi-Fi를 켠다', // 영문·붙임표
  ];
  const PASSED = ['일가친척과 의논해 치른다', '가족이나 친척과 나누어 맡는다', '창문을 연다', '그대로 둔다', '무리를 해서라도 뒷받침한다'];

  it.each(CAUGHT)('라벨에서 걸린다: %s', (label) => {
    expect(joined(withLabel(label))).toContain(RULE);
  });

  it.each(CAUGHT)('제목에서도 걸린다: %s', (title) => {
    expect(joined(base({ title: title.replace(/다$/, '') }))).toContain(RULE);
  });

  it.each(PASSED)('통과한다: %s', (label) => {
    const out = joined(withLabel(label));
    expect(out, out).not.toContain(RULE);
    expect(joined(base({ title: label.replace(/다$/, '') }))).not.toContain(RULE);
  });

  it('본문·결과에는 적용하지 않는다 — 문장의 쉼표·괄호 없는 글은 그대로 통과 (기호 규칙은 라벨·제목만)', () => {
    expect(joined(withText('조용한 오후였습니다. 창밖으로, 바람이 지나갔습니다.'))).not.toContain(RULE);
  });

  it('실제 풀: 모든 이벤트의 제목과 선택지 라벨이 한글과 공백뿐이다 (설계상 기호·숫자가 필요한 제목·라벨은 없다)', () => {
    const bad = EVENT_POOL.events.flatMap((ev) => [ev.title, ...(ev.choices ?? []).map((c) => c.label)].filter((s) => /[^가-힣 ]/.test(s)).map((s) => `${ev.id} 「${s}」`));
    expect(bad).toEqual([]);
    expect(EVENT_POOL.events.flatMap((ev) => lintEvent(ev)).filter((p) => p.includes(RULE))).toEqual([]);
  });
});

describe('풀 전체가 합쇼체다 (M7e-3: 해라체 이행 장치를 걷어냈다)', () => {
  it('실제 풀: 모든 이벤트의 본문·결과 문장이 합쇼체이고, 문구 점검(어조·길이·상태 어휘)이 통과한다', () => {
    const problems = lintEvents(EVENT_POOL.events);
    expect(problems).toEqual([]);
    let sentences = 0;
    for (const ev of EVENT_POOL.events) {
      const tones = textPartsOf(ev)
        .filter((p) => p.kind === 'text' || p.kind === 'result')
        .flatMap((p) => tonesOf(p.value));
      sentences += tones.length;
      expect(tones.filter((t) => t !== 'hapsyo'), `${ev.id}: 합쇼체가 아닌 문장`).toEqual([]);
    }
    expect(sentences, '문장 수(공허 통과 방지)').toBeGreaterThan(700);
  });

  it('대조: 풀의 이벤트를 해라체로 되돌리면 걸린다 (되돌림 방지는 면제 수단이 없다는 구조가 한다)', () => {
    const reverted = EVENT_POOL.byId.get('school-lunch')!;
    const haera = { ...reverted, text: '점심시간이 되면 아이들은 저마다 도시락을 열었다. 누구의 반찬이 어떤지는 말하지 않아도 보였다.' };
    expect(lintEvent(haera).join('\n')).toContain('해라체 종결');
  });
});

describe('길이 권장 최대 (R-042, M7e-1 재산정, M7e-3 단일 한도): 넘으면 걸리고, 끝값은 통과한다', () => {
  /** 길이 n의 한 문장 (합쇼체 "~습니다.") */
  const fill = (n: number) => `${'가나다라마바사아자차 '.repeat(20)}`.slice(0, n - 4).trim().padEnd(n - 4, '가') + '습니다.';
  const L = TEXT_LIMITS;
  /** 합이 total인 두 문장 (각 문장은 한 문장 한도 안) */
  const twoOf = (total: number, make: (n: number) => string) => {
    const a = Math.ceil((total - 1) / 2);
    return `${make(a)} ${make(total - 1 - a)}`;
  };

  it('상한 값이 기대와 같다 (docs/data/events-schema.md 7절과 e2e/layout.spec.ts의 끝값 이벤트가 이 숫자를 쓴다)', () => {
    expect(TEXT_LIMITS).toEqual({ title: 16, text: 74, label: 24, result: 84, sentence: 52 });
  });

  it(`본문(합쇼체): 문장이 ${L.sentence}자 이하이면 ${L.text}자까지 통과, ${L.text + 1}자부터 걸린다`, () => {
    // 한 문장이 한도를 넘는 긴 문장은 문장 규칙에 걸린다(나눠 쓰라는 뜻)
    expect(joined(withText(fill(L.text)))).toContain('한 문장이');
    const atLimit = twoOf(L.text, fill);
    expect(atLimit.length).toBe(L.text);
    expect(lintEvent(withText(atLimit))).toEqual([]);
    expect(joined(withText(twoOf(L.text + 1, fill)))).toContain(`권장 최대 ${L.text}자`);
  });

  it(`한 문장: ${L.sentence}자는 통과, ${L.sentence + 1}자는 걸린다 (본문 ${L.text}자 안에서도)`, () => {
    expect(lintEvent(withText(`${fill(L.sentence)} ${fill(20)}`))).toEqual([]);
    expect(joined(withText(`${fill(L.sentence + 1)} ${fill(20)}`))).toContain(`한 문장이 ${L.sentence}자를 넘는다 (${L.sentence + 1}자)`);
  });

  it('제목 17자는 걸리고 16자는 통과한다', () => {
    expect(joined(base({ title: '가'.repeat(17) }))).toContain('권장 최대 16자');
    expect(lintEvent(base({ title: '가'.repeat(16) }))).toEqual([]);
  });

  it('라벨 25자는 걸리고 24자는 통과한다', () => {
    expect(joined(withLabel(`${'가'.repeat(24)}다`))).toContain('권장 최대 24자');
    expect(lintEvent(withLabel(`${'가'.repeat(23)}다`))).toEqual([]);
  });

  it(`결과(합쇼체): ${L.result}자는 통과하고 ${L.result + 1}자는 걸린다 (문장당 ${L.sentence}자 이하로 나눠 쓴다)`, () => {
    expect(joined(withResult(twoOf(L.result + 1, fill)))).toContain(`권장 최대 ${L.result}자`);
    expect(lintEvent(withResult(twoOf(L.result, fill)))).toEqual([]);
  });

});

describe('화면 길이 표본 (M7e-1, M7e-3 단일 한도): e2e 표본이 합쇼체·새 한도 규칙을 통과한다', () => {
  it('e2e 길이 표본(worst·natural)은 새 규칙(합쇼체·새 길이 한도)을 통과하고, 한도와 같은 길이다 (e2e/lengthSamples.ts)', () => {
    for (const id of LENGTH_SAMPLE_IDS) {
      const sample = lengthSample(id);
      expect(lintEvent(sample.event), id).toEqual([]);
      expect(sample.event.text.length, id).toBe(TEXT_LIMITS.text);
      for (const c of sample.event.choices!) expect(c.result.length, id).toBe(TEXT_LIMITS.result);
      expect(sample.longestSentence).toBeLessThanOrEqual(TEXT_LIMITS.sentence);
    }
    expect(lengthSample('worst').event.title.length).toBe(TEXT_LIMITS.title);
    for (const c of lengthSample('worst').event.choices!) expect(c.label.length).toBe(TEXT_LIMITS.label);
    // 표본의 인생 기록 줄도 한도 안이다
    for (const id of LENGTH_SAMPLE_IDS) for (const h of lengthSample(id).history) expect(h.text.length).toBeLessThanOrEqual(Math.max(TEXT_LIMITS.text, TEXT_LIMITS.result));
  });
});

describe('시대 소재 (R-045 d): 시대 중립 문구에 시대 소재가 섞이면 걸린다', () => {
  it('금지어 표: 지난 세상 = 새 소재 + 미래 소재 / 지금 세상 = 옛 소재 + 미래 소재 / 다가올 세상 = 옛 소재', () => {
    expect(new Set(ERA_BANNED_WORDS.past)).toEqual(new Set([...NEW_WORLD_WORDS, ...FUTURE_WORLD_WORDS]));
    expect(new Set(ERA_BANNED_WORDS.present)).toEqual(new Set([...OLD_WORLD_WORDS, ...FUTURE_WORLD_WORDS]));
    expect(new Set(ERA_BANNED_WORDS.future)).toEqual(new Set(OLD_WORLD_WORDS));
  });

  it('eras를 생략한(모든 시대) 이벤트의 금지어는 세 시대의 합이다', () => {
    const all = new Set(bannedWordsFor(undefined));
    for (const w of [...NEW_WORLD_WORDS, ...OLD_WORLD_WORDS, ...FUTURE_WORLD_WORDS]) expect(all.has(w), w).toBe(true);
    expect(new Set(bannedWordsFor(['past', 'present']))).toEqual(new Set([...NEW_WORLD_WORDS, ...OLD_WORLD_WORDS, ...FUTURE_WORLD_WORDS]));
  });

  it('QA가 지적한 문구가 걸린다: "학원 버스"(시대 중립), "텃밭과 라디오"(시대 중립·다가올 세상)', () => {
    expect(joined(withResult('방과 후마다 학원 버스에 올랐습니다. 숙제가 늘었고 성적도 천천히 올랐습니다.'))).toContain('학원');
    expect(joined(withResult('텃밭과 라디오와 낮잠으로 하루가 지나갔습니다. 조용했고 가끔은 적막했습니다.'))).toContain('라디오');
    expect(joined(base({ eras: ['future'], text: '텃밭에서 흙을 만지던 오후였습니다. 창밖으로 바람이 지나갔습니다.' }))).toContain('텃밭');
  });

  it('새 소재는 지금·다가올 세상 전용이면 쓸 수 있지만 지난 세상에는 쓸 수 없다', () => {
    const text = '메신저로 온 짧은 안부를 오래 들여다보았습니다. 창밖으로 바람이 지나갔습니다.';
    expect(lintEvent(base({ eras: ['present', 'future'], text }))).toEqual([]);
    expect(joined(base({ eras: ['past'], text }))).toContain('메신저');
    expect(joined(base({ eras: ['past', 'present'], text }))).toContain('메신저');
    expect(joined(base({ text }))).toContain('메신저');
  });

  it('옛 소재는 지난 세상 전용이면 쓸 수 있지만 지금·다가올 세상에는 쓸 수 없다', () => {
    const text = '연탄불이 꺼지지 않게 밤새 살피던 오후였습니다. 창밖으로 바람이 지나갔습니다.';
    expect(lintEvent(base({ eras: ['past'], text }))).toEqual([]);
    expect(joined(base({ eras: ['present'], text }))).toContain('연탄');
    expect(joined(base({ eras: ['future'], text }))).toContain('연탄');
  });

  it('미래 소재는 다가올 세상 전용에서만 쓸 수 있다', () => {
    const text = '로봇이 청소를 맡게 된 오후였습니다. 창밖으로 바람이 지나갔습니다.';
    expect(lintEvent(base({ eras: ['future'], text }))).toEqual([]);
    expect(joined(base({ eras: ['present', 'future'], text }))).toContain('로봇');
    expect(joined(base({ text }))).toContain('로봇');
  });
});

describe('영유아 시대 금지어 (SPEC-003 M7a IN6, 마스터 결정 M-4): 지난 세상 9개, 지금·다가올 세상 3개, 「학습지」는 금지하지 않는다', () => {
  const PAST_BANNED = ['육아휴직', '어린이집', '영어 유치원', '유아 영어', '키즈카페', '문화센터', '산후조리원', '층간소음', '돌봄 도우미'] as const;
  const OLD_BANNED = ['탁아소', '젖동냥', '아랫목'] as const;
  const sentenceWith = (word: string) => `${word}을 둘러싼 이야기가 오갔습니다. 창밖으로 바람이 지나갔습니다.`;

  it('표: 지난 세상 금지어 표에 아홉 개가 모두 있고, 지금·다가올 세상 표에는 옛 영유아 소재 셋이 있다. 「학습지」는 어느 표에도 없다', () => {
    for (const w of PAST_BANNED) {
      expect(ERA_BANNED_WORDS.past, w).toContain(w);
      expect(NEW_WORLD_WORDS, w).toContain(w);
      expect(ERA_BANNED_WORDS.present, w).not.toContain(w);
      expect(ERA_BANNED_WORDS.future, w).not.toContain(w);
    }
    for (const w of OLD_BANNED) {
      expect(ERA_BANNED_WORDS.present, w).toContain(w);
      expect(ERA_BANNED_WORDS.future, w).toContain(w);
      expect(OLD_WORLD_WORDS, w).toContain(w);
      expect(ERA_BANNED_WORDS.past, w).not.toContain(w);
    }
    for (const era of ERAS) expect(ERA_BANNED_WORDS[era], era).not.toContain('학습지');
  });

  describe('걸리는 문장: 지난 세상 전용 이벤트에 아홉 개 낱말이 하나라도 있으면 걸린다', () => {
    for (const w of PAST_BANNED) {
      it(`지난 세상 전용 + 「${w}」 → 걸린다`, () => {
        const out = joined(base({ eras: ['past'], text: sentenceWith(w), stages: ['infant'] }));
        expect(out).toContain('시대');
        expect(out).toContain(w);
      });
    }
    it('시대를 정하지 않은(모든 시대) 이벤트도 걸린다 — 지난 세상이 들어 있기 때문이다', () => {
      for (const w of PAST_BANNED) expect(joined(base({ text: sentenceWith(w), stages: ['infant'] })), w).toContain(w);
    });
    it('지난 세상 노년 전용에서도 걸린다 (새 기기 소재만 노년에서 풀리고 영유아 돌봄 소재는 그대로 금지다)', () => {
      expect(joined(base({ eras: ['past'], stages: ['senior'], text: sentenceWith('어린이집') }))).toContain('어린이집');
    });
    for (const w of OLD_BANNED) {
      it(`지금 세상 전용 + 「${w}」 → 걸린다 / 다가올 세상 전용도 걸린다`, () => {
        for (const era of ['present', 'future'] as const) {
          const out = joined(base({ eras: [era], text: sentenceWith(w), stages: ['infant'] }));
          expect(out, `${era} ${w}`).toContain(w);
        }
      });
    }
  });

  describe('통과하는 문장: 알맞은 시대에서는 같은 낱말이 통과한다', () => {
    for (const w of PAST_BANNED) {
      it(`지금·다가올 세상 전용 + 「${w}」 → 통과한다 (지난 세상에는 없던 말이다)`, () => {
        expect(lintEvent(base({ eras: ['present', 'future'], text: sentenceWith(w), stages: ['infant'] })), w).toEqual([]);
        expect(lintEvent(base({ eras: ['present'], text: sentenceWith(w), stages: ['infant'] })), w).toEqual([]);
      });
    }
    for (const w of OLD_BANNED) {
      it(`지난 세상 전용 + 「${w}」 → 통과한다 (겨울밤의 아랫목처럼 옛 소재다)`, () => {
        expect(lintEvent(base({ eras: ['past'], text: sentenceWith(w), stages: ['infant'] })), w).toEqual([]);
      });
    }
    it('「학습지」는 어느 시대에서도 통과한다 (1970~80년대에도 있던 말이다)', () => {
      const text = '학습지를 푸는 저녁이 이어졌습니다. 창밖으로 바람이 지나갔습니다.';
      for (const eras of [['past'], ['present'], ['future'], undefined] as const) expect(lintEvent(base({ eras, text, stages: ['infant'] })), String(eras)).toEqual([]);
    });
    it('실제 풀: 지난 세상 전용 「겨울밤의 아랫목」(infant-coal-winter)은 통과하고, 지난 세상에서 열리는 영유아 이벤트에는 아홉 개 낱말이 없다', () => {
      const coal = EVENT_POOL.byId.get('infant-coal-winter')!;
      expect(coal.eras).toEqual(['past']);
      expect(JSON.stringify(coal)).toContain('아랫목');
      expect(lintEvent(coal)).toEqual([]);
      for (const e of EVENT_POOL.events) {
        if (e.eras !== undefined && !e.eras.includes('past')) continue;
        const text = JSON.stringify(e);
        for (const w of PAST_BANNED) expect(text, `${e.id}: ${w}`).not.toContain(w);
      }
      for (const e of EVENT_POOL.events) {
        if (e.eras !== undefined && !e.eras.includes('present') && !e.eras.includes('future')) continue;
        if (e.id === 'infant-coal-winter') continue;
        for (const w of OLD_BANNED) expect(JSON.stringify(e), `${e.id}: ${w}`).not.toContain(w);
      }
    });
  });
});

describe('구어체 점검이 「가요」 같은 꼴까지 잡는다 (M7a, 마스터 결정 3 — 옛 점검은 일곱 꼴만 걸렸다)', () => {
  /** M7a 이전의 구어체 정규식(옛 점검) — 대조용 */
  const OLD_COLLOQUIAL = /(?:어요|아요|에요|예요|해요|죠|네요|세요)(?=[.\s]|$)|니까(?=\.|$)/;
  const tail = ' 창밖으로 바람이 지나갔습니다.';
  const CAUGHT_NEW = [
    '그만 가요.', // 마스터가 짚은 꼴
    '어서 와요.',
    '같이 봐요.',
    '이것 좀 줘요.',
    '여기 서요.',
    '이렇게 써요.',
    '이제 돼요.',
    '내일 갈게요.',
    '비가 올까요.',
    '그랬거든요.',
    '맛있는데요.',
    '그렇군요.',
  ];
  const CAUGHT_OLD_TOO = ['그랬어요.', '좋아요.', '친구예요.', '이게 집이에요.', '열심히 해요.', '정말 그렇네요.', '이쪽으로 오세요.', '그랬죠.'];

  it('옛 점검이 못 잡던 꼴(가요·와요·봐요·줘요·서요·써요·돼요·~ㄹ게요·~ㄹ까요·~거든요·~는데요·~군요)을 이제 잡는다 — 옛 정규식으로는 통과였다', () => {
    for (const s of CAUGHT_NEW) {
      expect(OLD_COLLOQUIAL.test(s), `${s}: 옛 점검이 못 잡던 꼴`).toBe(false);
      expect(joined(withText(s + tail)), s).toContain('구어체');
    }
  });

  it('옛 점검이 잡던 꼴은 그대로 잡는다 (어요·아요·예요·에요·해요·네요·세요·죠)', () => {
    for (const s of CAUGHT_OLD_TOO) {
      expect(OLD_COLLOQUIAL.test(s), s).toBe(true);
      expect(joined(withText(s + tail)), s).toContain('구어체');
    }
  });

  it('문장 가운데 낱말 끝의 「요」도 걸린다 (「그만 가요 하고 말했습니다」)', () => {
    expect(joined(withText('그만 가요 하고 말했습니다.' + tail))).toContain('구어체');
    expect(joined(withText('"그만 가요." 하고 친구가 말했습니다.' + tail))).toContain('구어체'); // 인용 안에서도 (마스터 결정 1: 대사의 해요체는 쓰지 않는다)
  });

  it('「요」로 끝나는 한자어 명사는 걸리지 않는다 (필요·중요·주요·수요·소요·강요·동요·민요·개요·풍요)', () => {
    const fine = [
      '도움이 필요했습니다.',
      '필요 없는 짐을 내려놓았습니다.',
      '그날은 아주 중요한 날이었습니다.',
      '중요 서류를 챙겼습니다.',
      '주요 일정을 마쳤습니다.',
      '수요가 늘어난 해였습니다.',
      '시간이 소요되었습니다.',
      '강요 없이 지켜보았습니다.',
      '동요를 따라 불렀습니다.',
      '동요 한 가락이 들렸습니다.',
      '민요를 들려주었습니다.',
      '개요를 먼저 들었습니다.',
      '풍요 속에서도 허전했습니다.',
    ];
    for (const s of fine) expect(joined(withText(s + tail)), s).not.toContain('구어체');
  });

  it('실제 풀 140개 이벤트에는 구어체가 없다 (넓힌 점검이 정상 문장을 잘못 잡지 않는다)', () => {
    expect(EVENT_POOL.events.flatMap((e) => lintEvent(e)).filter((m) => m.includes('구어체'))).toEqual([]);
  });
});

describe('반복·중복 (QA 사용감 7)', () => {
  it('once:false 이벤트는 cooldown이 15년 미만이면(또는 생략하면) 걸린다', () => {
    expect(joined(base({ once: false, cooldown: 10 }))).toContain('cooldown');
    expect(joined(base({ once: false }))).toContain('cooldown');
    expect(lintEvent(base({ once: false, cooldown: MIN_REPEAT_COOLDOWN }))).toEqual([]);
    expect(lintEvent(base({ once: true }))).toEqual([]);
  });

  it('다른 이벤트와 제목·본문·결과가 똑같으면 걸린다 (라벨은 겹쳐도 된다)', () => {
    const a = base();
    const b = { ...base(), id: 'lint-other' };
    const out = lintEvents([a, b]).join('\n');
    expect(out).toContain('문구가 똑같다');
    // 라벨만 같고 나머지가 다르면 통과
    const c = { ...base({ title: '다른 제목', text: '전혀 다른 오후의 이야기를 적은 본문이었습니다.' }), id: 'lint-third' };
    const cc = { ...c, choices: c.choices!.map((ch, i) => ({ ...ch, result: `다른 결과 문장 ${i}번이었습니다.` })) } as EventDef;
    expect(lintEvents([a, cc])).toEqual([]);
  });
});

/** 검증(플래그가 어딘가에서 켜지는지)을 거치지 않고 만든 이벤트 — 조건·단계·id를 마음대로 줄 수 있다 */
const raw = (over: Record<string, unknown>): EventDef => ({ ...base(), ...over }) as EventDef;
const choiceOf = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  label: '창문을 연다',
  result: '창문을 열었습니다. 바람이 방 안으로 들어왔습니다.',
  effects: { stats: { happiness: 1 } },
  ...over,
});

describe('오탐 예외 (R-067): 정상 문구는 통과하고, 진짜 위반은 여전히 걸린다', () => {
  const tail = ' 창밖으로 바람이 지나갔습니다.';
  const normal: Array<[string, string]> = [
    ['헐값("헐")', '헐값에 넘긴 물건이 오래 마음에 걸렸습니다.'],
    ['헐렁한 옷("헐")', '헐렁한 옷을 입고 길을 나섰습니다.'],
    ['영향을 미친 일("미친")', '그 일이 마음에 영향을 미친 오후였습니다.'],
    ['미친 영향("미친")', '오래 미친 영향을 가늠해 보는 오후였습니다.'],
    ['펌프("펌")', '마당의 펌프에서 물소리가 났습니다.'],
    ['우물쭈물("우물")', '우물쭈물하다 말할 때를 놓쳤습니다.'],
    ['폭풍우("폭풍")', '폭풍우가 지나간 오후였습니다.'],
    ['현대적("현대")', '현대적인 건물이 들어선 오후였습니다.'],
    ['연결 어미 ~니까("니까")', '비가 오니까 우산을 챙겨 나갔습니다.'],
    ['받아들이다("아들")', '그 말을 천천히 받아들였습니다.'],
    ['잦아들다("아들")', '소란이 서서히 잦아들었습니다.'],
    ['딸기("딸")', '딸기 향이 퍼진 오후였습니다.'],
  ];
  for (const [name, head] of normal) {
    it(`정상 문구 통과: ${name}`, () => {
      expect(lintEvent(withText(head + tail))).toEqual([]);
    });
  }

  const bad: Array<[string, string, string]> = [
    ['감탄으로 쓴 "헐"', '헐 하고 소리가 절로 났습니다.', '인터넷 말투'],
    ['"미친 듯이"', '미친 듯이 달려간 오후였습니다.', '인터넷 말투'],
    ['인용 표지 "펌"', '펌 글에서 본 이야기였습니다.', '인용'],
    ['문장 끝 ~니까', '비가 왔으니까.', '구어체'],
    ['~죠', '조용했죠 그날은.', '구어체'],
    ['건설사 "현대"', '현대 건설 앞을 지났습니다.', '실제 상호'],
    ['"폭풍 눈물"', '폭풍 눈물이 쏟아진 오후였습니다.', '인터넷 말투'],
  ];
  for (const [name, head, fragment] of bad) {
    it(`진짜 위반은 걸린다: ${name}`, () => {
      expect(joined(withText(head + tail))).toContain(fragment);
    });
  }

  it('예외 표(SAFE_PHRASES)를 거치면 정상 표현은 지워지고 위반 표현은 남는다', () => {
    expect(stripSafePhrases('헐값에 영향을 미친 펌프')).not.toMatch(/헐|미친|펌/);
    expect(stripSafePhrases('헐 소리가 났다')).toContain('헐');
  });
});

describe('시대 금지어를 생애 단계별로 (R-067): 지난 세상 노년의 휴대전화·인터넷은 허용한다', () => {
  const text = '휴대전화로 온 짧은 안부를 오래 들여다보았습니다. 창밖으로 바람이 지나갔습니다.';

  it('bannedWordsFor: 노년 전용 이벤트는 지난 세상이어도 새 기기 소재가 금지어에서 빠진다 (학창 소재 "학원·급식"과 미래 소재는 그대로 금지)', () => {
    const seniorPast = bannedWordsFor(['past'], ['senior']);
    for (const w of PAST_ALLOWED_NEW_WORDS) expect(seniorPast, w).not.toContain(w);
    expect(seniorPast).toContain('학원');
    expect(seniorPast).toContain('급식');
    expect(seniorPast).toContain('로봇');
    expect(bannedWordsFor(['past'], ['senior'])).toEqual(expect.arrayContaining([...FUTURE_WORLD_WORDS]));
  });

  it('bannedWordsFor: 노년이 아닌 단계가 하나라도 걸치거나 단계를 주지 않으면 지난 세상의 새 소재가 모두 금지다', () => {
    for (const stages of [['youth'], ['middle', 'senior'], ['school', 'youth'], undefined] as const) {
      const banned = bannedWordsFor(['past'], stages as never);
      for (const w of NEW_WORLD_WORDS) expect(banned, `${stages?.join('·')}: ${w}`).toContain(w);
    }
  });

  it('다른 시대의 금지어는 단계와 무관하다: 지금·다가올 세상의 옛 소재 금지는 노년에도 그대로다', () => {
    for (const era of ['present', 'future'] as const) {
      const banned = bannedWordsFor([era], ['senior']);
      for (const w of OLD_WORLD_WORDS) expect(banned, `${era}: ${w}`).toContain(w);
    }
  });

  it('이벤트 점검: 노년 전용 이벤트는 지난 세상·모든 시대에서 휴대전화를 쓸 수 있다', () => {
    expect(lintEvent(base({ stages: ['senior'], eras: ['past'], text }))).toEqual([]);
    expect(lintEvent(base({ stages: ['senior'], text }))).toEqual([]);
  });

  it('이벤트 점검: 청년·중년이나 청년+노년에 걸친 이벤트는 지난 세상에서 걸린다', () => {
    expect(joined(base({ stages: ['youth'], eras: ['past'], text }))).toContain('휴대전화');
    expect(joined(base({ stages: ['middle', 'senior'], eras: ['past'], text }))).toContain('휴대전화');
    expect(joined(base({ stages: ['school'], text }))).toContain('휴대전화');
  });

  it('이벤트 점검: 노년 전용이어도 학창 소재(학원)와 미래 소재(로봇)는 지난 세상에서 걸린다', () => {
    expect(joined(base({ stages: ['senior'], eras: ['past'], text: '학원 앞을 지나던 오후였습니다. 창밖으로 바람이 지나갔습니다.' }))).toContain('학원');
    expect(joined(base({ stages: ['senior'], text: '로봇이 청소를 맡게 된 오후였습니다. 창밖으로 바람이 지나갔습니다.' }))).toContain('로봇');
  });

  it('실제 풀: senior-new-device는 모든 시대에 열려 있고(지난 세상 노년에게 낯선 기계가 온다) 점검을 통과한다', () => {
    const ev = EVENT_POOL.byId.get('senior-new-device')!;
    expect(ev.eras).toBeUndefined();
    expect(ev.stages).toEqual(['senior']);
    expect(lintEvent(ev)).toEqual([]);
  });
});

describe('상태 어휘 (R-067): 가족·부모님·일터·혼자 같은 말은 그 상태를 요구하는 조건 없이 쓰이지 않는다', () => {
  const tail = ' 창밖으로 바람이 지나갔다.';
  const textEv = (head: string, over: Record<string, unknown> = {}) => raw({ text: head + tail, ...over });

  it('규칙 표: 자식·배우자·부모님·일터·혼자 다섯 가지가 있고, 예외는 아이를 가질지 정하는 두 이벤트와 임종 이벤트뿐이다', () => {
    expect(STATE_WORD_RULES.map((r) => r.name.split('(')[0])).toEqual(['자식·손주', '배우자', '부모님', '일터', '혼자']);
    expect(STATE_WORD_RULES.flatMap((r) => r.exceptions).sort()).toEqual(['middle-parents-farewell', 'youth-child', 'youth-child-again']);
  });

  describe('자식·손주 -> has_child', () => {
    for (const word of ['자식에게 남길지 고민하는 날이 늘었다.', '손주 이야기가 오갔다.', '아들이 다녀간 날이었다.', '큰딸이 전화를 걸어 왔다.', '아이도 일도 한숨 돌릴 무렵이었다.']) {
      it(`"${word}"는 has_child 없이는 걸리고, 있으면 통과한다`, () => {
        expect(stateWordProblems(textEv(word, { stages: ['middle'] })).join('\n')).toContain('has_child');
        expect(stateWordProblems(textEv(word, { stages: ['middle'], conditions: { flags: ['has_child'] } }))).toEqual([]);
      });
    }
    it('notFlags만으로는 부족하다 (has_child를 요구해야 한다)', () => {
      expect(stateWordProblems(textEv('자식 이야기가 오갔다.', { stages: ['senior'], conditions: { notFlags: ['child_distant'] } })).join('\n')).toContain('has_child');
    });
    it('영유아·학창기의 "아이"는 나 자신이나 또래라 가족어가 아니다', () => {
      expect(stateWordProblems(textEv('아이가 열이 올라 울기 시작했다.', { stages: ['infant'] }))).toEqual([]);
      expect(stateWordProblems(textEv('같은 반 한 아이가 혼자 앉아 있었다.', { stages: ['school'] }))).toEqual([]);
    });
    it('아이를 가질지 정하는 이벤트(youth-child · youth-child-again)는 예외다', () => {
      expect(stateWordProblems(textEv('아이를 가질지 이야기를 나누었다.', { id: 'youth-child', stages: ['youth'] }))).toEqual([]);
      expect(stateWordProblems(textEv('아이를 가질지 이야기를 나누었다.', { id: 'youth-other', stages: ['youth'] })).join('\n')).toContain('has_child');
    });
    it('"받아들이다·딸기·아이디어"는 가족어가 아니다', () => {
      expect(stateWordProblems(textEv('그 말을 받아들였고 딸기 값과 아이디어를 떠올렸다.', { stages: ['middle'] }))).toEqual([]);
    });
    it('선택지 글은 그 선택지의 requires로 충족할 수 있고, 다른 선택지에는 적용되지 않는다', () => {
      const ev = raw({
        stages: ['senior'],
        choices: [
          choiceOf('kid', { label: '손주를 돌본다', result: '손주의 손을 잡고 길을 나섰다. 몸은 힘들었지만 웃음이 가득했다.', requires: { flags: ['has_child'] } }),
          choiceOf('plain', { label: '쉬며 지낸다', effects: { stats: { health: 1 } } }),
        ],
      });
      expect(stateWordProblems(ev)).toEqual([]);
      const unguarded = raw({ stages: ['senior'], choices: [choiceOf('kid', { label: '손주를 돌본다' }), choiceOf('plain', { label: '쉬며 지낸다', effects: { stats: { health: 1 } } })] });
      expect(stateWordProblems(unguarded).join('\n')).toContain('choices[0](kid).label');
    });
  });

  describe('배우자 -> married', () => {
    for (const word of ['배우자와 마주 앉은 날이었다.', '남편이 먼저 입을 열었다.', '아내의 손을 오래 잡았다.', '부부가 모두 일하던 시절이었다.']) {
      it(`"${word}"는 married 없이는 걸리고, 있으면 통과한다`, () => {
        expect(stateWordProblems(textEv(word, { stages: ['middle'] })).join('\n')).toContain('married');
        expect(stateWordProblems(textEv(word, { stages: ['middle'], conditions: { flags: ['married'] } }))).toEqual([]);
      });
    }
  });

  describe('부모님 -> 임종 뒤에는 나오지 않는다 (notFlags parents_gone)', () => {
    it('중년·노년 이벤트의 "부모님"은 parents_gone이 notFlags에 없으면 걸린다', () => {
      expect(stateWordProblems(textEv('부모님의 몸이 불편해지셨다.', { stages: ['middle'] })).join('\n')).toContain('parents_gone');
      expect(stateWordProblems(textEv('부모님의 몸이 불편해지셨다.', { stages: ['middle'], conditions: { notFlags: ['parents_gone'] } }))).toEqual([]);
      expect(stateWordProblems(textEv('부모님이 떠올랐다.', { stages: ['senior'] })).join('\n')).toContain('parents_gone');
    });
    it('청년기까지는 부모님이 살아 계시므로 적용하지 않는다 (부모님 집에 머문다)', () => {
      expect(stateWordProblems(textEv('부모님 집에 머물기로 했다.', { stages: ['youth'] }))).toEqual([]);
    });
    it('임종 이벤트(middle-parents-farewell)는 예외이고, 학부모·또래 부모처럼 내 부모가 아닌 말은 걸리지 않는다', () => {
      expect(stateWordProblems(textEv('부모님이 마지막 숨을 몰아쉬는 날이 왔다.', { id: 'middle-parents-farewell', stages: ['middle'] }))).toEqual([]);
      expect(stateWordProblems(textEv('학부모 모임이 어색했다.', { stages: ['middle'] }))).toEqual([]);
    });
  });

  describe('일터 -> has_career 또는 own_business', () => {
    for (const word of ['마지막 출근날이었다.', '일터에서 갑자기 쓰러졌다.', '회사가 사람을 줄이기로 했다.', '직장 동료가 먼저 인사했다.', '퇴근길이 유난히 길었다.', '상사의 지시가 이어졌다.']) {
      it(`"${word}"는 직업 플래그 없이는 걸리고, 있으면 통과한다`, () => {
        expect(stateWordProblems(textEv(word, { stages: ['middle'] })).join('\n')).toContain('has_career');
        expect(stateWordProblems(textEv(word, { stages: ['middle'], conditions: { flags: ['has_career'] } }))).toEqual([]);
        expect(stateWordProblems(textEv(word, { stages: ['middle'], conditions: { flags: ['own_business'] } }))).toEqual([]);
      });
    }
    it('학창기(주말 일터)에는 적용하지 않는다', () => {
      expect(stateWordProblems(textEv('주말은 일터에서 지나갔다.', { stages: ['school'] }))).toEqual([]);
    });
  });

  describe('혼자 -> 기혼 판에는 나오지 않는다 (notFlags married)', () => {
    it('성인 이벤트의 "혼자"는 married가 notFlags에 없으면 걸린다', () => {
      expect(stateWordProblems(textEv('혼자 지내기에는 집이 버거워졌다.', { stages: ['senior'] })).join('\n')).toContain('married');
      expect(stateWordProblems(textEv('혼자 지내기에는 집이 버거워졌다.', { stages: ['senior'], conditions: { notFlags: ['has_partner', 'married'] } }))).toEqual([]);
    });
    it('학창기의 "혼자 공부한다"는 걸리지 않는다', () => {
      expect(stateWordProblems(textEv('혼자 공부하는 저녁이었다.', { stages: ['school'] }))).toEqual([]);
    });
  });

  describe('리뷰 REV-001-M4-1이 지적한 옛 문구를 그대로 넣으면 빌드가 잡는다 (R-057~R-060, R-065)', () => {
    const originals: Array<[string, Record<string, unknown>, string]> = [
      ['middle-hobby "아이도 일도"', { stages: ['middle'], text: '아이도 일도 한숨 돌릴 무렵, 오래 미뤄 둔 것을 해 볼 마음이 들었다.' }, 'has_child'],
      ['senior-estate "자식에게 남길지"', { stages: ['senior'], text: '가진 것을 어떻게 정리할지 생각하는 날이 늘었다. 자식에게 남길지, 내가 쓸지 정해야 했다.' }, 'has_child'],
      ['senior-move-home "혼자 지내기에는"', { stages: ['senior'], text: '혼자 지내기에는 집이 점점 버거워졌다. 어디에서 남은 시간을 보낼지 가족이 의논했다.' }, 'married'],
      ['youth-housing "혼자 힘으로"', { stages: ['youth'], text: '혼자 힘으로 살 곳을 구해야 했다. 가진 돈과 원하는 곳 사이의 거리가 멀었다.' }, 'married'],
      ['senior-retire "마지막 출근날"', { stages: ['senior'], text: '마지막 출근날, 책상을 정리하는 데는 생각보다 시간이 걸리지 않았다. 돌아오는 길이 유난히 길게 느껴졌다.' }, 'has_career'],
      ['middle-health-crisis "일터에서 갑자기 쓰러져"', { stages: ['middle'], text: '결과표를 접어 두었던 몸이 끝내 신호를 보냈다. 일터에서 갑자기 쓰러져 병원으로 옮겨졌다.' }, 'has_career'],
      ['middle-parents-farewell "일터에서였다"', { stages: ['middle'], id: 'middle-parents-farewell', text: '부모님이 마지막 숨을 몰아쉬는 날이 왔다. 연락을 받은 것은 일터에서였다.' }, 'has_career'],
      ['middle-parents-care(임종 뒤 병환)', { stages: ['middle'], text: '부모님의 몸이 눈에 띄게 불편해지셨다. 누가, 어디서, 어떻게 돌볼지 형제들과 이야기를 나눠야 했다.' }, 'parents_gone'],
      ['middle-new-skills "회사는"', { stages: ['middle'], text: '하던 일의 상당 부분을 기계가 대신하게 되었다. 회사는 새로운 방식을 배울 사람을 찾고 있었다.' }, 'has_career'],
    ];
    for (const [name, over, flag] of originals) {
      it(`${name} -> 걸린다 (${flag})`, () => {
        expect(stateWordProblems(raw(over)).join('\n')).toContain(flag);
      });
    }
  });

  it('실제 풀 전체가 상태 어휘 규칙을 지킨다', () => {
    expect(EVENT_POOL.events.flatMap(stateWordProblems)).toEqual([]);
  });
});

describe('영유아 문구는 3인칭 (R-070)', () => {
  const tail = ' 어른들의 손길이 곁에 있었습니다.';
  it('영유아 이벤트에 1인칭("나·내")이 있으면 걸린다', () => {
    for (const head of ['그 품은 여전히 내 자리였습니다.', '나는 조부모님 곁에서 지냈습니다.', '조부모님은 나를 안아 주었습니다.', '저는 그 노래를 기억한다.']) {
      expect(joined(raw({ stages: ['infant'], text: head + tail })), head).toContain('1인칭');
    }
  });
  it('"아이"로 쓰면 통과하고, "내리다·안내" 같은 낱말 속의 "내"는 걸리지 않는다', () => {
    expect(lintEvent(raw({ stages: ['infant'], text: `그 품은 여전히 아이의 자리였습니다.${tail}` }))).toEqual([]);
    expect(lintEvent(raw({ stages: ['infant'], text: `비가 내리는 날 안내를 받았습니다.${tail}` }))).toEqual([]);
  });
  it('학창 이후에는 1인칭이 자연스럽다 (회고하는 "나")', () => {
    expect(lintEvent(raw({ stages: ['school'], text: `나는 내 친구들과 어울렸습니다.${tail}` }))).toEqual([]);
  });
  it('실제 영유아 이벤트 11개는 3인칭이다', () => {
    const infant = EVENT_POOL.events.filter((e) => e.stages.every((s) => s === 'infant'));
    expect(infant.length).toBeGreaterThanOrEqual(11);
    for (const e of infant) expect(lintEvent(e).filter((m) => m.includes('1인칭')), e.id).toEqual([]);
  });
});

describe('선택지 균형 (R-069): 정답이 정해져 있거나 효과가 같은 선택지는 걸린다', () => {
  const evOf = (...choices: ReturnType<typeof choiceOf>[]) => raw({ choices });

  it('한쪽이 모든 수치에서 낫거나 같으면(어딘가는 확실히 낫다) 걸린다', () => {
    const out = choiceBalanceProblems(evOf(choiceOf('a', { effects: { stats: { happiness: 3, relationships: 2 } } }), choiceOf('b', { effects: { stats: { happiness: 1 } } }))).join('\n');
    expect(out).toContain('a가 b보다 모든 수치에서 낫거나 같다');
  });

  it('효과가 완전히 같으면 걸린다 (고르는 의미가 없다)', () => {
    const out = choiceBalanceProblems(evOf(choiceOf('a', { effects: { stats: { happiness: -1 } } }), choiceOf('b', { effects: { stats: { happiness: -1 } } }))).join('\n');
    expect(out).toContain('효과가 완전히 같다');
  });

  it('서로 다른 스탯에서 낫다면 통과한다 (소극적 선택의 작은 이득)', () => {
    expect(choiceBalanceProblems(evOf(choiceOf('a', { effects: { stats: { happiness: 3 } } }), choiceOf('b', { effects: { stats: { happiness: 1, health: 1 } } })))).toEqual([]);
  });

  it('보너스로 뒤집힐 수 있으면 통과한다 (위험을 지는 선택: 기본은 손해지만 조건이 맞으면 크게 낫다)', () => {
    const risky = choiceOf('risk', { effects: { assets: { net: -1600 } }, bonuses: [{ when: { parentWealth: { min: 4 } }, effects: { assets: { net: 4000 } } }] });
    const safe = choiceOf('safe', { effects: { assets: { net: 400 } } });
    expect(choiceBalanceProblems(evOf(risky, safe))).toEqual([]);
  });

  it('보너스를 최악으로 쳐도 낫다면 걸린다 (보너스가 손해만 더하는 경우)', () => {
    const better = choiceOf('a', { effects: { assets: { net: 1200 } }, bonuses: [{ when: { parentWealth: { max: 2 } }, effects: { assets: { net: -400 } } }] });
    const worse = choiceOf('b', { effects: { assets: { net: 400 } } });
    expect(choiceBalanceProblems(evOf(better, worse)).join('\n')).toContain('a가 b보다');
  });

  // SPEC-003 M5: 재산 스탯이 없어진 뒤에도 돈이 한 축으로 남는다 — 돈 축 = 순자산 변화 + 3 × 연 소득 변화 + 집안 살림 변화(만 원), 부채는 빼고 본다
  it('돈 축: 순자산(assets.net)·연 소득(assets.income, 3년치)·집안 살림(family)을 한 축으로 센다', () => {
    // 한쪽이 돈에서 확실히 낫고 다른 축은 같으면 걸린다
    expect(choiceBalanceProblems(evOf(choiceOf('a', { effects: { assets: { net: 300 } } }), choiceOf('b', { effects: { assets: { net: -900 } } }))).join('\n')).toContain('a가 b보다');
    // 소득 +200/년은 순자산 +600과 같은 크기다(3년치): 같은 돈 축이면 효과가 같은 선택지다
    expect(choiceBalanceProblems(evOf(choiceOf('a', { effects: { assets: { income: 200 } } }), choiceOf('b', { effects: { assets: { net: 600 } } }))).join('\n')).toContain('효과가 완전히 같다');
    // 20세 미만: 집안 살림도 같은 축
    expect(choiceBalanceProblems(evOf(choiceOf('a', { effects: { family: 300 } }), choiceOf('b', { effects: { family: -450 } }))).join('\n')).toContain('a가 b보다');
    // 돈을 쓰고 다른 것을 얻는 선택은 통과한다 (교환 관계)
    expect(choiceBalanceProblems(evOf(choiceOf('a', { effects: { stats: { happiness: 3 }, assets: { net: -900 } } }), choiceOf('b', { effects: { assets: { net: 300 } } })))).toEqual([]);
    expect(choiceBalanceProblems(evOf(choiceOf('a', { effects: { stats: { education: 6 }, family: -450 } }), choiceOf('b', { effects: { stats: { education: 4 } } })))).toEqual([]);
  });

  it('부채는 돈 축에 세지 않는다: 순자산이 같고 부채만 다른 두 선택은 「효과가 같다」로 걸린다 (집을 사는 빚은 같은 값의 자산을 만든다)', () => {
    const loan = choiceOf('a', { effects: { assets: { net: -800, debt: 9000 } } });
    const rent = choiceOf('b', { effects: { assets: { net: -800 } } });
    expect(choiceBalanceProblems(evOf(loan, rent)).join('\n')).toContain('효과가 완전히 같다');
  });

  it('스탯 효과가 없는 선택지는 비교하지 않는다 (기준 이벤트 변형 시험용 선택지가 걸리지 않는다)', () => {
    expect(choiceBalanceProblems(evOf(choiceOf('a', { effects: undefined }), choiceOf('b', { effects: undefined })))).toEqual([]);
  });

  it('3지선다에서는 모든 쌍을 본다', () => {
    const out = choiceBalanceProblems(
      evOf(
        choiceOf('a', { effects: { stats: { happiness: 5 } } }),
        choiceOf('b', { effects: { stats: { happiness: 3, health: 1 } } }),
        choiceOf('c', { effects: { stats: { happiness: 1 } } }),
      ),
    ).join('\n');
    expect(out).toContain('a가 c보다');
    expect(out).toContain('b가 c보다');
    expect(out).not.toContain('a가 b보다');
  });

  /** 예외 사유 표 (R-352): 예외를 두려면 여기에 이유를 적는다 */
  const DOMINANCE_REASONS: Record<string, string> = {
    'youth-gig-work:learn>settle': '명시 효과로는 learn(지식 +4)이 settle(지식 +1·행복 −1)보다 낫지만 settle의 has_career 파생 소득(자산 ▲▲▲)은 이 점검이 못 본다 — 표기 기준 지배 점검은 통과(R-352 마스터 결정)',
  };

  it('예외 목록은 사유가 적힌 한 쌍뿐이다 — 실제 풀의 모든 선택지 쌍은 이 예외를 빼면 한쪽이 전 스탯에서 우월하지 않고, 같은 효과의 선택지도 없다', () => {
    expect([...DOMINANCE_EXCEPTIONS].sort()).toEqual(Object.keys(DOMINANCE_REASONS).sort());
    expect(EVENT_POOL.events.flatMap(choiceBalanceProblems)).toEqual([]);
  });

  it('예외는 살아 있다: youth-gig-work의 id를 바꿔 예외에서 벗어나게 하면 정확히 learn > settle 한 쌍이 걸린다', () => {
    const ev = EVENT_POOL.byId.get('youth-gig-work')!;
    const problems = choiceBalanceProblems({ ...ev, id: 'youth-gig-work-copy' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('learn가 settle보다');
  });

  it('REV-001-M4-1이 든 옛 값(youth-reunion reply/ignore 동일, senior-last-wishes 정답형)이 그대로면 걸린다', () => {
    const reunion = evOf(
      choiceOf('meet', { effects: { stats: { relationships: 3, happiness: 2 } } }),
      choiceOf('reply', { effects: { stats: { happiness: -1 } } }),
      choiceOf('ignore', { effects: { stats: { happiness: -1 } } }),
    );
    expect(choiceBalanceProblems(reunion).join('\n')).toContain('reply와 ignore의 효과가 완전히 같다');
    const wishes = evOf(
      choiceOf('words', { effects: { stats: { relationships: 5, happiness: 4 } } }),
      choiceOf('things', { effects: { stats: { happiness: 2, relationships: 1 } } }),
      choiceOf('quiet', { effects: { stats: { happiness: 1 } } }),
    );
    expect(choiceBalanceProblems(wishes).join('\n')).toContain('words가 quiet보다');
  });
});

describe('파일 단위 점검 (원문 인용 표지, note)', () => {
  it('note에 "모티브로만 새로 쓴 글"이 없으면 걸린다', () => {
    expect(lintEventFiles({ 'a.json': { note: '아무 메모', events: [] } }).join('\n')).toContain('모티브로만 새로 쓴 글');
    expect(lintEventFiles({ 'a.json': { events: [] } }).join('\n')).toContain('모티브로만 새로 쓴 글');
    expect(lintEventFiles({ 'a.json': { note: '커뮤니티 사연을 모티브로만 새로 쓴 글이다.', events: [] } })).toEqual([]);
  });

  it('이벤트 본문에 "원문"·"출처" 같은 인용 표지가 있으면 걸린다', () => {
    const files = { 'a.json': { note: '모티브로만 새로 쓴 글이다.', events: [{ id: 'x', text: '이 글의 원문은 따로 있습니다.' }] } };
    expect(lintEventFiles(files).join('\n')).toContain('인용');
  });

  it('lintEventData는 파일 점검과 이벤트 점검을 합친다', () => {
    const bad = withText('조용한 오후였다! 창밖으로 바람이 지나갔습니다.');
    const out = lintEventData([bad], { 'a.json': { note: '메모', events: [] } }).join('\n');
    expect(out).toContain('모티브로만 새로 쓴 글');
    expect(out).toContain('느낌표');
  });
});

describe('M7a r3 lint 보강: 옛 철자 · 금액 문장 · 마침표 뒤 띄어쓰기 · 0~7세 1인칭 · 구어체 명사 예외 · 같이 보이는 선택지 수', () => {
  it('옛 철자 「~읍니다」(QA O10)는 걸린다 — 합쇼체는 「~습니다」다. 맞는 철자는 통과', () => {
    expect(joined(withText('조용한 오후였읍니다. 창밖으로 바람이 지나갔습니다.'))).toContain('옛 철자');
    expect(joined(withResult('창문을 열었읍니다. 바람이 방 안으로 들어왔습니다.'))).toContain('옛 철자');
    expect(lintEvent(withText('조용한 오후였습니다. 창밖으로 바람이 지나갔습니다.'))).toEqual([]);
  });

  it('금액 문장(QA O10, IN8): 본문·결과에 숫자 + 원·만 원·억 원이 있으면 걸린다. 숫자 없는 표현은 통과', () => {
    for (const money of ['3만 원', '1억 2,000만 원', '500원', '5천 원', '1,200만원', '3억']) {
      expect(joined(withText(`집값으로 ${money}이 들었습니다. 창밖으로 바람이 지나갔습니다.`)), money).toContain('금액');
      expect(joined(withResult(`${money}을 썼습니다. 바람이 방 안으로 들어왔습니다.`)), money).toContain('금액');
    }
    // 숫자가 없으면 괜찮다 — 금액은 영향 줄(집안 살림 ▲▼)이 말한다
    expect(lintEvent(withText('몇 만 원이 들었습니다. 창밖으로 바람이 지나갔습니다.'))).toEqual([]);
    expect(lintEvent(withText('큰돈이 들었습니다. 창밖으로 바람이 지나갔습니다.'))).toEqual([]);
    // 라벨·제목은 이 점검의 대상이 아니다(본문·결과만)
    expect(joined(withLabel('3만 원을 쓴다'))).not.toContain('금액');
  });

  it('마침표 바로 뒤에 글이 붙으면 걸린다 (R-371 ③ — 문장이 안 갈려 어체 판정이 끝 문장만 봤다): 「울었다.어른이 달랬습니다.」', () => {
    expect(joined(withText('친구는 울었다.어른이 달랬습니다.'))).toContain('마침표 바로 뒤에');
    expect(joined(withResult('창문을 열었다.바람이 방 안으로 들어왔습니다.'))).toContain('마침표 바로 뒤에');
    // 소수점·한 칸 띄운 문장은 정상이다
    expect(lintEvent(withText('몸무게는 3.2kg이었습니다. 키는 평균의 1.5배였습니다.'))).toEqual([]);
    expect(lintEvent(withText('친구는 울었습니다. 어른이 달랬습니다.'))).toEqual([]);
  });

  it('1인칭 「나·내」 금지는 나이 창이 7세 안에서 끝나는 이벤트(7세 school-* 포함)에도 적용된다 (R-371 ②). 8세 이상 학창 이벤트는 대상이 아니다', () => {
    const school7 = (text: string) => base({ stages: ['school'], ageRange: { min: 7, max: 7 }, text });
    expect(joined(school7('나는 책가방을 메고 학교에 갔습니다. 교문 앞에서 뒤를 돌아보았습니다.'))).toContain('1인칭');
    expect(lintEvent(school7('아이는 책가방을 메고 학교에 갔습니다. 교문 앞에서 뒤를 돌아보았습니다.'))).toEqual([]);
    const school9 = base({ stages: ['school'], ageRange: { min: 8, max: 13 }, text: '나는 책가방을 메고 학교에 갔습니다. 교문 앞에서 뒤를 돌아보았습니다.' });
    expect(joined(school9)).not.toContain('1인칭');
    // 실제 풀의 7세 이벤트에는 1인칭이 0건이다
    for (const e of EVENT_POOL.events.filter((x) => x.ageRange?.max !== undefined && x.ageRange.max <= 7)) expect(lintEvent(e).filter((m) => m.includes('1인칭')), e.id).toEqual([]);
  });

  it('구어체 점검의 명사 예외(R-371 ④): 「고요」「요요」「대중가요」는 통과하고, 「그만 가요」(가다)는 계속 걸린다', () => {
    for (const ok of ['방 안이 고요.', '요요를 가지고 놀았습니다.', '라디오에서 대중가요.', '옛 가요.']) {
      expect(stripSafePhrases(ok), ok).not.toMatch(/요(?=[.\s]|$)/);
    }
    expect(joined(withText('조용한 오후의 고요. 창밖으로 바람이 지나갔습니다.'))).not.toContain('구어체');
    expect(joined(withText('라디오에서 대중가요. 창밖으로 바람이 지나갔습니다.'))).not.toContain('구어체');
    expect(joined(withText('친구가 그만 가요. 창밖으로 바람이 지나갔습니다.'))).toContain('구어체'); // 예외로 새지 않는다
    expect(joined(withText('그만 가요 하고 말했습니다. 창밖으로 바람이 지나갔습니다.'))).toContain('구어체');
  });

  it('명사 예외 「고요·대요·긴요」는 낱말 맨 앞일 때만 지운다 (R-375): 해요체 어미 「웃었고요」「간대요」「좋긴요」는 문장 안에서도·제목에서도 걸린다', () => {
    // 낱말 끝이 같은 해요체 어미 — 본문 문장 한가운데에 있어도 걸린다 (끝 문장이 합쇼체라 어체 판정은 통과한다)
    for (const bad of ['아이가 웃었고요 어른도 웃었습니다.', '친구가 이사 간대요 하고 말했습니다.', '어른이 좋긴요 하고 웃었습니다.']) {
      expect(joined(withText(`${bad} 창밖으로 바람이 지나갔습니다.`)), bad).toContain('구어체');
      expect(joined(withResult(`${bad} 창밖으로 바람이 지나갔습니다.`)), bad).toContain('구어체');
      expect(stripSafePhrases(bad), bad).toMatch(/요(?=[\s.]|$)/); // 예외로 지워지지 않는다
    }
    // 제목·라벨도 같다 (제목에는 어체 판정이 없어 구어체 점검이 유일한 방어선이다)
    expect(joined(base({ title: '이사를 갔대요' }))).toContain('구어체');
    expect(joined(withLabel('이웃이 좋긴요 하고 웃는다'))).toContain('구어체');
    // 낱말 맨 앞의 명사는 계속 통과한다 — 문장 끝·쉼표 앞·따로 놓인 낱말
    for (const ok of ['방 안이 고요.', '밤의 고요, 그리고 아침.', '고요 속에 하루가 저물었습니다.', '그 일은 긴요.']) {
      expect(stripSafePhrases(ok), ok).not.toMatch(/요(?=[.,\s]|$)/);
    }
    expect(joined(withText('방 안이 고요. 창밖으로 바람이 지나갔습니다.'))).not.toContain('구어체');
    expect(joined(withText('고요 속에 하루가 저물었습니다. 창밖으로 바람이 지나갔습니다.'))).not.toContain('구어체');
    expect(joined(base({ title: '고요한 오후' }))).not.toContain('구어체');
  });

  describe('같이 보일 수 있는 선택지 수 (정의 최대 4개, 어떤 상태에서도 보이는 것은 3개 이하)', () => {
    const four = (extra: Record<string, unknown>[]): EventDef =>
      base({
        choices: [
          { id: 'a', label: '가를 고른다', result: '가를 골랐습니다. 하루가 지났습니다.', effects: { stats: { happiness: 2, relationships: -1 }, setFlags: ['x_flag', 'f1', 'f2'] } },
          { id: 'b', label: '나를 고른다', result: '나를 골랐습니다. 하루가 지났습니다.', effects: { stats: { health: 2, education: -1 } } },
          ...extra,
        ],
      });
    const c = { id: 'c', label: '다를 고른다', result: '다를 골랐습니다. 하루가 지났습니다.', effects: { stats: { education: 2, happiness: -1 } } };
    const d = { id: 'd', label: '라를 고른다', result: '라를 골랐습니다. 하루가 지났습니다.', effects: { stats: { relationships: 2, health: -1 } } };

    it('플래그 유무로 서로 배타인 두 선택지가 있으면 정의 4개도 통과한다 (infant-new-sibling: grandma ⇄ notice)', () => {
      const ev = four([{ ...c, requires: { flags: ['x_flag'] } }, { ...d, requires: { notFlags: ['x_flag'] } }]);
      expect(maxVisibleChoices(ev)).toBe(3);
      expect(visibleChoiceProblems(ev)).toEqual([]);
    });

    it('4개가 한 상태에서 함께 보일 수 있으면 걸린다: 조건 없음 · 서로 다른 플래그 · 겹치는 재력 범위', () => {
      expect(maxVisibleChoices(four([c, d]))).toBe(4);
      expect(visibleChoiceProblems(four([c, d])).join('\n')).toContain('4개까지 동시에 보일 수');
      expect(visibleChoiceProblems(four([{ ...c, requires: { flags: ['f1'] } }, { ...d, requires: { flags: ['f2'] } }])).join('\n')).toContain('동시에 보일');
      expect(visibleChoiceProblems(four([{ ...c, requires: { parentWealth: { min: 3 } } }, { ...d, requires: { parentWealth: { min: 4 } } }])).join('\n')).toContain('동시에 보일'); // 재력 4 이상이면 둘 다 보인다
    });

    it('재력 범위가 겹치지 않거나 허용 목록(housing·parenting)이 겹치지 않으면 함께 보일 수 없다 — 통과', () => {
      expect(visibleChoiceProblems(four([{ ...c, requires: { parentWealth: { max: 2 } } }, { ...d, requires: { parentWealth: { min: 3 } } }]))).toEqual([]);
      expect(visibleChoiceProblems(four([{ ...c, requires: { housing: ['own'] } }, { ...d, requires: { housing: ['rent', 'free'] } }]))).toEqual([]);
      expect(visibleChoiceProblems(four([{ ...c, requires: { parenting: ['free'] } }, { ...d, requires: { parenting: ['strict'] } }]))).toEqual([]);
      expect(visibleChoiceProblems(four([{ ...c, requires: { parenting: ['free'] } }, { ...d, requires: { parenting: ['free', 'strict'] } }])).join('\n')).toContain('동시에 보일');
    });

    it('conditionsCompatible: 같은 플래그가 flags와 notFlags에 함께 있으면 거짓, 조건이 없으면 참', () => {
      expect(conditionsCompatible([{ flags: ['f'] }, { notFlags: ['f'] }])).toBe(false);
      expect(conditionsCompatible([{ flags: ['f'] }, { flags: ['g'] }])).toBe(true);
      expect(conditionsCompatible([undefined, undefined])).toBe(true);
      expect(conditionsCompatible([{ assets: { netMin: 5000 } }, { assets: { netMax: 1000 } }])).toBe(false);
    });

    it('실제 풀: 모든 선택지 이벤트에서 동시에 보이는 선택지가 3개 이하이고, 정의가 4개인 것은 infant-new-sibling·youth-housing뿐이다 (플래그 있음·없음 모두 3개)', () => {
      for (const e of EVENT_POOL.events.filter((x) => x.choices !== undefined)) expect(maxVisibleChoices(e), e.id).toBeLessThanOrEqual(3);
      // 정의가 4개인 이벤트는 둘뿐이다 (M7e-4: youth-housing이 가족 집 판의 「머문다」와 독립 판의 「돌아간다」를 가르며 4개가 되었다 — 둘은 assets.dwelling 목록이 서로 배타)
      expect(EVENT_POOL.events.filter((x) => x.choices?.length === 4).map((x) => x.id).sort()).toEqual(['infant-new-sibling', 'youth-housing']);
      const sib = EVENT_POOL.byId.get('infant-new-sibling')!;
      expect(sib.choices).toHaveLength(4);
      expect(maxVisibleChoices(sib)).toBe(3);
      const withFlag = sib.choices!.filter((x) => x.requires === undefined || (x.requires.flags ?? []).includes('grandparent_close')).map((x) => x.id);
      const withoutFlag = sib.choices!.filter((x) => x.requires === undefined || (x.requires.notFlags ?? []).includes('grandparent_close')).map((x) => x.id);
      expect(withFlag).toEqual(['help', 'sulk', 'grandma']);
      expect(withoutFlag).toEqual(['help', 'sulk', 'notice']);
    });
  });
});

describe('visibleChoiceSets · worstCaseVisibleChoiceIds (레이아웃 시험이 정의 4개 이벤트의 최악의 카드를 재는 데 쓴다, M7a r3)', () => {
  it('infant-new-sibling: 함께 보일 수 있는 가장 큰 묶음이 둘(help·sulk·grandma / help·sulk·notice)이고, 최악의 묶음은 그 가운데 라벨이 더 긴 쪽이다', () => {
    const sib = EVENT_POOL.byId.get('infant-new-sibling')!;
    expect(visibleChoiceSets(sib)).toEqual([
      ['help', 'sulk', 'grandma'],
      ['help', 'sulk', 'notice'],
    ]);
    const worst = worstCaseVisibleChoiceIds(sib);
    expect(['grandma', 'notice']).toContain(worst[2]);
    expect(worst).toHaveLength(3);
  });

  it('정의가 3개 이하인 이벤트는 정의 전부가 하나의 묶음이다 (requires가 있어도 — 최악의 경우는 전부 보이는 것)', () => {
    for (const e of EVENT_POOL.events.filter((x) => x.choices !== undefined && x.choices.length <= 3)) {
      expect(visibleChoiceSets(e), e.id).toEqual([e.choices!.map((c) => c.id)]);
      expect(worstCaseVisibleChoiceIds(e), e.id).toEqual(e.choices!.map((c) => c.id));
    }
  });
});
