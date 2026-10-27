import { eraBucketOf } from '../../core/birthProfile';
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FocusEvent, type MouseEvent } from 'react';
import { NOTE_LIMITS, calendarYear, citationFor, liveGraphemes, noteQuestion, sanitizeLive, type NoteCardDef } from '../../core';
import { titleCharsFor } from '../../data/dashText';
import { NOTE_TEXT } from '../../data/noteSheetText';
import { FitPair } from '../FitPair';
import { Glue } from '../Glue';
import { GuardedButton } from '../GuardedButton';
import { useIsoLayoutEffect } from '../hooks';
import { decideNoteFocus, type NoteFocusMoment, type NoteFocusVia } from '../noteFocus';
import { caretAfterSanitize, decideEsc, decideKeep, decideSkip, inputNotice } from '../noteInput';
import { useScrollLock } from '../useScrollLock';
import { isCompact, useVisualViewport, type SheetFit } from '../useVisualViewport';
import type { LifeGame } from './Cards';
import { CitationBox } from './CitationBox';

/**
 * 기록 시트 「생각 남기기」 (SPEC-003 M7c FR1~FR9 — 문구·DOM은 docs/design/copy.md 7절, CSS는 styles/dash.css 「자유 기록 카드 「생각 남기기」 시트」, 시안 mockups/note.html, D-68·D-71·D-72·D-76·D-77).
 *
 * 한 시트 두 진입 경로: 저절로 뜬 카드(`via: 'auto'`, `card`가 있다)와 도구 줄 「생각 남기기」 버튼(`via: 'manual'`, `card === null`)이 같은 부품이다 — 질문·인용·닫을 때의 포커스만 다르다.
 * 틀은 중대 결정 시트와 같다(design-system.md 11-10): `.overlay > .sheet[role=dialog aria-modal]`, 바깥은 `inert`(LifeScreen이 건다), 열린 동안 문서 스크롤 잠금(`useScrollLock`), 열릴 때 포커스는 질문 제목(h2)으로.
 * **접기 없음**(NC-12): 닫는 길은 두 버튼과 Esc(= 2번)뿐이다.
 *
 * 입력 규칙은 core/noteText.ts: 입력 중에는 `sanitizeLive`(공백을 지우지 않는다), 제출 때는 `finalizeNote`(reducer가 한 번 더 한다). 한도는 그래핌 140이라 `maxlength`를 두지 않는다(브라우저는 UTF-16으로 세고 IME 조합 중에 자른다 — `maxLength` 4000은 안전망).
 * IME: 조합 중에는 값을 다시 쓰지 않고(React가 값을 되돌리면 한글 조합이 깨진다) 글자 수·알림은 조합이 끝난 뒤에 갱신한다. 조합 중 「적어두고 살기」는 한 박자 뒤 DOM 값을 읽어 마지막 글자가 빠지지 않게 한다. 조합 중 Esc는 무시한다.
 * 두 버튼은 입력 가드(400ms)가 걸린다. 버튼을 눌러도 입력란의 포커스가 풀리지 않게 mousedown 기본 동작을 막는다 — 포커스가 풀리면 compact가 풀려 버튼 자리가 움직이고 눌림이 빗나간다.
 * compact(키보드가 화면을 낮춘 상태)는 포커스가 **입력 영역**(입력란·두 버튼·끄기 칸·확인 단계) 안에 있는 동안 유지한다 — 입력란에서 Tab으로 버튼에 가도 시트가 다시 펼쳐지며 버튼이 밀려나지 않는다(16① 가려진 포커스 0, e2e/m7c-focus-not-obscured.spec.ts가 찾아낸 결함).
 * 저장은 하지 않는다: 부모(App)가 `saveNote`·`dismissNote`·`setNoteCards`를 reducer로 보낸다. 글을 읽는 분기·`console`·로그 없음(S8·P3).
 */

