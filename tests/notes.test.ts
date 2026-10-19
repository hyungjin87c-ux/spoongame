import { afterEach, describe, expect, it } from 'vitest';
import { HISTORY_LIMITS } from '../src/data/lifeTable';
import { NOTE_LIMITS, cleanNoteForLoad, countGraphemes, createRng, dispositionOf, finalizeNote, isInvisibleOnly, liveGraphemes, sanitizeLive, splitGraphemes } from '../src/core';

/**
 * 기록 글 입력 규칙 (SPEC-003 M7c FR3·FR4 — docs/data/content-M7c.md 3절). 입력은 모두 코드 포인트로 만든다(소스에 보이지 않는 글자·그림 문자를 직접 적지 않는다).
 * 표의 번호(A1~A20)는 3-8절 「공격 입력 → 기대 결과표」다. A10(RTL 화면 순서)·A16(가로 넘침)·A19·A20은 화면이 있어야 하는 항목이라 e2e/UI 단계가 맡고, 여기서는 글 자체의 처분을 본다.
 */

const cp = (...codes: number[]): string => String.fromCodePoint(...codes);
const FAMILY = cp(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
const FLAG_KR = cp(0x1f1f0, 0x1f1f7);
const THUMBS_TONE = cp(0x1f44d, 0x1f3fd);
const KEYCAP_1 = cp(0x31, 0xfe0f, 0x20e3);
const FLAG_ENGLAND = cp(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
const GRIN = cp(0x1f600);
const ZWJ = cp(0x200d);
const ZWSP = cp(0x200b);

const hasSegmenter = typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function';

/** Intl.Segmenter가 없는 환경을 흉내 낸다 — 끝나면 되돌린다 */
const intl = Intl as unknown as { Segmenter?: unknown };
const originalSegmenter = intl.Segmenter;
afterEach(() => {
  intl.Segmenter = originalSegmenter;
});
function withoutSegmenter<T>(fn: () => T): T {
  intl.Segmenter = undefined;
  try {
    return fn();
  } finally {
    intl.Segmenter = originalSegmenter;
  }
}

const text = (raw: string): string => finalizeNote(raw).text;

describe('한도 상수 (3-1절)', () => {
  it('그래핌 140 · 단위 400(= 연표 글 상한) · 3줄 · 읽는 양 20,000 · 그래핌당 코드 포인트 8/12 · 깃발 태그 글자 2~6 · 자동 카드 7 · 전체 40 · 간격 2', () => {
    expect(NOTE_LIMITS).toEqual({ graphemes: 140, units: 400, lines: 3, readUnits: 20_000, clusterCodePoints: 8, emojiCodePoints: 12, tagLettersMin: 2, tagLettersMax: 6, autoCards: 7, total: 40, gapYears: 2 });
    expect(NOTE_LIMITS.units, '연표 기록(clipEntry)이 글을 자르지 않는 길이').toBe(HISTORY_LIMITS.maxTextLength);
  });

  it('이 시험 환경에는 Intl.Segmenter가 있다(없는 환경은 아래 별도 블록이 흉내 낸다)', () => {
    expect(hasSegmenter).toBe(true);
  });
});

describe('A1·A2·A15: 특수문자·마크다운·엔티티는 글자 그대로 (해석하지 않는다)', () => {
  it('A1: <script>alert(1)</script>는 25글자 그대로', () => {
    const r = finalizeNote('<script>alert(1)</script>');
    expect(r.text).toBe('<script>alert(1)</script>');
    expect(r.graphemes).toBe(25);
    expect(r.truncated).toBe(false);
  });

  it('A2: SQL · 따옴표 · 백슬래시 · &amp; &lt;b&gt;가 그대로이고 JSON 저장·복원이 같다', () => {
    for (const raw of ["'; DROP TABLE users;--", `"큰따옴표" '작은따옴표' \`백틱\``, 'a\\b\\new\\table', '&amp; &lt;b&gt; &#x41; &nbsp;']) {
      const r = finalizeNote(raw);
      expect(r.text).toBe(raw);
      expect(JSON.parse(JSON.stringify({ t: r.text })).t).toBe(raw);
    }
  });

  it('A15: 마크다운 **굵게** [링크](http://x) # 제목이 그대로 (서식·링크로 바뀌지 않는다)', () => {
    for (const raw of ['**굵게**', '[링크](http://x)', '# 제목', '> 인용\n- 목록', '![img](x.png)']) expect(text(raw)).toBe(raw);
  });
});

describe('A3·A4: 이모지는 깨지지 않고, 이모지가 아닌 곳의 ZWJ·변이 선택자는 지워진다 (3-4절)', () => {
  it('A3: 가족 그림 문자 · 깃발 · 피부색 · 키캡 · 하위 지역 깃발이 각각 1글자로 그대로 남는다', () => {
    for (const [name, seq] of [['가족', FAMILY], ['깃발', FLAG_KR], ['피부색', THUMBS_TONE], ['키캡', KEYCAP_1], ['잉글랜드 깃발', FLAG_ENGLAND]] as const) {
      const r = finalizeNote(seq);
      expect(r.text, name).toBe(seq);
      expect(r.graphemes, `${name} 글자 수`).toBe(1);
      const mixed = finalizeNote(`가${seq}나`);
      expect(mixed.text, `${name} 사이에 낀 경우`).toBe(`가${seq}나`);
      expect(mixed.graphemes).toBe(3);
    }
  });

  it('A3: 그림 문자 + 변이 선택자(U+FE0F)와 ZWJ로 이은 열(하트+불·무지개 깃발)도 그대로', () => {
    for (const seq of [cp(0x2764, 0xfe0f), cp(0x2764, 0xfe0f, 0x200d, 0x1f525), cp(0x1f3f3, 0xfe0f, 0x200d, 0x1f308), cp(0x1f9d1, 0x1f3fd, 0x200d, 0x1f9b0)]) {
      expect(text(seq)).toBe(seq);
      expect(countGraphemes(text(seq))).toBe(1);
    }
  });

  it('A4: 끝에 ZWJ가 매달린 그림 문자는 그림 문자만, 글자 사이 ZWJ는 지워 ab, ZWSP만 있으면 빈 입력', () => {
    expect(text(cp(0x1f468, 0x200d))).toBe(cp(0x1f468));
    expect(text(`a${ZWJ}b`)).toBe('ab');
    expect(text(`${ZWJ}a`)).toBe('a');
    expect(text(`a${ZWSP}b`)).toBe('ab');
    expect(finalizeNote(ZWSP).empty).toBe(true);
    expect(finalizeNote(`${ZWSP}${ZWSP}${ZWJ}`).empty).toBe(true);
  });

  it('이모지 밖의 변이 선택자(U+FE0F·FE0E)와 숫자 뒤 FE0F는 지운다. 키캡 안은 남긴다', () => {
    expect(text(`가${cp(0xfe0f)}`)).toBe('가');
    expect(text(`1${cp(0xfe0f)}`)).toBe('1');
    expect(text(`${KEYCAP_1}`)).toBe(KEYCAP_1);
    expect(text(cp(0xfe00, 0xfe0d) + 'a' + cp(0xe0100))).toBe('a');
  });

  it('태그 문자는 하위 지역 깃발 안에서만 남는다 — 글자 뒤에 숨긴 태그 문자는 지운다(숨은 글자 심기 차단)', () => {
    expect(text(`가${cp(0xe0067, 0xe0062, 0xe007f)}나`)).toBe('가나');
    expect(text(cp(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067) + 'x')).toBe(cp(0x1f3f4) + 'x'); // 취소 태그가 없는 열은 깃발이 아니다
    expect(text(FLAG_ENGLAND)).toBe(FLAG_ENGLAND);
    // 긴 태그 열(숨긴 메시지)은 깃발이 아니다
    const hidden = cp(0x1f3f4) + Array.from({ length: 40 }, (_, i) => cp(0xe0020 + (i % 90))).join('') + cp(0xe007f);
    expect(text(hidden)).toBe(cp(0x1f3f4));
  });

  it('지역 표시 글자가 홀수 개(깃발이 반쪽)이면 홀로 남은 글자는 보이는 글자로 둔다', () => {
    const three = cp(0x1f1f0, 0x1f1f7, 0x1f1fa);
    expect(text(three)).toBe(three);
    expect(countGraphemes(text(three))).toBe(2);
  });

  it('이모지 시퀀스가 코드 포인트 12개를 넘으면 12개 안에 드는 앞쪽 요소까지만 남는다 (여전히 유효한 시퀀스)', () => {
    const element = cp(0x1f468, 0x1f3fd); // 2개
    const long = Array.from({ length: 10 }, () => element).join(ZWJ); // 10 × 2 + 9 = 29개
    const out = text(long);
    expect([...out].length).toBeLessThanOrEqual(NOTE_LIMITS.emojiCodePoints);
    expect(out.startsWith(element)).toBe(true);
    expect(countGraphemes(out)).toBe(1);
  });
});

describe('A5~A9·A17·A18: 길이·줄·공백·빈 입력', () => {
  it('A5: 1만 자 붙여넣기는 140글자로 자르고 잘렸다고 알린다', () => {
    const r = finalizeNote('가'.repeat(10_000));
    expect(r.graphemes).toBe(140);
    expect(r.text).toBe('가'.repeat(140));
    expect(r.truncated).toBe(true);
  });

  it('A6: 1MB 붙여넣기는 결과가 140글자·400단위 이하이고, 입력의 앞 20,000단위만 읽는다 (읽은 뒤의 글자는 결과에 영향이 없다)', () => {
    const big = 'a'.repeat(NOTE_LIMITS.readUnits) + 'Z'.repeat(1_048_576 - NOTE_LIMITS.readUnits);
    const t0 = performance.now();
    const r = finalizeNote(big);
    const ms = performance.now() - t0;
    expect(r.text).toBe('a'.repeat(140));
    expect(r.truncated).toBe(true);
    expect(r.text.includes('Z')).toBe(false);
    expect(ms, `1MB 처리 ${ms.toFixed(1)}ms (보고용 상한)`).toBeLessThan(2000);
    // 읽는 양 안에서 서러게이트 쌍이 끊기는 경우: 끝의 홀로 남은 앞쪽을 버린다
    const pair = 'a'.repeat(NOTE_LIMITS.readUnits - 1) + GRIN;
    expect(finalizeNote(pair).text).toBe('a'.repeat(140));
  });

  it('A7: 공백·탭·줄바꿈만 · 빈 입력 · U+3164(한글 채움)만 · 제어 문자만이면 빈 입력이다. 쉼표·마침표만 있는 글은 빈 입력이 아니다', () => {
    for (const raw of ['', '   ', '\t\t', '\n\n\n', ' \t\n \r\n ', cp(0x3164), cp(0x3164, 0x115f, 0x1160, 0xffa0), cp(0x2800), '\u0000\u0001\u0007', cp(0xa0, 0x3000, 0x2003), ZWSP + cp(0x2060)]) {
      const r = finalizeNote(raw);
      expect(r.empty, JSON.stringify(raw)).toBe(true);
      expect(r.text).toBe('');
      expect(r.graphemes).toBe(0);
    }
    for (const raw of [',', '.', '. . .', ',,,']) expect(finalizeNote(raw).empty, raw).toBe(false);
  });

  it('A8: a + 줄바꿈 5개 + b는 두 줄 a\\nb', () => {
    expect(text('a\n\n\n\n\nb')).toBe('a\nb');
    expect(text('a\r\n\r\n\r\nb')).toBe('a\nb');
    expect(text('\n\na\n\n')).toBe('a');
  });

  it('A9: 5줄 입력 1 2 3 4 5는 3줄이 되고 4번째 줄부터 앞 줄에 공백으로 이어 붙인다', () => {
    const r = finalizeNote('1\n2\n3\n4\n5');
    expect(r.text).toBe('1\n2\n3 4 5');
    expect(r.linesMerged).toBe(true);
    expect(finalizeNote('1\n2\n3').linesMerged).toBe(false);
  });

  it('줄바꿈 변종(\\r · U+0085 · U+2028 · U+2029 · \\v · \\f)을 모두 줄바꿈 하나로 통일한다', () => {
    for (const sep of ['\r', '\r\n', cp(0x85), cp(0x2028), cp(0x2029), '\v', '\f']) expect(text(`a${sep}b`), JSON.stringify(sep)).toBe('a\nb');
  });

  it('앞뒤 공백 제거와 연속 공백 접기: 줄마다 적용, 탭·가로 공백류는 공백 하나', () => {
    expect(text('  가   나\t\t다  ')).toBe('가 나 다');
    expect(text('가 \n  나  \n 다')).toBe('가\n나\n다');
    expect(text(`가${cp(0xa0)}${cp(0x3000)}${cp(0x2003)}나`)).toBe('가 나');
  });

  it('A17: 경계 139 · 140 · 141글자 — 139·140은 그대로, 141은 140으로 자르고 잘렸다고 알린다', () => {
    for (const [n, want, truncated] of [[139, 139, false], [140, 140, false], [141, 140, true]] as const) {
      const r = finalizeNote('나'.repeat(n));
      expect(r.graphemes, `${n}`).toBe(want);
      expect(r.truncated, `${n}`).toBe(truncated);
    }
  });

  it('A18: 단순 그림 문자(2단위) 140개는 280단위로 그대로, 가족 그림 문자(8단위) 140개는 단위 400에서 50개째에 그래핌 경계로 자르고 시퀀스가 끊기지 않는다', () => {
    const simple = finalizeNote(GRIN.repeat(140));
    expect(simple.graphemes).toBe(140);
    expect(simple.text.length).toBe(280);
    expect(simple.truncated).toBe(false);
    const family = finalizeNote(FAMILY.repeat(140));
    expect(family.graphemes).toBe(50);
    expect(family.text.length).toBe(400);
    expect(family.text).toBe(FAMILY.repeat(50));
    expect(family.truncated).toBe(true);
    // 자른 끝이 반쪽 시퀀스가 아니다: 마지막 그래핌은 온전한 가족 그림 문자
    expect(splitGraphemes(family.text).at(-1)).toBe(FAMILY);
  });

  it('자른 끝의 공백·줄바꿈은 걷는다 (자른 글이 다시 정규화돼도 같도록)', () => {
    const raw = `${'가'.repeat(139)} 나나나`;
    const r = finalizeNote(raw);
    expect(r.text).toBe('가'.repeat(139));
    expect(finalizeNote(r.text).text).toBe(r.text);
  });

  it('카드별 maxLength(그래핌, 140 이하)를 줄 수 있다', () => {
    expect(finalizeNote('가'.repeat(30), 20).text).toBe('가'.repeat(20));
    expect(sanitizeLive('가'.repeat(30), 20)).toBe('가'.repeat(20));
    expect(liveGraphemes('가'.repeat(30), 20)).toBe(20);
  });
});

describe('A11·A12·A13·A14: 제어·방향·결합 문자와 한글 자모', () => {
  it('A11: RLO(U+202E) · 격리(U+2066~2069) · 방향 표시(U+200E/F) · ALM(U+061C) · 임베딩(U+202A~202D)은 지워진다', () => {
    for (const code of [0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c, 0x202a, 0x202b, 0x202c, 0x202d]) {
      expect(text(`가${cp(code)}나`), `U+${code.toString(16).toUpperCase()}`).toBe('가나');
    }
  });

  it('A12: 제어 문자 \\x01 \\x07 \\x1b와 널 \\x00은 지우고 [31m은 글자로 남는다', () => {
    expect(text('\x01\x07\x1b[31m')).toBe('[31m');
    expect(text('가\x00나')).toBe('가나');
    expect(text('가\x7f\x80\x9f나')).toBe('가나');
  });

  it('A13: 결합 문자 범람은 그래핌당 코드 포인트 8개까지만 남는다 (기본 글자 1 + 결합 7)', () => {
    const flood = 'a' + cp(0x301).repeat(500);
    const r = finalizeNote(flood);
    expect(r.graphemes).toBe(1);
    expect([...r.text].length).toBe(NOTE_LIMITS.clusterCodePoints);
    // 여러 그래핌이 범람해도 단위 400을 넘지 않는다
    const many = finalizeNote(('가' + cp(0x301).repeat(100)).repeat(200));
    expect(many.text.length).toBeLessThanOrEqual(NOTE_LIMITS.units);
    expect(many.graphemes).toBeLessThanOrEqual(NOTE_LIMITS.graphemes);
  });

  it('A14: 분리된 한글 자모(U+1112 U+1161 U+11AB)는 NFC로 한 1글자, 호환 자모 ㅎㅏㄴ은 그대로 3글자', () => {
    const decomposed = cp(0x1112, 0x1161, 0x11ab);
    const r = finalizeNote(decomposed);
    expect(r.text).toBe('한');
    expect(r.graphemes).toBe(1);
    const compat = finalizeNote('ㅎㅏㄴ');
    expect(compat.text).toBe('ㅎㅏㄴ');
    expect(compat.graphemes).toBe(3);
  });

  it('RTL 글(히브리·아랍)은 지우지 않는다 (표시 격리는 UI 몫, A10)', () => {
    for (const raw of ['שלום עולם', 'مرحبا بالعالم', 'abc שלום 가나다']) expect(text(raw)).toBe(raw);
  });

  it('개인 사용 영역 · 비문자 · 짝 없는 서러게이트는 지우고, 대체 문자 U+FFFD는 보이는 글자라 둔다', () => {
    expect(text(`가${cp(0xe000)}${cp(0xf8ff)}${cp(0xf0000)}${cp(0x10ffff)}${cp(0xfdd0)}${cp(0xfffe)}나`)).toBe('가나');
    expect(text('가\ud800나\udc00다')).toBe('가나다');
    expect(text(`가${cp(0xfffd)}나`)).toBe(`가${cp(0xfffd)}나`);
  });
});

describe('문자 처분표 (3-3절) — 코드 포인트마다', () => {
  const between = (code: number): string => `a${cp(code)}b`;

  it('가로 공백류와 보이는 빈칸 글자는 공백 하나로 (지우면 낱말이 붙는다)', () => {
    const spaces = [0x09, 0xa0, 0x1680, ...Array.from({ length: 11 }, (_, i) => 0x2000 + i), 0x202f, 0x205f, 0x3000, 0x3164, 0x115f, 0x1160, 0xffa0, 0x2800, 0x180e];
    for (const code of spaces) {
      expect(dispositionOf(code), `U+${code.toString(16)}`).toBe('space');
      expect(text(between(code)), `U+${code.toString(16)}`).toBe('a b');
    }
  });

  it('제어·방향·제로폭·서식 문자는 지운다', () => {
    const drops = [0x00, 0x08, 0x0e, 0x1f, 0x7f, 0x80, 0x9f, 0xad, 0x34f, 0x61c, 0x200b, 0x200c, 0x200e, 0x200f, 0x202a, 0x202e, 0x2060, 0x2064, 0x2066, 0x2069, 0x206a, 0x206f, 0xfeff, 0xfff9, 0xfffb, 0xfe00, 0xfe0d, 0xe0100, 0xe01ef, 0xe000, 0xf8ff, 0xf0000, 0x10ffff, 0xfdd0, 0xfdef, 0xfffe, 0xffff];
    for (const code of drops) {
      expect(dispositionOf(code), `U+${code.toString(16)}`).toBe('drop');
      expect(text(between(code)), `U+${code.toString(16)}`).toBe('ab');
    }
  });

  it('줄 구분 문자는 줄바꿈 하나로', () => {
    for (const code of [0x0a, 0x0b, 0x0c, 0x0d, 0x85, 0x2028, 0x2029]) {
      expect(dispositionOf(code)).toBe('newline');
      expect(text(between(code))).toBe('a\nb');
    }
  });

  it('조건부 문자(ZWJ·변이 선택자·태그)는 처분이 따로이고, 배정되지 않은 코드 포인트·일반 글자·기호는 둔다', () => {
    expect(dispositionOf(0x200d)).toBe('joiner');
    expect(dispositionOf(0xfe0f)).toBe('variation');
    expect(dispositionOf(0xe0067)).toBe('tag');
    for (const code of [0x41, 0xac00, 0x2065, 0x1fffd, 0xe0, 0x20e3, 0x1f600, 0xfffd, 0x378]) expect(dispositionOf(code), `U+${code.toString(16)}`).toBe('keep');
    expect(text(`a${cp(0x378)}b`), '배정되지 않은 코드 포인트도 지우지 않는다').toBe(`a${cp(0x378)}b`);
  });

  it('isInvisibleOnly: 보이는 글자가 하나도 없는 글인가 (공백·줄바꿈·지워질 글자뿐)', () => {
    expect(isInvisibleOnly('')).toBe(true);
    expect(isInvisibleOnly(` \n${ZWSP}${cp(0x3164)}`)).toBe(true);
    expect(isInvisibleOnly('.')).toBe(false);
    expect(isInvisibleOnly(' a ')).toBe(false);
  });
});

describe('sanitizeLive: 입력 중 정리 (3-2절 끝)', () => {
  it('앞뒤 공백을 지우지 않고 공백도 접지 않는다 — 낱말 뒤 띄어쓰기를 칠 수 있다', () => {
    expect(sanitizeLive('안녕 ')).toBe('안녕 ');
    expect(sanitizeLive(' 안녕  하세요')).toBe(' 안녕  하세요');
    expect(sanitizeLive('줄 끝 \n다음')).toBe('줄 끝 \n다음');
  });

  it('방금 누른 줄바꿈 하나는 남기고, 빈 줄은 만들지 않는다. 입력란이 비어 있을 때의 Enter는 무시한다', () => {
    expect(sanitizeLive('가\n')).toBe('가\n');
    expect(sanitizeLive('가\n\n')).toBe('가\n');
    expect(sanitizeLive('가\n\n\n나')).toBe('가\n나');
    expect(sanitizeLive('\n')).toBe('');
    expect(sanitizeLive('   ')).toBe('   ');
  });

  it('3줄이 찼으면 4번째 줄을 만드는 Enter는 무시하고, 붙여넣기로 넘친 줄은 3번째 줄 끝에 공백으로 잇는다', () => {
    expect(sanitizeLive('1\n2\n3\n')).toBe('1\n2\n3');
    expect(sanitizeLive('1\n2\n')).toBe('1\n2\n');
    expect(sanitizeLive('1\n2\n3\n4\n5')).toBe('1\n2\n3 4 5');
  });

  it('위험한 글자는 입력 중에도 걷는다 (RLO·제어·ZWSP) — 이모지는 그대로', () => {
    expect(sanitizeLive(`가${cp(0x202e)}${ZWSP}\x01나${FAMILY}`)).toBe(`가나${FAMILY}`);
  });

  it('한도를 넘으면 한도를 지키는 가장 긴 앞부분을 돌려준다 (140글자 · 단위 400)', () => {
    expect(sanitizeLive('가'.repeat(141))).toBe('가'.repeat(140));
    expect(sanitizeLive('가'.repeat(10_000))).toBe('가'.repeat(140));
    expect(sanitizeLive(FAMILY.repeat(100))).toBe(FAMILY.repeat(50));
  });

  it('한도는 「저장될 글」 기준이다: 연속 공백이 많아도 접힌 결과가 140글자 안이면 그대로 둔다', () => {
    const spaced = Array.from({ length: 100 }, () => '가').join('   '); // 100글자 + 공백 297칸 — 저장되면 199글자... 한도 밖
    const fits = Array.from({ length: 60 }, () => '가').join('  '); // 접히면 119글자
    expect(sanitizeLive(fits)).toBe(fits);
    expect(finalizeNote(sanitizeLive(spaced)).text).toBe(finalizeNote(spaced).text);
  });

  it('글자 수 표시: 저장될 글의 그래핌 수 — 140을 넘지 않고 끝 공백은 세지 않는다', () => {
    expect(liveGraphemes('안녕 ')).toBe(2);
    expect(liveGraphemes('가'.repeat(500))).toBe(140);
    expect(liveGraphemes('')).toBe(0);
  });
});

describe('cleanNoteForLoad: 불러올 때는 거부하지 않고 위험한 글자만 걷는다 (3-6절 H3·H4)', () => {
  it('RLO·제로폭·제어·서러게이트·개인 사용 영역은 걷고 나머지는 그대로 둔다', () => {
    expect(cleanNoteForLoad(`가${cp(0x202e)}나${ZWSP}다\x01라\ud800${cp(0xe000)}`)).toBe('가나다라');
    expect(cleanNoteForLoad('보통의 글 <b>& "인용"</b>')).toBe('보통의 글 <b>& "인용"</b>');
  });

  it('이모지 시퀀스 안의 ZWJ·변이 선택자·태그는 둔다. 밖의 것은 걷는다', () => {
    for (const seq of [FAMILY, FLAG_KR, THUMBS_TONE, KEYCAP_1, FLAG_ENGLAND, cp(0x2764, 0xfe0f, 0x200d, 0x1f525)]) expect(cleanNoteForLoad(`가${seq}나`)).toBe(`가${seq}나`);
    expect(cleanNoteForLoad(`가${ZWJ}나`)).toBe('가나');
    expect(cleanNoteForLoad(cp(0x1f468, 0x200d))).toBe(cp(0x1f468));
    expect(cleanNoteForLoad(`가${cp(0xfe0f)}`)).toBe('가');
    expect(cleanNoteForLoad(`가${cp(0xe0067, 0xe007f)}`)).toBe('가');
  });

  it('그래핌 140 · 단위 400 · 3줄은 다시 적용하지 않는다 — 다른 기기에서 쓴 정상 기록이 잘리지 않게 (H4)', () => {
    const long = '가'.repeat(300) + '\n나\n다\n라\n마';
    expect(cleanNoteForLoad(long)).toBe(long);
    const families = FAMILY.repeat(120); // 960단위
    expect(cleanNoteForLoad(families)).toBe(families);
  });

  it('20,000단위를 넘는 변조 값은 그래핌 경계에서 자른다 (반쪽 시퀀스·서러게이트를 남기지 않는다)', () => {
    const huge = '가'.repeat(30_000);
    expect(cleanNoteForLoad(huge)).toBe('가'.repeat(NOTE_LIMITS.readUnits));
    const sequences = FAMILY.repeat(5_000); // 40,000단위
    const out = cleanNoteForLoad(sequences);
    expect(out.length).toBeLessThanOrEqual(NOTE_LIMITS.readUnits);
    expect(out).toBe(FAMILY.repeat(out.length / FAMILY.length));
  });

  it('쓸 때 정규화한 글은 불러와도 그대로다 (finalizeNote의 결과는 cleanNoteForLoad의 고정점)', () => {
    for (const raw of [FAMILY, `가${FLAG_KR}나${THUMBS_TONE}${KEYCAP_1}${FLAG_ENGLAND}`, '1\n2\n3 4', cp(0x2764, 0xfe0f), 'שלום 가', '한' + cp(0x301)]) {
      const saved = finalizeNote(raw).text;
      expect(cleanNoteForLoad(saved)).toBe(saved);
    }
  });
  it('R-406 하위 지역 깃발의 태그 글자 수는 한 쌍(tagLettersMin~Max = 2~6)이 쓸 때와 불러올 때를 같이 정한다 — 태그 글자 1~12개 열의 finalizeNote 결과는 모두 cleanNoteForLoad의 고정점이고, 2~6개짜리만 깃발로 남는다', () => {
    const flagOf = (n: number, last = 0xe007f): string => cp(0x1f3f4, ...Array.from({ length: n }, (_, i) => 0xe0061 + (i % 26)), last);
    const seenShapes = new Set<string>();
    for (let n = 1; n <= 12; n++) {
      const raw = '가' + flagOf(n) + '나';
      const saved = finalizeNote(raw).text;
      expect(cleanNoteForLoad(saved), `태그 글자 ${n}개 열`).toBe(saved);
      const kept = Array.from(saved).length;
      if (n >= NOTE_LIMITS.tagLettersMin && n <= NOTE_LIMITS.tagLettersMax) {
        expect(saved, `${n}개는 깃발로 남는다`).toBe(raw);
        expect(kept).toBe(n + 4); // 가 + 검은 깃발 + 태그 n + 취소 + 나
      } else {
        expect(saved, `${n}개는 깃발이 아니라 검은 깃발만 남는다 (숨은 글자 심기 차단)`).toBe('가' + cp(0x1f3f4) + '나');
      }
      seenShapes.add(saved);
    }
    expect(seenShapes.size, '공허 통과 방지: 서로 다른 결과가 나왔다').toBeGreaterThanOrEqual(6);
    // 태그 숫자(지역 코드의 숫자)는 글자다 — 소문자·숫자 밖의 태그(공백·대문자·기호)는 깃발이 아니다
    const withDigit = cp(0x1f3f4, 0xe0067, 0xe0062, 0xe0033, 0xe007f);
    expect(finalizeNote(withDigit).text).toBe(withDigit);
    for (const bad of [0xe0020, 0xe0041, 0xe0021, 0xe007e]) {
      const raw = cp(0x1f3f4, 0xe0067, bad, 0xe0062, 0xe007f);
      expect(finalizeNote(raw).text, `태그 U+${bad.toString(16)}가 낀 열`).toBe(cp(0x1f3f4));
    }
    // 변조된 저장: 불러올 때도 같은 상한이다 — 태그 글자는 6개까지, 취소 태그는 글자가 2개 이상일 때만, 깃발 밖의 태그는 없다
    const tampered = cleanNoteForLoad('가' + flagOf(11) + '나');
    expect(Array.from(tampered).filter((ch) => ch.codePointAt(0)! >= 0xe0030 && ch.codePointAt(0)! <= 0xe007a)).toHaveLength(NOTE_LIMITS.tagLettersMax);
    expect(cleanNoteForLoad(cp(0x1f3f4, 0xe007f))).toBe(cp(0x1f3f4)); // 글자 없는 취소 태그
    expect(cleanNoteForLoad(cp(0x1f3f4, 0xe0067, 0xe007f))).toBe(cp(0x1f3f4)); // 글자 1개는 깃발이 아니다(최소 2개)
    expect(cleanNoteForLoad(flagOf(3) + cp(0xe0061))).toBe(flagOf(3)); // 취소 태그 뒤의 태그는 지운다
    expect(cleanNoteForLoad('a' + cp(0xe0061, 0xe0062, 0xe007f))).toBe('a'); // 깃발 밖의 태그
  });

  it('불러올 때 남는 세로 탭·쪽 나눔·CR·U+0085·U+2028·U+2029(변조 저장에만 있다)는 줄바꿈 하나로 바꾼다 — finalizeNote의 결과에는 줄바꿈 하나뿐이라 고정점은 그대로다', () => {
    expect(cleanNoteForLoad('a\vb\fc' + cp(0x85) + 'd' + cp(0x2028) + 'e' + cp(0x2029) + 'f')).toBe('a\nb\nc\nd\ne\nf');
    const saved = finalizeNote('1\n2\n3').text;
    expect(cleanNoteForLoad(saved)).toBe(saved);
  });
});

describe('멱등과 속성 (시드 고정 난수 1만 개 입력)', () => {
  /** 입력 조각 — 이모지·ZWJ·결합 문자·제어·방향·공백·줄바꿈·서러게이트·RTL을 두루 섞는다 */
  const PIECES: string[] = [
    'a', 'Z', '가', '한', '나', '1', '#', '*', '<', '&', '"', "'", '\\', ',', '.', ' ', '  ', '\t', '\n', '\n\n', '\r\n', '\r', cp(0x2028), cp(0x85), '\v',
    GRIN, FAMILY, FLAG_KR, cp(0x1f1f0), THUMBS_TONE, KEYCAP_1, FLAG_ENGLAND, cp(0x2764, 0xfe0f), cp(0x1f468), cp(0x1f3fd),
    ZWJ, ZWSP, cp(0x200c), cp(0xfe0f), cp(0xfe0e), cp(0x20e3), cp(0xe0067), cp(0xe007f), cp(0xfeff), cp(0x2060), cp(0xad),
    cp(0x202e), cp(0x2066), cp(0x2069), cp(0x200e), cp(0x061c), cp(0x301), cp(0x302), cp(0x3099), cp(0x3164), cp(0x115f), cp(0xa0), cp(0x3000), cp(0x2003),
    '\x00', '\x07', '\x1b', '\x7f', '\ud800', '\udc00', cp(0xe000), cp(0xf0000), cp(0xfffd), cp(0xfdd0),
    'א', 'ب', 'שלום', cp(0x1112, 0x1161, 0x11ab), 'ㅎㅏㄴ',
  ];
  const DANGEROUS = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff\ufff9-\ufffb\ue000-\uf8ff\ufdd0-\ufdef\ufffe\uffff]/;

  function randomInput(rng: ReturnType<typeof createRng>): string {
    const pieces = rng.int(0, 5) === 0 ? rng.int(200, 1500) : rng.int(0, 120);
    let s = '';
    for (let i = 0; i < pieces; i++) s += PIECES[rng.int(0, PIECES.length - 1)];
    return s;
  }

  function check(raw: string, i: number, strict: boolean): ReturnType<typeof finalizeNote> {
    const f = finalizeNote(raw);
    const label = `#${i} ${JSON.stringify(raw.slice(0, 40))}`;
    // 한도
    expect(f.graphemes, label).toBeLessThanOrEqual(NOTE_LIMITS.graphemes);
    expect(f.text.length, label).toBeLessThanOrEqual(NOTE_LIMITS.units);
    expect(f.text.split('\n').length, label).toBeLessThanOrEqual(NOTE_LIMITS.lines);
    expect(f.graphemes, label).toBe(countGraphemes(f.text));
    expect(f.empty, label).toBe(f.text === '');
    // 위험한 글자 0 (제어·방향·제로폭·서식·짝 없는 서러게이트·개인 사용 영역·비문자)
    expect(DANGEROUS.test(f.text), `${label} 위험한 글자`).toBe(false);
    expect(/(?:[\ud800-\udbff](?![\udc00-\udfff]))|(?:(?<![\ud800-\udbff])[\udc00-\udfff])/.test(f.text), `${label} 짝 없는 서러게이트`).toBe(false);
    // 공백 정리: 줄 앞뒤 공백·연속 공백·빈 줄 없음
    for (const line of f.text.split('\n')) {
      if (f.text !== '') expect(line === '' || (line.trim() === line && !line.includes('  ')), `${label} 줄 공백`).toBe(true);
    }
    expect(f.text.includes('\n\n'), label).toBe(false);
    // 멱등
    expect(finalizeNote(f.text).text, `${label} 멱등`).toBe(f.text);
    // 불러와도 그대로
    expect(cleanNoteForLoad(f.text), `${label} 불러오기 고정점`).toBe(f.text);
    // 입력 중 정리와 같은 결과 (저장될 글 기준)
    if (strict) {
      const live = sanitizeLive(raw);
      expect(finalizeNote(live).text, `${label} sanitizeLive`).toBe(f.text);
      expect(sanitizeLive(live), `${label} sanitizeLive 멱등`).toBe(live);
    }
    return f;
  }

  it('1만 개 입력: throw 0 · ≤ 140글자 · ≤ 400단위 · ≤ 3줄 · 위험한 글자 0 · 멱등 · 불러오기 고정점 · finalizeNote(sanitizeLive(x)) = finalizeNote(x)', () => {
    const rng = createRng(20261019);
    let truncated = 0;
    let merged = 0;
    let empty = 0;
    let withEmoji = 0;
    for (let i = 0; i < 10_000; i++) {
      const f = check(randomInput(rng), i, true);
      if (f.truncated) truncated++;
      if (f.linesMerged) merged++;
      if (f.empty) empty++;
      if (f.text.includes(ZWJ)) withEmoji++;
    }
    // 공허 통과 방지: 입력이 한도·줄·빈 입력·이모지 시퀀스 경로를 실제로 두루 지나갔다
    expect(truncated, '한도에 걸려 잘린 입력').toBeGreaterThan(500);
    expect(merged, '줄을 이어 붙인 입력').toBeGreaterThan(200);
    expect(empty, '빈 입력').toBeGreaterThan(20);
    expect(withEmoji, 'ZWJ 시퀀스가 남은 입력').toBeGreaterThan(500);
  }, 120_000);

  it('Intl.Segmenter가 없는 환경에서도 같은 속성이 성립한다 (코드 포인트 단위, ZWJ·변이 선택자·태그는 모두 지운다) — 2천 개', () => {
    withoutSegmenter(() => {
      expect((Intl as unknown as { Segmenter?: unknown }).Segmenter).toBeUndefined();
      const rng = createRng(77);
      for (let i = 0; i < 2_000; i++) check(randomInput(rng), i, true);
      // 이모지 시퀀스는 흩어지지만 그림 문자는 남고 ZWJ는 없다
      expect(finalizeNote(FAMILY).text).toBe(cp(0x1f468, 0x1f469, 0x1f467));
      expect(finalizeNote(`a${KEYCAP_1}`).text.includes(cp(0xfe0f))).toBe(false);
      // 결합 문자 범람과 한도는 여전히 지켜진다
      expect(finalizeNote('a' + cp(0x301).repeat(500)).text.length).toBeLessThanOrEqual(NOTE_LIMITS.clusterCodePoints);
      expect(finalizeNote('가'.repeat(500)).graphemes).toBe(140);
      expect(sanitizeLive('가'.repeat(500))).toBe('가'.repeat(140));
    });
  });

  it('Segmenter가 없다가 다시 생겨도(환경 되돌림) 그래핌 수가 정상이다', () => {
    withoutSegmenter(() => {
      expect(countGraphemes(FAMILY), '코드 포인트 단위(그림 3 + ZWJ 2)').toBe(5);
      expect(finalizeNote(FAMILY).graphemes, '정규화 뒤에는 ZWJ가 지워져 그림 3').toBe(3);
    });
    expect(countGraphemes(FAMILY)).toBe(1);
    expect(finalizeNote(FAMILY).graphemes).toBe(1);
  });
});
