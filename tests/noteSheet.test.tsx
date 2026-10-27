import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NOTE_LIMITS, noteQuestion, type GameState } from '../src/core';
import copyMd from '../docs/design/copy.md?raw';
import { NOTE_CARDS, NOTE_MANUAL } from '../src/data/noteCards';
import { NOTE_TEXT } from '../src/data/noteSheetText';
import { titleCharsFor } from '../src/data/dashText';
import { NoteSheet, type NoteSheetProps } from '../src/ui/dash/NoteSheet';
import { INPUT_GUARD_MS } from '../src/ui/GuardedButton';
import { REMAINING_NOTICE_AT, caretAfterSanitize, decideEsc, decideKeep, decideSkip, inputNotice, lineCount } from '../src/ui/noteInput';
import { GUARANTEE_AT, isCompact, needsCompact, readVisualViewport } from '../src/ui/useVisualViewport';
import { startLife } from '../scripts/simulateLib';
import type { LifeGame } from '../src/ui/dash/Cards';

/**
 * 기록 시트 「생각 남기기」 (SPEC-003 M7c FR1~FR9, content-M7c 5-1~5-2·6-2절, copy.md 7절, D-68·D-71·D-72·D-77): 서버 렌더로 요소·이름·`aria-*`·문구를 보고, 입력 처분(빈 입력·확인·Esc·IME)은 순수 함수로 본다.
 * 키 입력·IME 조합·확인 단계 흐름·연타·40개·새로고침은 브라우저가 필요해 e2e/m7c-note.spec.ts·m7c-input-attack.spec.ts가 본다(이 파일은 DOM 환경이 없다).
 */

const base = startLife(2024, 'alpha');
const lifeAt = (age: number, over: Partial<GameState> = {}): LifeGame => ({ ...base, ...over, age, character: base.character!, generation: base.generation!, birthReport: base.birthReport!, peerSeed: base.peerSeed! });
const CITED = NOTE_CARDS.find((c) => c.citation !== undefined)!;
const UNCITED = NOTE_CARDS.find((c) => c.citation === undefined)!;

