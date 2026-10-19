import { useEffect, useRef, useState } from 'react';
import { formatCount } from '../../core/format';
import { tryVirtualPopulation } from '../../core/population';
import type { HistoryEntry } from '../../core/types';
import { DASH_TEXT } from '../../data/dashText';
import { FitPair } from '../FitPair';
import { Glue } from '../Glue';
import { revealTopOfTallFocus } from '../focusReveal';
import { useEpochMinute, useIsoLayoutEffect, useReducedMotion } from '../hooks';
import { NoteBody } from './NoteText';

/**
 * 인생 기록 카드 (SPEC-003 DB12·DB14): 가운데 영역에 **한 줄씩 쌓이고** 영역 안에서 스크롤된다.
 *  - 새 줄은 맨 아래에 붙고, 맨 아래를 보고 있는 동안은 자동으로 맨 아래로 따라간다. 사용자가 위로 스크롤하면 자동 이동을 멈추고 「새 기록 N개 · 맨 아래로」 버튼이 뜬다(누르면 맨 아래로, 개수는 0).
 *  - 줄 형식 「{나이}세 {문장}」, 종류: 단계(출생 포함, 아래 선) / 사건 / 선택 결과(「선택: …」) / (나의 기록 — 자유 기록 M7c) / 사망. 마지막 줄은 굵게.
 *  - 맨 위 고정 줄(DB14): 「이 세상의 가상 인구 {N}명 · {이름}도 그중 한 사람」 — 쌓이는 기록과 구분되는 띠. N은 첫 화면과 같은 가상 인구 함수(core/population.ts)이고 시각은 UI가 분 단위로 넘긴다.
 *    짧은 쌍이라 `FitPair`(한 줄에 안 들어가면 기호 없이 두 줄). 근거 통계를 읽을 수 없으면 이 줄만 빠진다(R-211).
 *  - 스크롤 영역은 키보드로 닿을 수 있다(tabindex 0 + 이름) — 방향키·PageUp/Down으로 지난 기록을 읽는다. 영역(최대 520px)이 가용 높이(화면 − 고정 머리 − 진행 줄)보다 크면 키보드 포커스를 받을 때 위쪽 변이 머리 밑에 오게 맞춘다(CM10 예외 ②).
 */

/** 맨 아래로 보는 범위(px): 이 안이면 맨 아래를 보고 있는 것으로 본다 */
export const LOG_BOTTOM_SLACK = 24;

export function LogCard({ history, name, live, minute }: { history: readonly HistoryEntry[]; name: string; live: boolean; minute?: number }) {
  const listRef = useRef<HTMLDivElement>(null);
  /** 맨 아래를 보고 있는가 (스크롤 이벤트가 갱신) */
  const stuck = useRef(true);
  const seen = useRef(history.length);
  /** 마지막으로 본 영역 높이 — 높이가 바뀌어서 생긴 스크롤 이벤트를 사용자가 올려 읽은 것으로 착각하지 않는다 */
  const lastHeight = useRef(0);
  const [unread, setUnread] = useState(0);
  const clock = useEpochMinute();
  const reduced = useReducedMotion();
  const population = tryVirtualPopulation(minute ?? clock);

  const toBottom = (smooth: boolean) => {
    const el = listRef.current;
    if (el === null) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced ? 'smooth' : 'instant' });
  };

  // 화면이 막 떴을 때(새로고침 복원 포함): 맨 아래(가장 최근)에서 시작한다
  useIsoLayoutEffect(() => {
    lastHeight.current = listRef.current?.clientHeight ?? 0;
    toBottom(false);
  }, []);

  // 새 줄: 맨 아래를 보고 있으면 따라가고, 아니면 개수만 센다
  useIsoLayoutEffect(() => {
    const added = history.length - seen.current;
    seen.current = history.length;
    if (added <= 0) return;
    if (stuck.current) toBottom(false);
    else setUnread((n) => n + added);
  }, [history.length]);

  // 영역 크기가 바뀌어도(고정 요소 높이·글자 크기·창 크기 변화로 영역 높이 상한이 달라진다) 맨 아래를 보고 있었다면 맨 아래에 머문다 — 처음 맞춘 뒤 영역이 줄어 바닥에서 떨어지는 일을 막는다
  useEffect(() => {
    const el = listRef.current;
    if (el === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      lastHeight.current = el.clientHeight;
      if (stuck.current) toBottom(false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onScroll = () => {
    const el = listRef.current;
    if (el === null) return;
    if (el.clientHeight !== lastHeight.current) {
      // 영역 높이가 바뀌며(고정 요소 높이 변수가 정해지는 순간 등) 생긴 스크롤이다 — 사용자가 올려 읽은 것이 아니다. 맨 아래를 보고 있었다면 그대로 맨 아래에 둔다.
      lastHeight.current = el.clientHeight;
      if (stuck.current) toBottom(false);
      return;
    }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= LOG_BOTTOM_SLACK;
    stuck.current = atBottom;
    if (atBottom && unread > 0) setUnread(0);
  };

  const jump = () => {
    stuck.current = true;
    setUnread(0);
    toBottom(true);
  };

  return (
    <section className="card log" aria-labelledby="log-t" data-testid="log">
      <div className="card__head card__head--tight">
        <h2 id="log-t" className="card__title">
          {DASH_TEXT.logTitle}
        </h2>
        <span className="t-xs t-faint">
          <Glue text={DASH_TEXT.logHint} />
        </span>
      </div>
      {population === null ? null : (
        <p className="log__pin" data-testid="log-pin">
          <FitPair a={DASH_TEXT.logPinA(formatCount(population))} b={DASH_TEXT.logPinB(name)} />
        </p>
      )}
      <div className="log__list" ref={listRef} onScroll={onScroll} onFocus={(e) => revealTopOfTallFocus(e.currentTarget)} role="region" aria-label={DASH_TEXT.logTitle} tabIndex={0} data-testid="log-list">
        <ol aria-live={live ? 'polite' : 'off'} aria-relevant="additions" className="log__rows">
          {history.map((h, i) => (
            <li
              key={`${i}-${h.age}-${h.kind}`}
              className={`log__row${h.kind === 'stage' ? ' log__row--stage' : ''}${h.kind === 'note' ? ' log__row--note' : ''}${i === history.length - 1 ? ' log__row--latest' : ''}`}
              data-kind={h.kind}
              data-testid="log-row"
            >
              <span className="log__age">
                {h.age}
                {DASH_TEXT.ageSuffix}
              </span>
              <span className="log__text">
                {h.kind === 'note' ? (
                  // 「나의 기록」 줄(M7c): 라벨 + 사용자 글 — 엔딩 연표와 같은 부품(NoteBody)
                  <NoteBody entry={h} />
                ) : (
                  <>
                    {h.text}
                    {h.choice ? (
                      <>
                        {' '}
                        <em>
                          ({DASH_TEXT.logChoicePrefix}
                          {h.choice})
                        </em>
                      </>
                    ) : null}
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {unread > 0 ? (
        <button type="button" className="btn btn--secondary btn--sm log__jump" onClick={jump} data-testid="log-jump">
          <Glue text={DASH_TEXT.logJump(unread)} />
        </button>
      ) : null}
    </section>
  );
}
