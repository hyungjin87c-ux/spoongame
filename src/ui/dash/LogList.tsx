import { Component, createRef, type MutableRefObject, type ReactNode, type RefObject, type UIEventHandler } from 'react';
import { DASH_TEXT } from '../../data/dashText';
import { revealTopOfTallFocus } from '../focusReveal';
import { NoteBody } from './NoteText';
import { addedAbove, isAtLogTop, resizePlan, scrollPlan, type LogRow } from './logOrder';

/**
 * 인생 기록의 스크롤 영역과 줄들 (SPEC-005 LR1·LR2·LR4·LR7). `LogCard`가 머리·고정 줄·「새 기록 N개」 버튼을 맡고, 이 컴포넌트는 **줄이 위에 쌓일 때 보던 줄이 움직이지 않게 하는 일**을 맡는다.
 *
 * 클래스 컴포넌트인 까닭: 위치 보정에는 **DOM이 바뀌기 직전의 모습**(보던 줄이 어느 줄이고 영역 윗변에서 얼마나 떨어져 있었는지)이 필요한데, 함수 컴포넌트에는 React가 그 순간을 주는 길(`getSnapshotBeforeUpdate`)이 없다.
 * 렌더 중에 DOM을 읽는 꼼수 대신 React가 이 용도로 만든 길을 쓴다.
 *
 * 보정 방법 — 줄의 높이를 더하지 않고 **보던 줄이 실제로 얼마나 밀렸는지** 잰다: 업데이트 직전에 영역 안에서 보이는 첫 줄(윗변이 영역 윗변 아래에 걸친 줄)과 영역 윗변에서의 거리를 기억해 두고,
 * 업데이트 직후 같은 줄(키로 찾는다)의 거리를 다시 재서 달라진 만큼 스크롤 위치를 옮긴다. 쌓인 줄의 높이만 더하는 방식은 가장 최근이던 줄이 굵은 글씨를 잃으며 줄바꿈이 바뀌는 것(`log__row--latest`)을
 * 놓쳐 한 줄만큼 어긋났다. 브라우저의 `overflow-anchor`는 WebKit이 구현하지 않고 켜 두면 이 보정과 겹쳐 두 번 움직이므로 CSS에서 끄고(`.log__list { overflow-anchor: none }`) 여기서만 한다.
 * 맨 위를 보고 있었으면(또는 「맨 위로」를 누른 직후면) 보정 대신 맨 위(0)에 머문다 = 새 줄이 바로 보인다.
 *
 * 줄이 **다시 흐를 때**(창 크기·글자 크기·화면 회전)도 같은 방식으로 보던 자리를 지킨다 (R-439) — `overflow-anchor: none`으로 끈 브라우저 스크롤 고정이 해 주던 일이다.
 * 스크롤할 때마다 보던 줄(키)과 영역 윗변에서의 거리를 기억해 두고(`place`), 영역·목록의 크기가 바뀌면(`ResizeObserver`) 같은 줄의 거리가 기억한 값과 같아지게 스크롤 위치를 옮긴다.
 * 기억한 위치가 맨 위(≤ 24px)였으면 옮기지 않는다. 새 줄 보정과 겹쳐도 한 번만 움직인다 — 새 줄 보정이 끝나면 자리를 새로 기억하므로 뒤따르는 관찰자는 어긋남 0을 보고 가만히 있고,
 * 줄이 다시 흐른 직후(관찰자가 돌기 전)에 새 줄이 오면 기억한 자리(흐르기 전에 본 모습)를 기준으로 삼아 한 번에 간다.
 */

