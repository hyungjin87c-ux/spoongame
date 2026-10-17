import { describe, expect, it } from 'vitest';
import {
  DOMINANCE_EXCEPTIONS,
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
  lintEvent,
  lintEventData,
  lintEventFiles,
  lintEvents,
  stateWordProblems,
  stripSafePhrases,
  textPartsOf,
  validateEventFiles,
  type EventDef,
} from '../src/core';
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
          text: '조용한 오후였다. 창밖으로 바람이 지나갔다.',
          stages: ['youth'],
          weight: 10,
          once: true,
          choices: [
            { id: 'a', label: '창문을 연다', result: '창문을 열었다. 바람이 방 안으로 들어왔다.', effects: { stats: { happiness: 1 } } },
            { id: 'b', label: '그대로 둔다', result: '그대로 두었다. 오후는 천천히 저물었다.', effects: { stats: { health: 1 } } },
          ],
          ...over,
        },
      ],
    },
  })[0];

const withText = (text: string) => base({ text });
const withLabel = (label: string) => base({ choices: [{ id: 'a', label, result: '창문을 열었다. 바람이 방 안으로 들어왔다.' }, { id: 'b', label: '그대로 둔다', result: '그대로 두었다. 오후는 천천히 저물었다.' }] });
const withResult = (result: string) => base({ choices: [{ id: 'a', label: '창문을 연다', result }, { id: 'b', label: '그대로 둔다', result: '그대로 두었다. 오후는 천천히 저물었다.' }] });
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
    ['본문의 느낌표', withText('조용한 오후였다! 창밖으로 바람이 지나갔다.'), '느낌표'],
    ['전각 느낌표', withText('조용한 오후였다！ 창밖으로 바람이 지나갔다.'), '느낌표'],
    ['결과의 느낌표', withResult('창문을 열었다! 바람이 방 안으로 들어왔다.'), '느낌표'],
    ['라벨의 느낌표', withLabel('창문을 연다!'), '느낌표'],
    ['제목의 느낌표', base({ title: '기준 이벤트!' }), '느낌표'],
    ['물음표', withText('이대로 괜찮을까 싶었다? 창밖으로 바람이 지나갔다.'), '물음표'],
    ['말줄임표(…)', withText('조용한 오후였다… 창밖으로 바람이 지나갔다.'), '말줄임표'],
    ['말줄임표(...)', withText('조용한 오후였다... 창밖으로 바람이 지나갔다.'), '말줄임표'],
    ['이모지', withText('조용한 오후였다 \u{1F60A} 창밖으로 바람이 지나갔다.'), '이모지'],
    ['그림 기호', withText('조용한 오후였다 ★ 창밖으로 바람이 지나갔다.'), '이모지'],
    ['URL(https)', withText('조용한 오후였다. https://example.org 창밖으로 바람이 지나갔다.'), 'URL'],
    ['URL(www)', withText('조용한 오후였다. www.example 창밖으로 바람이 지나갔다.'), 'URL'],
    ['달력 연도(2031년)', withText('2031년 조용한 오후였다. 창밖으로 바람이 지나갔다.'), '달력 연도'],
    ['달력 연도(1990년대)', withText('1990년대의 조용한 오후였다. 창밖으로 바람이 지나갔다.'), '달력 연도'],
    ['달력 연도(80년대)', withText('80년대의 조용한 오후였다. 창밖으로 바람이 지나갔다.'), '달력 연도'],
    ['실제 상호', withText('삼성 건물 앞을 지났다. 창밖으로 바람이 지나갔다.'), '실제 상호'],
    ['실제 사건', withText('월드컵이 열리던 오후였다. 창밖으로 바람이 지나갔다.'), '실제 상호'],
    ['실존 직함(대통령)', withText('대통령이 지나간 오후였다. 창밖으로 바람이 지나갔다.'), '실제 상호'],
    ['인터넷 말투(ㅋㅋ)', withText('조용한 오후였다 ㅋㅋ 창밖으로 바람이 지나갔다.'), '인터넷 말투'],
    ['과장(대박)', withText('대박 조용한 오후였다. 창밖으로 바람이 지나갔다.'), '인터넷 말투'],
    ['과장(엄청)', withText('엄청 조용한 오후였다. 창밖으로 바람이 지나갔다.'), '인터넷 말투'],
    ['원문 인용 표지', withText('출처를 밝히면 조용한 오후였다. 창밖으로 바람이 지나갔다.'), '인용'],
    ['본문이 "~다."로 끝나지 않음', withText('조용한 오후였다. 창밖으로 바람이 지나갔어요.'), '서술체'],
    ['구어체 종결(~요.)', withText('조용한 오후였어요. 창밖으로 바람이 지나갔다.'), '구어체'],
    ['결과가 "~다."로 끝나지 않음', withResult('창문을 열었다. 바람이 방 안으로 들어왔다'), '서술체'],
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
    const out = lintEvent(withResult('창문을 열었다! 바람이 방 안으로 들어왔다.'));
    expect(out.some((m) => m.includes('lint-base.choices[0](a).result') && m.includes('느낌표') && m.includes('창문을 열었다!'))).toBe(true);
  });
});

