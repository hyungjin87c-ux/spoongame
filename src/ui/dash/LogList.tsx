import { Component, createRef, type MutableRefObject, type RefObject, type UIEventHandler } from 'react';
import { DASH_TEXT } from '../../data/dashText';
import { revealTopOfTallFocus } from '../focusReveal';
import { NoteBody } from './NoteText';
import { addedAbove, scrollPlan, type LogRow } from './logOrder';

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
 */

interface Props {
  rows: readonly LogRow[];
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

export class LogList extends Component<Props, Record<string, never>, Snapshot | null> {
  private readonly olRef = createRef<HTMLOListElement>();

  getSnapshotBeforeUpdate(prev: Props): Snapshot | null {
    if (prev.rows === this.props.rows) return null;
    const newestBefore = prev.rows[0]?.key ?? null;
    if (newestBefore === (this.props.rows[0]?.key ?? null)) return null; // 맨 위 줄이 그대로 — 위에 쌓인 줄이 없다
    const el = this.props.scrollerRef.current;
    const ol = this.olRef.current;
    if (el === null || ol === null) return null;
    const box = el.getBoundingClientRect();
    let anchorKey: string | null = null;
    let anchorOffset = 0;
    for (let i = 0; i < ol.children.length && i < prev.rows.length; i++) {
      const r = ol.children[i].getBoundingClientRect();
      if (r.bottom > box.top + 0.5) {
        anchorKey = prev.rows[i].key;
        anchorOffset = r.top - box.top;
        break;
      }
    }
    return { newestBefore, scrollTop: el.scrollTop, anchorKey, anchorOffset };
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
  }

  render() {
    const { rows, live, scrollerRef, onScroll, onUserScroll } = this.props;
    return (
      <div
        className="log__list"
        ref={scrollerRef}
        onScroll={onScroll}
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