interface Props {
  rows: readonly LogRow[];
  /**
   * 「새 기록 N개 · 맨 위로」 알약 (R-438, docs/design/log-order-qi1.md). 상태(`unread`)와 동작은 `LogCard`가 갖고 이 컴포넌트는 **자리**만 준다:
   * 스크롤 영역 안, 줄 목록(`ol`) 앞의 **높이 0 sticky 슬롯** — 알약이 영역 위 가장자리(새 줄이 쌓이는 쪽)에 떠 있고, 나타나고 사라져도 줄이 밀리지 않는다.
   * 위치 보정은 `ol.children`만 읽으므로 슬롯과 무관하다. 알약은 `ol`(live region) 밖이다 — 개수가 바뀔 때마다 읽히지 않는다.
   */
  jump?: ReactNode;
  /** 새 줄 알림(aria-live)을 켤 것인가 — 빠른 진행·자동 모드에서는 끈다 */
  live: boolean;
  /** 스크롤 영역(`LogCard`가 「맨 위로」 이동에 쓴다) */
  scrollerRef: RefObject<HTMLDivElement>;
  /** 「맨 위로」를 누른 직후 부드럽게 올라가는 중인가 */
  following: MutableRefObject<boolean>;
  onScroll: UIEventHandler<HTMLDivElement>;
  /** 사용자가 직접 스크롤하기 시작함(휠·터치·포인터·키보드) */
  onUserScroll: () => void;
  /** 아래에서 읽는 중에 새 줄이 위에 쌓였다 — 보던 자리를 지켰고, 쌓인 줄 수를 알린다 */
  onUnread: (added: number) => void;
  /** 다른 판의 기록으로 바뀌어 맨 위에서 다시 시작했다 */
  onReset: () => void;
}

interface Snapshot {
  /** 업데이트 직전의 맨 위(가장 최근) 줄 키 */
  newestBefore: string | null;
  scrollTop: number;
  /** 업데이트 직전에 영역 안에서 보이던 첫 줄의 키와 영역 윗변에서의 거리(px, 윗변이 영역 위로 넘어 있으면 음수) */
  anchorKey: string | null;
  anchorOffset: number;
}

/** 마지막으로 기억한 「보던 자리」 — 스크롤할 때마다 새로 기억한다. 크기가 달라졌으면 줄이 다시 흐른 것이다 */
interface Place {
  /** 영역 안에서 보이는 첫 줄의 키(없으면 null) */
  key: string | null;
  /** 그 줄의 윗변이 영역 윗변에서 떨어진 거리(px) */
  offset: number;
  scrollTop: number;
  /** 기억할 때의 영역 안쪽 폭·높이와 목록 높이 */
  width: number;
  height: number;
  content: number;
}

export class LogList extends Component<Props, Record<string, never>, Snapshot | null> {
  private readonly olRef = createRef<HTMLOListElement>();
  private place: Place | null = null;
  private observer: ResizeObserver | null = null;

  componentDidMount(): void {
    const el = this.props.scrollerRef.current;
    const ol = this.olRef.current;
    if (el === null || ol === null) return;
    this.remember(this.props.rows);
    if (typeof ResizeObserver === 'undefined') return;
    // 영역(폭·높이)과 목록(내용 높이)을 함께 본다: 글자 크기·폭 변화는 줄바꿈을 바꿔 목록 높이를 바꾸고, 화면 회전·창 크기는 영역 크기를 바꾼다
    this.observer = new ResizeObserver(() => this.realign(this.props.rows));
    this.observer.observe(el);
    this.observer.observe(ol);
  }