describe('길이 권장 최대 (R-042): 넘으면 걸리고, 끝값은 통과한다', () => {
  const fill = (n: number) => `${'가나다라마바사아자차 '.repeat(20)}`.slice(0, n - 2).trim().padEnd(n - 2, '가') + '다.';

  it('상한 값이 기대와 같다 (docs/data/events-schema.md 7절과 e2e/layout.spec.ts의 끝값 이벤트가 이 숫자를 쓴다)', () => {
    expect(TEXT_LIMITS).toEqual({ title: 16, text: 70, label: 24, result: 80, sentence: 50 });
  });

  it('본문: 문장이 50자 이하이면 70자까지 통과, 71자부터 걸린다', () => {
    // 한 문장이 50자를 넘는 긴 문장은 문장 규칙에 걸린다(나눠 쓰라는 뜻)
    expect(joined(withText(fill(70)))).toContain('한 문장이');
    const twoSentences = `${fill(35)} ${fill(34)}`;
    expect(twoSentences.length).toBe(70);
    expect(lintEvent(withText(twoSentences))).toEqual([]);
    expect(joined(withText(`${fill(36)} ${fill(34)}`))).toContain('권장 최대 70자');
  });

  it('제목 17자는 걸리고 16자는 통과한다', () => {
    expect(joined(base({ title: '가'.repeat(17) }))).toContain('권장 최대 16자');
    expect(lintEvent(base({ title: '가'.repeat(16) }))).toEqual([]);
  });

  it('라벨 25자는 걸리고 24자는 통과한다', () => {
    expect(joined(withLabel(`${'가'.repeat(24)}다`))).toContain('권장 최대 24자');
    expect(lintEvent(withLabel(`${'가'.repeat(23)}다`))).toEqual([]);
  });

  it('결과 81자는 걸리고 80자는 통과한다 (문장당 50자 이하로 나눠 쓴다)', () => {
    expect(joined(withResult(`${fill(40)} ${fill(41)}`))).toContain('권장 최대 80자');
    expect(lintEvent(withResult(`${fill(40)} ${fill(39)}`))).toEqual([]);
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
    expect(joined(withResult('방과 후마다 학원 버스에 올랐다. 숙제가 늘었고 성적도 천천히 올랐다.'))).toContain('학원');
    expect(joined(withResult('텃밭과 라디오와 낮잠으로 하루가 지나갔다. 조용했고 가끔은 적막했다.'))).toContain('라디오');
    expect(joined(base({ eras: ['future'], text: '텃밭에서 흙을 만지던 오후였다. 창밖으로 바람이 지나갔다.' }))).toContain('텃밭');
  });

  it('새 소재는 지금·다가올 세상 전용이면 쓸 수 있지만 지난 세상에는 쓸 수 없다', () => {
    const text = '메신저로 온 짧은 안부를 오래 들여다보았다. 창밖으로 바람이 지나갔다.';
    expect(lintEvent(base({ eras: ['present', 'future'], text }))).toEqual([]);
    expect(joined(base({ eras: ['past'], text }))).toContain('메신저');
    expect(joined(base({ eras: ['past', 'present'], text }))).toContain('메신저');
    expect(joined(base({ text }))).toContain('메신저');
  });

  it('옛 소재는 지난 세상 전용이면 쓸 수 있지만 지금·다가올 세상에는 쓸 수 없다', () => {
    const text = '연탄불이 꺼지지 않게 밤새 살피던 오후였다. 창밖으로 바람이 지나갔다.';
    expect(lintEvent(base({ eras: ['past'], text }))).toEqual([]);
    expect(joined(base({ eras: ['present'], text }))).toContain('연탄');
    expect(joined(base({ eras: ['future'], text }))).toContain('연탄');
  });

  it('미래 소재는 다가올 세상 전용에서만 쓸 수 있다', () => {
    const text = '로봇이 청소를 맡게 된 오후였다. 창밖으로 바람이 지나갔다.';
    expect(lintEvent(base({ eras: ['future'], text }))).toEqual([]);
    expect(joined(base({ eras: ['present', 'future'], text }))).toContain('로봇');
    expect(joined(base({ text }))).toContain('로봇');
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
    const c = { ...base({ title: '다른 제목', text: '전혀 다른 오후의 이야기를 적은 본문이었다.' }), id: 'lint-third' };
    const cc = { ...c, choices: c.choices!.map((ch, i) => ({ ...ch, result: `다른 결과 문장 ${i}번이었다.` })) } as EventDef;
    expect(lintEvents([a, cc])).toEqual([]);
  });
});