const noop = () => undefined;
function render(over: Partial<NoteSheetProps> = {}): string {
  const via = over.via ?? 'auto';
  const props: NoteSheetProps = { via, card: via === 'auto' ? CITED : null, game: lifeAt(5), count: 0, cardsOn: true, guardKey: 'k1', onSave: noop, onDismiss: noop, onToggleCards: noop, ...over };
  return renderToStaticMarkup(<NoteSheet {...props} />);
}
const attr = (html: string, tag: string, name: string): string | null => {
  const m = new RegExp(`<${tag}\\b[^>]*?\\s${name}(?:="([^"]*)")?[\\s>/]`).exec(html);
  return m === null ? null : (m[1] ?? '');
};
const openTag = (html: string, testId: string): string => (html.match(/<[a-z0-9]+\s[^>]*>/g) ?? []).find((t) => t.includes(`data-testid="${testId}"`))!;
const text = (html: string) => html.replace(/<svg[^]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const inner = (html: string, testId: string): string => {
  const open = openTag(html, testId);
  const start = html.indexOf(open) + open.length;
  const tagName = /^<([a-z0-9]+)/.exec(open)![1];
  // 같은 이름의 태그가 겹쳐 있어도 짝이 맞는 닫는 태그까지 읽는다
  const re = new RegExp(`<(/?)${tagName}(?=[\\s>])[^>]*>`, 'g');
  re.lastIndex = start;
  let depth = 1;
  for (let m = re.exec(html); m !== null; m = re.exec(html)) {
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  throw new Error('닫는 태그가 없다: ' + testId);
};

describe('문구: copy.md 7-2절과 글자까지 같다 (designer 최종 문구, 2026-10-19)', () => {
  const section = copyMd.slice(copyMd.indexOf('### 7-2.'), copyMd.indexOf('### 7-3.'));

  it('고정 문구 20여 개가 7-2절 표에 그대로 있다', () => {
    expect(section.length).toBeGreaterThan(2000);
    const statics: Array<[string, string]> = [
      ['kind', NOTE_TEXT.kind],
      ['inputLabel', NOTE_TEXT.inputLabel],
      ['hint', NOTE_TEXT.hint],
      ['keep', NOTE_TEXT.keep],
      ['keepSub', NOTE_TEXT.keepSub],
      ['skip', NOTE_TEXT.skip],
      ['skipSub', NOTE_TEXT.skipSub],
      ['linesFull', NOTE_TEXT.linesFull],
      ['emptyError', NOTE_TEXT.emptyError],
      ['cardsOff', NOTE_TEXT.cardsOff],
      ['cardsOn', NOTE_TEXT.cardsOn],
      ['cardsOffNotice', NOTE_TEXT.cardsOffNotice],
      ['cardsOnNotice', NOTE_TEXT.cardsOnNotice],
      ['limitTitle', NOTE_TEXT.limitTitle],
      ['limitSub', NOTE_TEXT.limitSub],
      ['close', NOTE_TEXT.close],
      ['confirmTitle', NOTE_TEXT.confirmTitle],
      ['confirmSub', NOTE_TEXT.confirmSub],
      ['confirmDiscard', NOTE_TEXT.confirmDiscard],
      ['confirmBack', NOTE_TEXT.confirmBack],
    ];
    for (const [name, value] of statics) expect(section, name).toContain(value);
    // 연표 줄 라벨(7-4절)도 같은 글자다
    expect(copyMd.slice(copyMd.indexOf('### 7-4.'), copyMd.indexOf('### 7-5.'))).toContain(`${NOTE_TEXT.rowLabel} · `);
  });

  it('함수로 만드는 문구도 7-2절과 같다: 글자 수 「{n}/140」·「{n}자 입력, 140자까지」, 알림 「20자 남았습니다.」·「140자까지 적었습니다.」·「140자까지 적을 수 있어 넘는 부분은 줄였습니다.」', () => {
    expect(NOTE_TEXT.count(34, 140)).toBe('34/140');
    expect(NOTE_TEXT.countSr(34, 140)).toBe('34자 입력, 140자까지');
    expect(section).toContain('{n}/140');
    expect(section).toContain('{n}자 입력, 140자');
    expect(section).toContain(NOTE_TEXT.remaining(20));
    expect(section).toContain(NOTE_TEXT.reachedMax(140));
    expect(section).toContain(NOTE_TEXT.truncated(140));
  });

  it('질문 7종과 수동 질문은 copy.md 7-1절 최종 문구이고 {이름} 자리가 있다 (notes.json)', () => {
    const q = copyMd.slice(copyMd.indexOf('### 7-1.'), copyMd.indexOf('### 7-2.'));
    for (const c of NOTE_CARDS) {
      expect(q, c.id).toContain(c.prompt);
      for (const v of c.variants ?? []) expect(q, `${c.id} 변형`).toContain(v.prompt);
    }
    expect(q).toContain(NOTE_MANUAL.prompt);
    expect(NOTE_CARDS).toHaveLength(7);
  });
});

describe('시트 틀 (자동 카드, 인용 있는 ①): 대화상자·머리·질문·입력란·두 버튼·끄기 칸 (FR1·FR3·FR5·FR6·FR7)', () => {
  const game = lifeAt(5);
  const html = render({ game });

  it('대화상자: role=dialog · aria-modal · aria-labelledby="nc-kind nc-title" → 이름은 「생각 남기기 {질문}」 (종류가 먼저)', () => {
    const tag = openTag(html, 'note-sheet');
    expect(tag).toContain('role="dialog"');
    expect(tag).toContain('aria-modal="true"');
    expect(tag).toContain('aria-labelledby="nc-kind nc-title"');
    expect(tag).toContain('data-via="auto"');
    expect(tag).toContain(`data-card="${CITED.id}"`);
    expect(text(inner(html, 'note-title'))).toBe(noteQuestion(CITED, game));
    expect(html).toContain(`<span class="sheet__kind sheet__kind--note" id="nc-kind">${NOTE_TEXT.kind}</span>`);
    expect(html.indexOf('id="nc-kind"')).toBeLessThan(html.indexOf('id="nc-title"'));
    // 바깥은 .overlay > .sheet 이중 구조(결정 시트와 같은 틀), 중첩 dialog 없음
    expect(html.startsWith('<div class="overlay"')).toBe(true);
    expect(html.match(/role="dialog"/g)).toHaveLength(1);
  });

  it('머리: 「{연도}년 · {나이}세」는 FitPair hideSeparator(가운뎃점 aria-hidden) — 낭독은 「2029년 5세」', () => {
    const when = inner(html, 'note-when');
    expect(when).toContain('<span aria-hidden="true">·</span>');
    const read = when.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    expect(read).toMatch(/^\d{4}년 5세$/);
  });

  it('질문(h2): id=nc-title · tabindex=-1(열릴 때 포커스를 받는다) · --title-chars는 질문에서 계산한 값', () => {
    const tag = openTag(html, 'note-title');
    expect(tag.startsWith('<h2 ')).toBe(true);
    expect(tag).toContain('id="nc-title"');
    expect(tag).toContain('tabindex="-1"');
    expect(tag).toContain(`--title-chars:${titleCharsFor(noteQuestion(CITED, game))}`);
  });

  it('입력란(D6·D-72): label 「남길 글」(sr-only) · id=note-input · rows=3 · dir=auto · autocomplete=off · spellcheck=false · maxlength=4000(140 아님) · data-user-text · name 없음 · form 밖', () => {
    expect(html).toContain('<label class="sr-only" for="note-input">남길 글</label>');
    const tag = openTag(html, 'note-input');
    expect(tag.startsWith('<textarea ')).toBe(true);
    expect(tag).toContain('id="note-input"');
    expect(tag).toContain('rows="3"');
    expect(tag).toContain('dir="auto"');
    expect(tag.toLowerCase()).toContain('autocomplete="off"');
    expect(tag).toContain('spellcheck="false"');
    expect(tag.toLowerCase()).toContain('maxlength="4000"');
    expect(tag.toLowerCase()).not.toContain('maxlength="140"');
    expect(tag).toContain('data-user-text=""');
    expect(tag).not.toMatch(/\sname=/);
    expect(tag).not.toContain('readonly'); // 확인 단계에서만 읽기 전용
    expect(tag).not.toContain('aria-invalid'); // 빈 입력 오류에서만
    expect(html).not.toContain('<form');
    expect(attr(html, 'textarea', 'aria-describedby')).toBe('note-hint note-count-sr');
  });

  it('개인정보 안내(FR8)가 입력란 아래에 눈에 보이고, 글자 수는 눈에 보이는 「0/140」(aria-hidden) + 읽기 전용 「0자 입력, 140자까지」다', () => {
    expect(text(inner(html, 'note-hint'))).toBe(NOTE_TEXT.hint);
    const hint = openTag(html, 'note-hint');
    expect(hint).toContain('id="note-hint"');
    expect(hint).not.toContain('aria-hidden');
    const count = openTag(html, 'note-count');
    expect(count).toContain('aria-hidden="true"');
    expect(text(inner(html, 'note-count'))).toBe('0/140');
    expect(openTag(html, 'note-count-sr')).toContain('class="sr-only"');
    expect(text(inner(html, 'note-count-sr'))).toBe('0자 입력, 140자까지');
    // 글자 수 표시는 입력란 뒤, 안내 줄 안
    expect(html.indexOf('data-testid="note-input"')).toBeLessThan(html.indexOf('data-testid="note-hint"'));
  });

  it('알림 줄은 한 곳(role=status, aria-live=polite)이고 처음엔 비어 있다 (글자마다 읽지 않는다)', () => {
    const tag = openTag(html, 'note-msg');
    expect(tag).toContain('id="note-msg"');
    expect(tag).toContain('role="status"');
    expect(tag).toContain('aria-live="polite"');
    expect(inner(html, 'note-msg')).toBe('');
    expect(tag).not.toContain('field__msg--error');
  });

  it('두 버튼: 번호 원(aria-hidden) + 「적어두고 살기」 / 「마음속에 담고 살기」, 보조 설명은 aria-describedby, 접근 가능한 이름은 번호 없는 문구', () => {
    const keep = openTag(html, 'note-save');
    const skip = openTag(html, 'note-skip');
    expect(keep).toContain('aria-labelledby="nc-keep"');
    expect(keep).toContain('aria-describedby="nc-keep-sub"');
    expect(skip).toContain('aria-labelledby="nc-skip"');
    expect(skip).toContain('aria-describedby="nc-skip-sub"');
    expect(html).toContain(`<span id="nc-keep">${NOTE_TEXT.keep}</span>`);
    expect(html).toContain(`<span id="nc-skip">${NOTE_TEXT.skip}</span>`);
    expect(html).toContain(`<span class="note-choice__sub" id="nc-keep-sub">${NOTE_TEXT.keepSub}</span>`);
    expect(html).toContain(`<span class="note-choice__sub" id="nc-skip-sub">${NOTE_TEXT.skipSub}</span>`);
    expect(html.match(/<span class="choice__no" aria-hidden="true">/g)).toHaveLength(2);
    expect(keep).toContain('note-choice--primary'); // 1번이 기본 모양
    // 순서: 질문 → 인용 → 입력란 → 안내 → 두 버튼 (낭독 순서)
    const order = ['data-testid="note-title"', 'data-testid="cite"', 'data-testid="note-input"', 'data-testid="note-hint"', 'data-testid="note-save"', 'data-testid="note-skip"'].map((m) => html.indexOf(m));
    for (const i of order) expect(i).toBeGreaterThan(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('입력 가드 400ms: 새로 뜬 시트의 두 버튼은 닫힌 채(aria-disabled) 시작한다 — 결정 시트 직후 더블탭의 둘째 입력이 떨어지지 않는다', () => {
    expect(INPUT_GUARD_MS).toBe(400);
    for (const id of ['note-save', 'note-skip']) {
      expect(openTag(html, id), id).toContain('aria-disabled="true"');
      expect(openTag(html, id), id).not.toContain('data-unavailable'); // 가드는 지속 비활성이 아니다(흐린 모양)
    }
  });

  it('끄기/켜기 칸(FR7, D-77): 켜져 있으면 「저절로 뜨는 기록 카드 끄기」, 꺼져 있으면 「…켜기」 — 이름이 상태를 전하므로 aria-pressed가 없고, 처음엔 알림이 비어 있다', () => {
    const on = render({ cardsOn: true });
    const off = render({ cardsOn: false });
    expect(text(inner(on, 'note-cards-toggle'))).toBe(NOTE_TEXT.cardsOff);
    expect(text(inner(off, 'note-cards-toggle'))).toBe(NOTE_TEXT.cardsOn);
    for (const h of [on, off]) {
      expect(openTag(h, 'note-cards-toggle')).not.toContain('aria-pressed');
      expect(openTag(h, 'note-cards-toggle')).toContain('type="button"');
      expect(inner(h, 'note-notice')).toBe('');
      expect(openTag(h, 'note-notice')).toContain('role="status"');
    }
    // 입력란 아래 칸이라 두 버튼 뒤
    expect(html.indexOf('data-testid="note-cards-toggle"')).toBeGreaterThan(html.indexOf('data-testid="note-skip"'));
  });

  it('첫 렌더는 compact가 아니다(입력란에 포커스가 없다): data-compact="false", 클래스 sheet--compact 없음, visualViewport 스타일 변수 없음(서버)', () => {
    expect(openTag(html, 'note-sheet')).toContain('data-compact="false"');
    expect(html).not.toContain('sheet--compact');
    expect(openTag(html, 'note-overlay')).not.toContain('--vv-h');
  });
});

describe('인용 (FR2): 있을 때만 박스, 없으면 요소 자체가 없다', () => {
  it('카드 ①(c-102)에는 인용 박스(종류 라벨·요약·출처 한 줄)가 있고 링크가 없다 — 풀이 줄은 없다 (기록 카드의 인용에는 풀이를 달지 않는다, r4 UX14-2)', () => {
    const html = render({ card: CITED, game: lifeAt(5) });
    expect(html).toContain('data-testid="cite"');
    expect(html).not.toContain('cite-insight');
    expect(html).not.toContain('cite__insight');
    expect(html).toContain(`data-citation="${CITED.citation}"`);
    expect(html).not.toMatch(/<a[\s>]/);
    expect(html).not.toContain('href=');
  });

  it('나머지 카드 여섯 장과 수동 기록에는 인용 박스가 없다 (빈 박스 0)', () => {
    for (const c of NOTE_CARDS.filter((x) => x.citation === undefined)) {
      expect(render({ card: c, game: lifeAt(c.ageRange.min) }), c.id).not.toContain('class="cite"');
    }
    expect(render({ via: 'manual' })).not.toContain('class="cite"');
    expect(UNCITED).toBeDefined();
  });
});

describe('수동 기록 (「생각 남기기」 버튼): 같은 시트, 고정 질문·인용 없음', () => {
  const game = lifeAt(33);
  const html = render({ via: 'manual', card: null, game });

  it('data-via=manual · data-card=manual이고 질문은 고정 질문 「지금 {이름}의 마음에 …」이다', () => {
    const tag = openTag(html, 'note-sheet');
    expect(tag).toContain('data-via="manual"');
    expect(tag).toContain('data-card="manual"');
    expect(text(inner(html, 'note-title'))).toBe(noteQuestion(null, game));
    expect(text(inner(html, 'note-title'))).toContain(game.character.name);
    expect(text(inner(html, 'note-title'))).not.toContain('{이름}');
    expect(html).toContain('data-testid="note-input"');
    expect(html).toContain('data-testid="note-save"');
    expect(html).toContain('data-testid="note-skip"');
  });
});

describe('기록 40개 도달 뒤 (FR5, copy.md 7-2 ⑨): 입력란·두 버튼·끄기 칸 대신 안내와 「닫기」', () => {
  const html = render({ via: 'manual', card: null, game: lifeAt(40), count: NOTE_LIMITS.total });

  it('질문 자리(h2)에 40개 안내, 보조, 「닫기」 한 개 — 입력란·번호 버튼·끄기 칸이 없다. 대화상자 이름은 「생각 남기기 이 인생에서 …」', () => {
    expect(NOTE_LIMITS.total).toBe(40);
    expect(text(inner(html, 'note-title'))).toBe(NOTE_TEXT.limitTitle);
    expect(text(inner(html, 'note-limit-sub'))).toBe(NOTE_TEXT.limitSub);
    expect(text(inner(html, 'note-limit-close'))).toBe(NOTE_TEXT.close);
    expect(openTag(html, 'note-limit-close')).toContain('btn--primary');
    for (const gone of ['note-input', 'note-save', 'note-skip', 'note-cards-toggle', 'note-hint', 'note-count']) expect(html, gone).not.toContain(`data-testid="${gone}"`);
    expect(html).not.toContain('<textarea');
    expect(openTag(html, 'note-sheet')).toContain('sheet--limit');
    expect(openTag(html, 'note-sheet')).toContain('aria-labelledby="nc-kind nc-title"');
  });

  it('39개까지는 평소 시트다(경계)', () => {
    const h = render({ via: 'manual', card: null, count: NOTE_LIMITS.total - 1 });
    expect(h).toContain('data-testid="note-input"');
    expect(h).not.toContain('sheet--limit');
  });
});

describe('입력 처분 (순수 함수): 1번·2번·Esc (content-M7c 5-2절, 3-8절 A7)', () => {
  it('1번 「적어두고 살기」: 공백·탭·줄바꿈만 · 빈 글 · 보이지 않는 글자만(U+3164, ZWSP) 이면 empty, 글이 있으면 save', () => {
    for (const raw of ['', ' ', '   ', '\t', '\n\n', ' \t\n ', '\u3164', '\u200B', '\u200F ', '\u200D\u200D']) expect(decideKeep(raw), JSON.stringify(raw)).toBe('empty');
    for (const raw of ['가', ' 가 ', 'a', '👍', '1'.repeat(300)]) expect(decideKeep(raw), JSON.stringify(raw)).toBe('save');
  });

  it('2번 「마음속에 담고 살기」: 글이 없으면 확인 없이 닫고(dismiss), 글이 있으면 확인 단계(confirm). 40개 안내 상태는 늘 dismiss', () => {
    expect(decideSkip('', false)).toBe('dismiss');
    expect(decideSkip('  \n ', false)).toBe('dismiss');
    expect(decideSkip('글', false)).toBe('confirm');
    expect(decideSkip('글', true)).toBe('dismiss');
    expect(decideSkip('', true)).toBe('dismiss');
  });

  it('Esc: 2번과 같다(skip). 확인 단계에서는 돌아가기(back). IME 조합 중(이벤트의 isComposing 또는 compositionstart~end)에는 무시한다. 이미 처리된 이벤트·다른 키도 무시', () => {
    const base = { key: 'Escape', isComposing: false, composing: false, handled: false, confirm: false };
    expect(decideEsc(base)).toBe('skip');
    expect(decideEsc({ ...base, confirm: true })).toBe('back');
    expect(decideEsc({ ...base, isComposing: true })).toBe('ignore');
    expect(decideEsc({ ...base, composing: true })).toBe('ignore');
    expect(decideEsc({ ...base, isComposing: true, confirm: true })).toBe('ignore');
    expect(decideEsc({ ...base, handled: true })).toBe('ignore');
    for (const key of ['Enter', 'Tab', 'a', 'Esc', ' ']) expect(decideEsc({ ...base, key }), key).toBe('ignore');
  });
});

describe('알림 줄과 캐럿 (순수 함수): 6-2절·3-5절', () => {
  const LIMIT = NOTE_LIMITS.graphemes;
  const n = (k: number, ch = '가') => ch.repeat(k);

  it('남은 글자가 20이 되는 순간에만 「20자 남았습니다.」, 140에 닿는 순간에만 「140자까지 적었습니다.」 — 그 밖에는 빈 글자(글자마다 읽지 않는다)', () => {
    expect(REMAINING_NOTICE_AT).toBe(20);
    expect(inputNotice(n(118), n(119), n(119))).toBe('');
    expect(inputNotice(n(119), n(120), n(120))).toBe(NOTE_TEXT.remaining(20));
    expect(inputNotice(n(120), n(121), n(121))).toBe('');
    expect(inputNotice(n(138), n(139), n(139))).toBe('');
    expect(inputNotice(n(139), n(140), n(140))).toBe(NOTE_TEXT.reachedMax(LIMIT));
    expect(inputNotice('', '가', '가')).toBe('');
  });

  it('141번째 글자·붙여넣기로 넘친 글은 잘렸다는 알림(A5·A17), 140은 자르지 않는다', () => {
    expect(inputNotice(n(140), n(141), n(140))).toBe(NOTE_TEXT.truncated(LIMIT));
    expect(inputNotice('', n(10000), n(140))).toBe(NOTE_TEXT.truncated(LIMIT));
    expect(inputNotice(n(139), n(140), n(140))).not.toBe(NOTE_TEXT.truncated(LIMIT));
  });

  it('줄이 3줄에 닿거나 붙여넣은 줄이 넘쳐 이어 붙으면 「줄은 세 줄까지 적을 수 있습니다.」 (A8·A9)', () => {
    expect(lineCount('a')).toBe(1);
    expect(lineCount('a\nb\nc')).toBe(3);
    expect(lineCount('a\n')).toBe(2);
    expect(inputNotice('a\nb', 'a\nb\nc', 'a\nb\nc')).toBe(NOTE_TEXT.linesFull);
    expect(inputNotice('', '1\n2\n3\n4\n5', '1\n2\n3 4 5')).toBe(NOTE_TEXT.linesFull);
    expect(inputNotice('a', 'a\nb', 'a\nb')).toBe('');
  });

  it('캐럿: 정리로 값이 바뀌지 않았으면 브라우저의 캐럿 그대로, 끝이 잘렸으면 그대로, 앞에서 글자가 걷혔으면 걷은 만큼 당기며 항상 새 값 길이 안이다', () => {
    expect(caretAfterSanitize('abc', 'abc', 2)).toBe(2);
    expect(caretAfterSanitize('abcdef', 'abc', 6)).toBe(3); // 끝이 잘림 → 새 끝
    expect(caretAfterSanitize('abXcd', 'abcd', 3)).toBe(2); // 앞(캐럿 앞) 글자 한 개가 걷힘
    expect(caretAfterSanitize('abcXd', 'abcd', 1)).toBe(1); // 캐럿 뒤가 바뀜 → 그대로
    for (const [raw, next, sel] of [['abc', '', 3], ['', '', 0], ['가나다라', '가', 4], ['XXXabc', 'abc', 6]] as const) {
      const c = caretAfterSanitize(raw, next, sel);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(next.length);
    }
  });
});

describe('가상 키보드 보조 (K1~K7, 잠정값 NC-14)', () => {
  it('compact는 고정 문턱이 아니라 「전체 시트가 최대 높이에 안 들어가는가」다 — 입력 영역에 포커스가 있고 전체 높이 > 최대 높이일 때만이며, visualViewport를 모르면(null) 아니다. 보장 높이는 340', () => {
    expect(GUARANTEE_AT).toBe(340);
    const vv = { height: 560, offsetTop: 0 };
    // 전체 시트 616px, 보이는 높이 560 → 최대 552 → 안 들어간다(예전 고정 문턱 520이 놓치던 520~616 구간)
    expect(isCompact(true, vv, { natural: 616, max: 552 })).toBe(true);
    expect(isCompact(true, { height: 619, offsetTop: 0 }, { natural: 616, max: 611 })).toBe(true);
    // 들어간다 → compact가 아니다 (전체 시트를 그대로 보인다)
    expect(isCompact(true, { height: 700, offsetTop: 0 }, { natural: 616, max: 692 })).toBe(false);
    expect(isCompact(true, vv, { natural: 552, max: 552 })).toBe(false);
    // 반올림 오차 0.5px는 허용
    expect(needsCompact({ natural: 552.4, max: 552 })).toBe(false);
    expect(needsCompact({ natural: 553, max: 552 })).toBe(true);
    // 포커스가 입력 영역에 없으면(질문 제목·밖) compact가 아니다. 모르는 것(null)도 아니다
    expect(isCompact(false, vv, { natural: 616, max: 300 })).toBe(false);
    expect(isCompact(true, null, { natural: 616, max: 300 })).toBe(false);
    expect(isCompact(true, vv, null)).toBe(false);
    expect(needsCompact(null)).toBe(false);
    expect(needsCompact({ natural: 300, max: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('visualViewport 값은 정수로 읽고, 없으면 null이다', () => {
    expect(readVisualViewport({ visualViewport: { height: 301.6, offsetTop: 10.4 } })).toEqual({ height: 302, offsetTop: 10 });
    expect(readVisualViewport({})).toBeNull();
    expect(readVisualViewport({ visualViewport: null })).toBeNull();
    expect(readVisualViewport(null)).toBeNull();
  });
});