export interface NoteSheetProps {
  via: NoteFocusVia;
  /** 저절로 뜬 카드 (수동 기록이면 null) */
  card: NoteCardDef | null;
  game: LifeGame;
  /** 열 때의 기록 수 (40개에 닿았으면 입력란 대신 안내) */
  count: number;
  /** 자동 기록 카드가 켜져 있는가 (끄기/켜기 칸의 이름) */
  cardsOn: boolean;
  /** 입력 가드 키 — 시트가 새로 뜰 때마다 달라야 한다(결정 시트 직후 더블탭의 둘째 입력이 떨어지지 않게) */
  guardKey: string;
  /** 「1. 적어두고 살기」: 입력란의 값(정리 전) */
  onSave: (text: string) => void;
  /** 「2. 마음속에 담고 살기」(글이 없거나 확인 뒤)·40개 안내의 「닫기」: 자동 카드는 소비하고 수동은 그냥 닫는다 */
  onDismiss: () => void;
  onToggleCards: (on: boolean) => void;
}

const LIMIT = NOTE_LIMITS.graphemes;

interface Msg {
  text: string;
  error: boolean;
}

export function NoteSheet({ via, card, game, count, cardsOn, guardKey, onSave, onDismiss, onToggleCards }: NoteSheetProps) {
  useScrollLock();
  const full = count >= NOTE_LIMITS.total;
  const limit = Math.min(LIMIT, card?.maxLength ?? LIMIT);
  const question = noteQuestion(card, game);
  const heading = full ? NOTE_TEXT.limitTitle : question;
  const year = calendarYear(game.character.birthYear, game.age);
  const cite = card === null ? null : citationFor(card, eraBucketOf(game.generation, year), year);

  const [text, setText] = useState('');
  /** 글자 수·알림의 기준 값 — 조합이 끝난 마지막 값 */
  const [settled, setSettled] = useState('');
  const [msg, setMsg] = useState<Msg>({ text: '', error: false });
  const [invalid, setInvalid] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  /** 포커스가 시트의 입력 영역(입력란·두 버튼·끄기 칸·확인 단계)에 있는가 — compact의 기준 (질문 제목에 있으면 아니다) */
  const [zoneFocused, setZoneFocused] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  const caret = useRef<number | null>(null);
  const vv = useVisualViewport(true);
  /** 전체 시트의 높이와 시트의 최대 높이 — 렌더마다 재서(아래 효과) compact의 기준이 된다 */
  const [fit, setFit] = useState<SheetFit | null>(null);
  const [, setResizeTick] = useState(0);
  const compact = isCompact(zoneFocused, vv, fit);

  /** 시트 안의 포커스 이동 (인생 화면 제목·도구 줄 버튼은 시트 밖이라 LifeScreen이 한다) */
  const focusFor = (moment: NoteFocusMoment) => {
    const target = decideNoteFocus(moment, via);
    if (target === 'title') titleRef.current?.focus({ preventScroll: true });
    else if (target === 'confirmBack') backRef.current?.focus({ preventScroll: true });
    else if (target === 'input') {
      const el = inputRef.current;
      if (el === null) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length); // 캐럿은 글 끝
    }
  };

  // 열릴 때: 질문 제목으로 (입력란이 아니다 — 모바일에서 키보드가 질문을 가리지 않게)
  useEffect(() => {
    focusFor('opened');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열릴 때 한 번
  }, []);

  // 확인 단계가 열리거나 닫힐 때의 포커스 (값이 실제로 바뀐 때만 — 처음 마운트에는, 개발 모드 StrictMode가 효과를 두 번 돌려도 아무것도 하지 않는다)
  const prevConfirm = useRef(confirm);
  useEffect(() => {
    if (prevConfirm.current === confirm) return;
    prevConfirm.current = confirm;
    focusFor(confirm ? 'confirmOpened' : 'confirmBack');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm]);

  // compact의 기준(K2, 마스터 결정): 「전체 시트가 보이는 영역에 들어가는가」. 그리기 전에(깜박임 없이) compact 클래스를 잠깐 걷고 전체 높이를 잰다 — 숨겨진 인용 박스·보조 설명도 포함한 높이다.
  // 렌더마다 돌고(글·알림·확인 단계·글자 크기가 바뀌어도 어긋나지 않게) 값이 바뀐 때만 상태를 갱신하므로 되돌이가 없다
  useIsoLayoutEffect(() => {
    const el = sheetRef.current;
    if (el === null) return;
    const wasCompact = el.classList.contains('sheet--compact');
    if (wasCompact) el.classList.remove('sheet--compact');
    const natural = Math.round(el.scrollHeight + (el.offsetHeight - el.clientHeight));
    const maxPx = parseFloat(getComputedStyle(el).maxHeight);
    if (wasCompact) el.classList.add('sheet--compact');
    const max = Number.isFinite(maxPx) ? Math.round(maxPx) : Number.POSITIVE_INFINITY;
    setFit((prev) => (prev !== null && prev.natural === natural && prev.max === max ? prev : { natural, max }));
  });
  // D-88 후속(CM10): compact에서 질문 줄은 시트 위에 고정(sticky)이라, 포커스가 질문 제목으로 옮겨 가면(Shift+Tab·프로그램 focus()) 브라우저는 이미 보이는 줄로 알고 스크롤하지 않는다. 그런데 제목은 입력 영역이 아니라
  // 곧바로 compact가 풀려 제목이 제자리(안쪽 스크롤 위쪽 밖)로 돌아가므로 — 풀린 직후 제목이 포커스를 가지고 있으면 보이는 자리로 올린다(포커스를 가진 요소가 가려지지 않는다는 기준)
  const wasCompact = useRef(compact);
  useIsoLayoutEffect(() => {
    const was = wasCompact.current;
    wasCompact.current = compact;
    if (was && !compact && titleRef.current !== null && document.activeElement === titleRef.current) titleRef.current.scrollIntoView({ block: 'nearest' });
  }, [compact]);
  // 창 크기·글자 확대로 최대 높이가 바뀌면 다시 잰다
  useEffect(() => {
    const onResize = () => setResizeTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 값이 정리되어 바뀐 경우에만 캐럿을 보정한다 (바뀌지 않은 입력에서는 브라우저가 둔 캐럿 그대로)
  useIsoLayoutEffect(() => {
    if (caret.current === null || inputRef.current === null) return;
    inputRef.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  // K4: 입력란 포커스 때 상자 전체를 보이는 영역에 둔다 — 브라우저는 캐럿만 보이게 스크롤한다. compact(키보드가 화면을 낮춘 상태)면 위쪽 변을 머리 아래에 맞춘다
  const vvHeight = vv === null ? null : vv.height;
  useEffect(() => {
    if (inputFocused) inputRef.current?.scrollIntoView({ block: compact ? 'start' : 'nearest' });
  }, [inputFocused, compact, vvHeight]);

  const rawValue = (): string => inputRef.current?.value ?? text;

  /** 정리된 값을 상태로 (조합 중이 아닐 때) */
  const settle = (raw: string, selStart: number | null) => {
    const next = sanitizeLive(raw, limit);
    setMsg({ text: inputNotice(settled, raw, next, limit), error: false });
    setInvalid(false);
    setText(next);
    setSettled(next);
    if (next !== raw) caret.current = caretAfterSanitize(raw, next, selStart ?? raw.length);
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    if (composing.current) {
      // 조합 중에는 값을 다시 쓰지 않는다(상태 = DOM 값이면 React가 건드리지 않는다). 글자 수·알림은 조합이 끝난 뒤
      setText(raw);
      return;
    }
    settle(raw, e.target.selectionStart);
  };

  const doKeep = () => {
    const raw = rawValue();
    if (decideKeep(raw, limit) === 'empty') {
      // 빈 입력(공백만·보이지 않는 글자만): 기록하지 않고 카드는 열린 채 안내 + 입력란 포커스
      setInvalid(true);
      setMsg({ text: NOTE_TEXT.emptyError, error: true });
      focusFor('emptyError');
      return;
    }
    onSave(raw);
  };
  const onKeep = () => {
    // 조합 중이면 한 박자 뒤 DOM 값을 읽는다 — 마지막 글자가 빠지지 않게
    if (composing.current) window.setTimeout(doKeep, 0);
    else doKeep();
  };

  const pressSkip = () => {
    // 글이 없거나 40개 안내 상태면 확인 없이 닫고, 글이 있으면 확인 단계 (decideSkip)
    if (decideSkip(rawValue(), full, limit) === 'dismiss') return onDismiss();
    setConfirm(true);
  };

  // Esc = 「마음속에 담고 살기」와 같다(글이 있으면 같은 확인), 확인 단계에서는 돌아가기. IME 조합 중에는 무시(조합 취소가 시트를 닫지 않게). 최신 상태는 ref로 읽는다
  const keyRef = useRef({ confirm, full, pressSkip });
  keyRef.current = { confirm, full, pressSkip };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = decideEsc({ key: e.key, isComposing: e.isComposing, composing: composing.current, handled: e.defaultPrevented, confirm: keyRef.current.confirm });
      if (action === 'ignore') return;
      e.preventDefault();
      if (action === 'back') setConfirm(false);
      else keyRef.current.pressSkip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleCards = () => {
    const next = !cardsOn;
    onToggleCards(next);
    setNotice(next ? NOTE_TEXT.cardsOnNotice : NOTE_TEXT.cardsOffNotice);
  };

  // 버튼을 마우스·터치로 눌러도 입력란 포커스가 풀리지 않게 (포커스가 풀리면 compact가 풀려 버튼 자리가 움직인다)
  const keepFocus = (e: MouseEvent<HTMLElement>) => e.preventDefault();
  // compact는 **입력 영역 안에서 포커스가 옮겨 다니는 동안** 유지한다 — 입력란에서 Tab으로 「적어두고 살기」로 가면 입력란이 포커스를 잃지만 시트가 다시 펼쳐져 버튼이 밀려나면 안 된다(16① 가려진 포커스 0).
  // 영역 밖(질문 제목·시트 밖·아무 곳도 아님)으로 포커스가 가면 풀린다 (K6)
  const onZoneFocus = (e: FocusEvent<HTMLDivElement>) => setZoneFocused(e.target !== titleRef.current);
  const onZoneBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    setZoneFocused(next !== null && sheetRef.current !== null && sheetRef.current.contains(next) && next !== titleRef.current);
  };

  const n = liveGraphemes(settled, limit);
  const vvStyle = vv === null ? undefined : ({ '--vv-h': `${vv.height}px`, '--vv-top': `${vv.offsetTop}px` } as CSSProperties);
  const describedBy = invalid ? 'note-hint note-count-sr note-msg' : 'note-hint note-count-sr';

  return (
    <div className="overlay" style={vvStyle} data-testid="note-overlay">
      <div
        ref={sheetRef}
        onFocus={onZoneFocus}
        onBlur={onZoneBlur}
        className={`sheet sheet--note${compact ? ' sheet--compact' : ''}${full ? ' sheet--limit' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nc-kind nc-title"
        data-testid="note-sheet"
        data-via={via}
        data-card={card === null ? 'manual' : card.id}
        data-compact={compact ? 'true' : 'false'}
      >
        <div className="sheet__head">
          <span className="sheet__kind sheet__kind--note" id="nc-kind">
            {NOTE_TEXT.kind}
          </span>
          <span className="sheet__age" data-testid="note-when">
            <FitPair a={`${year}년`} b={`${game.age}세`} hideSeparator />
          </span>
        </div>
        <div className="sheet__body">
          <h2 id="nc-title" className="sheet__title" ref={titleRef} tabIndex={-1} style={{ '--title-chars': titleCharsFor(heading) } as CSSProperties} data-testid="note-title">
            {heading}
          </h2>
          {full ? (
            <>
              <p className="sheet__sub" data-testid="note-limit-sub">
                {NOTE_TEXT.limitSub}
              </p>
              <div className="sheet__foot">
                <GuardedButton guardKey={guardKey} className="btn btn--primary" data-testid="note-limit-close" onClick={onDismiss}>
                  {NOTE_TEXT.close}
                </GuardedButton>
              </div>
            </>
          ) : (
            <>
              {cite !== null ? <CitationBox view={cite} /> : null}
              <div className="field">
                <label className="sr-only" htmlFor="note-input">
                  {NOTE_TEXT.inputLabel}
                </label>
                <textarea
                  id="note-input"
                  ref={inputRef}
                  className="field__input"
                  rows={3}
                  dir="auto"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={4000}
                  data-user-text=""
                  data-testid="note-input"
                  aria-describedby={describedBy}
                  aria-invalid={invalid ? true : undefined}
                  readOnly={confirm}
                  value={text}
                  onChange={onChange}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onCompositionStart={() => {
                    composing.current = true;
                  }}
                  onCompositionEnd={(e) => {
                    composing.current = false;
                    settle(e.currentTarget.value, e.currentTarget.selectionStart);
                  }}
                />
                <div className="field__hint">
                  <span id="note-hint" data-testid="note-hint">
                    <Glue text={NOTE_TEXT.hint} />
                  </span>
                  <span className="field__count" aria-hidden="true" data-testid="note-count">
                    {NOTE_TEXT.count(n, limit)}
                  </span>
                  <span id="note-count-sr" className="sr-only" data-testid="note-count-sr">
                    {NOTE_TEXT.countSr(n, limit)}
                  </span>
                </div>
                <p id="note-msg" className={`field__msg${msg.error ? ' field__msg--error' : ''}`} role="status" aria-live="polite" data-testid="note-msg">
                  {msg.text}
                </p>
              </div>
              {confirm ? (
                <div className="note-confirm" role="group" aria-labelledby="nc-confirm-t" data-testid="note-confirm">
                  <p id="nc-confirm-t" className="note-confirm__title" role="alert">
                    {NOTE_TEXT.confirmTitle}
                  </p>
                  <p className="note-confirm__sub">{NOTE_TEXT.confirmSub}</p>
                  <div className="note-confirm__actions">
                    <GuardedButton guardKey={`${guardKey}#confirm`} className="btn btn--secondary" data-testid="note-confirm-discard" onClick={onDismiss}>
                      {NOTE_TEXT.confirmDiscard}
                    </GuardedButton>
                    <GuardedButton ref={backRef} guardKey={`${guardKey}#confirm`} className="btn btn--primary" data-testid="note-confirm-back" onClick={() => setConfirm(false)}>
                      {NOTE_TEXT.confirmBack}
                    </GuardedButton>
                  </div>
                </div>
              ) : (
                <>
                  <div className="note-choices">
                    <GuardedButton guardKey={guardKey} className="note-choice note-choice--primary" data-testid="note-save" aria-labelledby="nc-keep" aria-describedby="nc-keep-sub" onMouseDown={keepFocus} onClick={onKeep}>
                      <span className="note-choice__top">
                        <span className="choice__no" aria-hidden="true">
                          1
                        </span>
                        <span id="nc-keep">{NOTE_TEXT.keep}</span>
                      </span>
                      <span className="note-choice__sub" id="nc-keep-sub">
                        {NOTE_TEXT.keepSub}
                      </span>
                    </GuardedButton>
                    <GuardedButton guardKey={guardKey} className="note-choice" data-testid="note-skip" aria-labelledby="nc-skip" aria-describedby="nc-skip-sub" onMouseDown={keepFocus} onClick={pressSkip}>
                      <span className="note-choice__top">
                        <span className="choice__no" aria-hidden="true">
                          2
                        </span>
                        <span id="nc-skip">{NOTE_TEXT.skip}</span>
                      </span>
                      <span className="note-choice__sub" id="nc-skip-sub">
                        {NOTE_TEXT.skipSub}
                      </span>
                    </GuardedButton>
                  </div>
                  <div className="sheet__foot">
                    <p className="sheet__notice" role="status" data-testid="note-notice">
                      {notice}
                    </p>
                    <button type="button" className="btn btn--ghost btn--sm" data-testid="note-cards-toggle" onMouseDown={keepFocus} onClick={toggleCards}>
                      {cardsOn ? NOTE_TEXT.cardsOff : NOTE_TEXT.cardsOn}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