/** 검증(플래그가 어딘가에서 켜지는지)을 거치지 않고 만든 이벤트 — 조건·단계·id를 마음대로 줄 수 있다 */
const raw = (over: Record<string, unknown>): EventDef => ({ ...base(), ...over }) as EventDef;
const choiceOf = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  label: '창문을 연다',
  result: '창문을 열었다. 바람이 방 안으로 들어왔다.',
  effects: { stats: { happiness: 1 } },
  ...over,
});

describe('오탐 예외 (R-067): 정상 문구는 통과하고, 진짜 위반은 여전히 걸린다', () => {
  const tail = ' 창밖으로 바람이 지나갔다.';
  const normal: Array<[string, string]> = [
    ['헐값("헐")', '헐값에 넘긴 물건이 오래 마음에 걸렸다.'],
    ['헐렁한 옷("헐")', '헐렁한 옷을 입고 길을 나섰다.'],
    ['영향을 미친 일("미친")', '그 일이 마음에 영향을 미친 오후였다.'],
    ['미친 영향("미친")', '오래 미친 영향을 가늠해 보는 오후였다.'],
    ['펌프("펌")', '마당의 펌프에서 물소리가 났다.'],
    ['우물쭈물("우물")', '우물쭈물하다 말할 때를 놓쳤다.'],
    ['폭풍우("폭풍")', '폭풍우가 지나간 오후였다.'],
    ['현대적("현대")', '현대적인 건물이 들어선 오후였다.'],
    ['연결 어미 ~니까("니까")', '비가 오니까 우산을 챙겨 나갔다.'],
    ['받아들이다("아들")', '그 말을 천천히 받아들였다.'],
    ['잦아들다("아들")', '소란이 서서히 잦아들었다.'],
    ['딸기("딸")', '딸기 향이 퍼진 오후였다.'],
  ];
  for (const [name, head] of normal) {
    it(`정상 문구 통과: ${name}`, () => {
      expect(lintEvent(withText(head + tail))).toEqual([]);
    });
  }

  const bad: Array<[string, string, string]> = [
    ['감탄으로 쓴 "헐"', '헐 하고 소리가 절로 났다.', '인터넷 말투'],
    ['"미친 듯이"', '미친 듯이 달려간 오후였다.', '인터넷 말투'],
    ['인용 표지 "펌"', '펌 글에서 본 이야기였다.', '인용'],
    ['문장 끝 ~니까', '비가 왔으니까.', '구어체'],
    ['~죠', '조용했죠 그날은.', '구어체'],
    ['건설사 "현대"', '현대 건설 앞을 지났다.', '실제 상호'],
    ['"폭풍 눈물"', '폭풍 눈물이 쏟아진 오후였다.', '인터넷 말투'],
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
  const text = '휴대전화로 온 짧은 안부를 오래 들여다보았다. 창밖으로 바람이 지나갔다.';

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
    expect(joined(base({ stages: ['senior'], eras: ['past'], text: '학원 앞을 지나던 오후였다. 창밖으로 바람이 지나갔다.' }))).toContain('학원');
    expect(joined(base({ stages: ['senior'], text: '로봇이 청소를 맡게 된 오후였다. 창밖으로 바람이 지나갔다.' }))).toContain('로봇');
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
  const tail = ' 어른들의 손길이 곁에 있었다.';
  it('영유아 이벤트에 1인칭("나·내")이 있으면 걸린다', () => {
    for (const head of ['그 품은 여전히 내 자리였다.', '나는 조부모님 곁에서 지냈다.', '조부모님은 나를 안아 주었다.', '저는 그 노래를 기억한다.']) {
      expect(joined(raw({ stages: ['infant'], text: head + tail })), head).toContain('1인칭');
    }
  });
  it('"아이"로 쓰면 통과하고, "내리다·안내" 같은 낱말 속의 "내"는 걸리지 않는다', () => {
    expect(lintEvent(raw({ stages: ['infant'], text: `그 품은 여전히 아이의 자리였다.${tail}` }))).toEqual([]);
    expect(lintEvent(raw({ stages: ['infant'], text: `비가 내리는 날 안내를 받았다.${tail}` }))).toEqual([]);
  });
  it('학창 이후에는 1인칭이 자연스럽다 (회고하는 "나")', () => {
    expect(lintEvent(raw({ stages: ['school'], text: `나는 내 친구들과 어울렸다.${tail}` }))).toEqual([]);
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
    const files = { 'a.json': { note: '모티브로만 새로 쓴 글이다.', events: [{ id: 'x', text: '이 글의 원문은 따로 있다.' }] } };
    expect(lintEventFiles(files).join('\n')).toContain('인용');
  });

  it('lintEventData는 파일 점검과 이벤트 점검을 합친다', () => {
    const bad = withText('조용한 오후였다! 창밖으로 바람이 지나갔다.');
    const out = lintEventData([bad], { 'a.json': { note: '메모', events: [] } }).join('\n');
    expect(out).toContain('모티브로만 새로 쓴 글');
    expect(out).toContain('느낌표');
  });
});