  componentWillUnmount(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private dims(el: HTMLElement, ol: HTMLElement): Pick<Place, 'width' | 'height' | 'content'> {
    return { width: el.clientWidth, height: el.clientHeight, content: ol.offsetHeight };
  }

  /** 영역 안에서 보이는 첫 줄(아랫변이 영역 윗변 아래인 첫 줄)과 영역 윗변에서의 거리. `rows`는 지금 DOM에 있는 줄들이다. 줄은 위에서 아래로 놓여 이진 탐색이 맞다 */
  private firstSeen(rows: readonly LogRow[], el: HTMLElement, ol: HTMLElement): { key: string; offset: number } | null {
    const top = el.getBoundingClientRect().top;
    const count = Math.min(ol.children.length, rows.length);
    let lo = 0;
    let hi = count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ol.children[mid].getBoundingClientRect().bottom > top + 0.5) hi = mid;
      else lo = mid + 1;
    }
    if (lo >= count) return null;
    return { key: rows[lo].key, offset: ol.children[lo].getBoundingClientRect().top - top };
  }

  /** 지금 모습을 「보던 자리」로 기억한다 */
  private remember(rows: readonly LogRow[]): void {
    const el = this.props.scrollerRef.current;
    const ol = this.olRef.current;
    if (el === null || ol === null) return;
    const seen = this.firstSeen(rows, el, ol);
    this.place = { key: seen?.key ?? null, offset: seen?.offset ?? 0, scrollTop: el.scrollTop, ...this.dims(el, ol) };
  }

  /** 기억한 뒤로 영역이나 목록의 크기가 달라졌는가 — 줄이 다시 흘렀다(관찰자가 곧 되맞춘다) */
  private reflowed(el: HTMLElement, ol: HTMLElement, was: Place): boolean {
    const d = this.dims(el, ol);
    return d.width !== was.width || d.height !== was.height || d.content !== was.content;
  }

  /**
   * 줄이 다시 흐른 뒤 기억한 줄을 기억한 거리에 되돌려 놓는다 (R-439). 기억한 위치가 맨 위였거나 「맨 위로」가 올라가는 중이면 건드리지 않고 지금 모습을 새로 기억한다.
   * 되맞춘 뒤에는 줄과 거리는 **기억한 그대로** 두고 위치·크기만 갱신한다 — 창 크기를 끌며 줄이는 동안 반올림 오차가 쌓여 자리가 흘러가지 않는다.
   */
  private realign(rows: readonly LogRow[]): void {
    const el = this.props.scrollerRef.current;
    const ol = this.olRef.current;
    if (el === null || ol === null) return;
    const was = this.place;
    const follow = this.props.following.current;
    const at = was === null || was.key === null ? -1 : rows.findIndex((r) => r.key === was.key);
    const row = at === -1 ? undefined : ol.children[at];
    // 되맞출 자리가 없다: 기억이 없거나, 기억한 줄이 지워졌거나, 맨 위(≤ 24px)였거나, 「맨 위로」가 올라가는 중이다 — 지금 모습을 새로 기억한다
    if (was === null || row === undefined || follow || isAtLogTop(was.scrollTop)) {
      this.remember(rows);
      return;
    }
    const shift = row.getBoundingClientRect().top - el.getBoundingClientRect().top - was.offset;
    const top = resizePlan({ rememberedScrollTop: was.scrollTop, scrollTop: el.scrollTop, shift, follow });
    // 부드러운 스크롤(CSS scroll-behavior)이 되맞춤을 미끄러뜨리지 않게 늘 behavior: 'instant'
    if (top !== null) el.scrollTo({ top, behavior: 'instant' });
    this.place = { ...was, scrollTop: el.scrollTop, ...this.dims(el, ol) };
  }

  private readonly handleScroll: UIEventHandler<HTMLDivElement> = (e) => {
    this.props.onScroll(e);
    const el = e.currentTarget;
    const ol = this.olRef.current;
    if (ol === null) return;
    const was = this.place;
    if (was !== null) {
      // 줄이 다시 흐른 직후의 스크롤(브라우저가 범위를 넘은 위치를 끌어당긴 것 등)은 사용자가 한 스크롤이 아니다 — 관찰자와 같이 되맞춘다
      if (this.reflowed(el, ol, was)) {
        this.realign(this.props.rows);
        return;
      }
      // 우리 되맞춤·보정이 낳은 스크롤 이벤트: 위치가 기억과 같으면 새로 기억할 것이 없다(기억한 거리를 그대로 지킨다)
      if (Math.abs(el.scrollTop - was.scrollTop) < 0.5) return;
    }
    this.remember(this.props.rows);
  };

  getSnapshotBeforeUpdate(prev: Props): Snapshot | null {
    if (prev.rows === this.props.rows) return null;
    const newestBefore = prev.rows[0]?.key ?? null;
    if (newestBefore === (this.props.rows[0]?.key ?? null)) return null; // 맨 위 줄이 그대로 — 위에 쌓인 줄이 없다
    const el = this.props.scrollerRef.current;
    const ol = this.olRef.current;
    if (el === null || ol === null) return null;
    // 줄이 다시 흐른 직후라 관찰자가 아직 돌기 전이면(창 크기·글자 크기 변화와 새 줄이 겹침) 지금 DOM은 이미 어긋나 있다 — 기억해 둔 자리(흐르기 전에 본 모습)를 기준으로 삼으면
    // 아래 보정이 흐름의 어긋남까지 한 번에 되돌린다(스크롤을 두 번 하지 않는다)
    const was = this.place;
    if (was !== null && was.key !== null && prev.rows.some((r) => r.key === was.key) && this.reflowed(el, ol, was)) {
      return { newestBefore, scrollTop: el.scrollTop, anchorKey: was.key, anchorOffset: was.offset };
    }
    const seen = this.firstSeen(prev.rows, el, ol);
    return { newestBefore, scrollTop: el.scrollTop, anchorKey: seen?.key ?? null, anchorOffset: seen?.offset ?? 0 };
  }

  componentDidUpdate(_prev: Props, _state: Record<string, never>, snap: Snapshot | null): void {
    if (snap === null) return;
    const { rows, scrollerRef, following, onUnread, onReset } = this.props;
    const el = scrollerRef.current;
    const ol = this.olRef.current;
    if (el === null || ol === null) return;
    const added = addedAbove(rows, snap.newestBefore);
    if (added === null) {
      // 지난 맨 위 줄이 없다: 다른 판의 기록으로 바뀌었다 — 맨 위(가장 최근)에서 다시 시작한다
      following.current = false;
      onReset();
      el.scrollTo({ top: 0, behavior: 'instant' });
      this.remember(rows);
      return;
    }
    if (added <= 0) return;
    const box = el.getBoundingClientRect();
    const at = snap.anchorKey === null ? -1 : rows.findIndex((r) => r.key === snap.anchorKey);
    const anchor = at === -1 ? undefined : ol.children[at];
    // 보던 줄이 밀린 거리. 보던 줄이 상한으로 지워졌으면(맨 아래를 읽던 경우) 쌓인 줄들의 높이로 갈음한다
    const shift =
      anchor !== undefined
        ? anchor.getBoundingClientRect().top - box.top - snap.anchorOffset
        : (ol.children[added]?.getBoundingClientRect().top ?? 0) - (ol.children[0]?.getBoundingClientRect().top ?? 0);
    const plan = scrollPlan({ scrollTop: snap.scrollTop, shift, added, follow: following.current });
    // 부드러운 스크롤(CSS scroll-behavior)이 보정을 미끄러뜨리지 않게 늘 behavior: 'instant'
    if (Math.abs(plan.top - el.scrollTop) >= 0.5) el.scrollTo({ top: plan.top, behavior: 'instant' });
    if (plan.unread > 0) onUnread(plan.unread);
    // 보정한 모습을 새 「보던 자리」로 기억한다 — 줄이 늘어 목록 높이가 바뀌었다고 곧 도는 관찰자는 어긋남 0을 보고 가만히 있는다(한 번만 움직인다)
    this.remember(rows);
  }

  render() {
    const { rows, live, jump, scrollerRef, onUserScroll } = this.props;
    return (
      <div
        className="log__list"
        ref={scrollerRef}
        onScroll={this.handleScroll}
        onWheel={onUserScroll}
        onTouchStart={onUserScroll}
        onPointerDown={onUserScroll}
        onKeyDown={onUserScroll}
        onFocus={(e) => revealTopOfTallFocus(e.currentTarget)}
        role="region"
        aria-label={DASH_TEXT.logTitle}
        aria-describedby="log-hint"
        tabIndex={0}
        data-testid="log-list"
      >
        {jump ? <div className="log__jump-slot">{jump}</div> : null}
        <ol aria-live={live ? 'polite' : 'off'} aria-relevant="additions" className="log__rows" ref={this.olRef}>
          {rows.map(({ entry: h, key, latest }) => (
            <li
              key={key}
              className={`log__row${h.kind === 'stage' ? ' log__row--stage' : ''}${h.kind === 'note' ? ' log__row--note' : ''}${latest ? ' log__row--latest' : ''}`}
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
    );
  }
}
