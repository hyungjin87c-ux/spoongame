import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import type { EndingGame, EraWindow } from '../core';
import { titleCharsFor } from '../data/dashText';
import { CREDITS_ENTRY_TEXT } from '../data/endingText';
import { VEIL_TEXT, veilButtonLabel } from '../data/gentleText';
import { TITLE_TEXT } from '../data/titleText';
import { FitPair } from '../ui/FitPair';
import { Glue } from '../ui/Glue';
import { useBottomBar } from '../ui/useBottomBar';
import { useInfoPanelHistory } from '../ui/infoPanelHistory';
import { useVeilOpen } from '../ui/dash/Veil';
import '../styles/credits.css';
import { creditsModelOf, type CreditsRecord } from './model';
import { CREDITS_TEXT } from './text';
import { creditsLength } from './timing';
import { useCreditsFlow } from './useCreditsFlow';

/**
 * 「이 삶의 이름들」 열린 화면 (SPEC-022 EC1, docs/design/design-system.md 21절 · copy.md 22절). 회고(`EndingScreen`)가 버튼을 누른 뒤 `import()`로 받는 지연 덩어리다 —
 * 이 파일과 줄 모델·허용 목록·`credits.css`가 한 덩어리이고, `EndingScreen`은 정적으로 따라오지 않는다(`loader.ts`가 부른다).
 * 한 개의 안정된 문서로 읽힌다(제목 → 가족 → 선택 → 시대 → 끝). 줄마다 `aria-live`를 쓰지 않고 시각 연출용 글을 복제하지 않는다. 가림 줄의 닫힌 원문은 DOM에 만들지 않는다(`VeiledText`를 쓰지 않는다).
 * 닫는 길 넷(단추·Escape·뒤로가기·헤더 로고)은 모두 `requestClose` 하나로 모여 history 한 걸음을 되돌린다(`ui/infoPanelHistory.ts`). 자기 오류 경계가 있어 줄 모델·렌더 예외는 최상위 `ErrorBoundary`로 올라가지 않는다.
 * 새 저장 필드·RNG·소리·외부 요청이 없다 — 보기 상태·재생 위치·정지·펼침은 UI 메모리뿐이다.
 */

export interface CreditsScreenProps {
  game: EndingGame;
  /** 현재 「무거운 장면 가리기」 설정 */
  gentle: boolean;
  /** 받아 둔 시대의 창 덩어리의 합 */
  windows: readonly EraWindow[];
  /** 이 화면이 닫혔다(어느 길로든 — history 항목은 이미 되돌려졌다) */
  onClosed: () => void;
  /** 헤더 로고가 닫을 때 부르는 「닫기 요청」을 여기에 담아 준다 */
  closeRef: MutableRefObject<(() => void) | null>;
  /** 개발 서버 전용 탐침(`?__creditsThrow`) — App.tsx가 읽어 넘긴다. 참이면 줄 모델 계산이 예외를 던진다 */
  probeThrow?: boolean;
}

interface BoundaryProps {
  onClose: () => void;
  children: ReactNode;
}

/** 이 화면 영역의 자기 오류 경계: 줄 모델 계산·렌더 예외도 로드 실패와 같은 문구 + 다시 시도 + 기록으로 돌아가기 */
class CreditsBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="credits-fail" data-testid="credits-fail">
        <h1 className="credits-fail-title" tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })}>
          {CREDITS_ENTRY_TEXT.title}
        </h1>
        <p role="alert">{CREDITS_ENTRY_TEXT.fail}</p>
        <div className="credits-fail-actions">
          <button type="button" className="btn btn--primary" data-testid="credits-retry" onClick={this.retry}>
            {TITLE_TEXT.loadRetry}
          </button>
          <button type="button" className="btn btn--secondary" data-testid="credits-fail-close" onClick={this.props.onClose}>
            {CREDITS_TEXT.close}
          </button>
        </div>
      </div>
    );
  }
}

function Record({ rec, kind, onToggle }: { rec: CreditsRecord; kind: 'choice' | 'era'; onToggle: (id: string) => void }) {
  const veil = rec.veil;
  const bodyId = veil === null ? undefined : `${veil.id}-body`;
  const body =
    kind === 'choice' ? (
      <>
        {rec.question === undefined ? null : <h3 className="credits-q">{rec.question}</h3>}
        {rec.pick === undefined ? null : (
          <p className="credits-pick">
            <Glue text={rec.pick} />
          </p>
        )}
        {rec.result === undefined ? null : <p className="credits-result">{rec.result}</p>}
      </>
    ) : rec.line === undefined ? null : (
      <p className="credits-result">{rec.line}</p>
    );
  return (
    <article className="credits-record" data-veiled={veil === null ? undefined : 'true'} data-testid="credits-record">
      <p className="credits-meta">
        <Glue text={rec.stageLine} />
      </p>
      {rec.byLine === undefined ? null : <p className="credits-meta">{rec.byLine}</p>}
      {veil === null ? (
        body
      ) : (
        <>
          <div className="credits-veil">
            <p className="credits-veil-lead">
              <FitPair a={VEIL_TEXT.rowLead} b={veil.kindName} hideSeparator />
            </p>
            <button
              type="button"
              className="btn btn--ghost btn--sm credits-veil-btn"
              aria-expanded={veil.open}
              aria-controls={veil.open ? bodyId : undefined}
              aria-label={veilButtonLabel(veil.open, veil.age, veil.kindName)}
              data-testid="credits-veil-btn"
              onClick={() => onToggle(veil.id)}
            >
              {veil.open ? VEIL_TEXT.close : VEIL_TEXT.open} <span aria-hidden="true">{veil.open ? VEIL_TEXT.markClose : VEIL_TEXT.markOpen}</span>
            </button>
          </div>
          {veil.open ? (
            <div className="credits-veil-body" id={bodyId}>
              {body}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

interface ViewProps {
  game: EndingGame;
  gentle: boolean;
  windows: readonly EraWindow[];
  probeThrow: boolean;
  rootRef: RefObject<HTMLElement>;
  pinned: boolean;
  onPin: () => void;
  onRestart: () => void;
  onClose: () => void;
}

function CreditsView({ game, gentle, windows, probeThrow, rootRef, pinned, onPin, onRestart, onClose }: ViewProps) {
  const veil = useVeilOpen(gentle);
  // 길이 N·명단 수는 모두 닫힌 상태의 줄로 한 번만 센다(재생 중 줄이 늘지 않는다)
  const base = useMemo(() => {
    if (probeThrow) throw new Error('credits probe');
    return creditsModelOf({ game, gentle, windows });
  }, [game, gentle, windows, probeThrow]);
  const model = useMemo(() => creditsModelOf({ game, gentle, windows, isOpen: veil.isOpen }), [game, gentle, windows, veil.isOpen]);
  const n = useMemo(() => creditsLength(base.lines), [base]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useBottomBar(barRef);
  // 띠가 풀렸는지(`html.bar-released`)를 `.credits[data-bar]`로 옮긴다 — credits.css의 선택자는 `.credits`로 시작해야 한다
  useEffect(() => {
    const html = document.documentElement;
    const root = rootRef.current;
    if (root === null) return;
    const sync = () => {
      root.dataset.bar = html.classList.contains('bar-released') ? 'released' : 'fixed';
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mo.disconnect();
      delete root.dataset.bar;
    };
  }, [rootRef]);

  const flow = useCreditsFlow({ n, people: base.people.length, pinned, headingRef });
  const flowOn = flow.plan !== null && flow.plan.mode === 'auto' && !pinned;
  const toggleVeil = (id: string) => {
    flow.pause();
    veil.toggle(id);
  };
  const toList = () => {
    flow.pause();
    onPin();
    headingRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <div className="credits-bar" ref={barRef} data-testid="credits-bar" data-n={n} data-flow={flowOn ? 'auto' : 'list'} data-reason={flow.plan !== null && flow.plan.mode === 'list' ? flow.plan.reason : pinned ? 'pinned' : undefined}>
        <div className="credits-bar-row">
          {flowOn ? (
            <div className="credits-bar-flow">
              <button type="button" className="btn btn--secondary btn--sm" data-testid="credits-toggle" data-flow-toggle="" onClick={flow.toggle}>
                {flow.running ? CREDITS_TEXT.pause : CREDITS_TEXT.resume}
              </button>
              <button type="button" className="btn btn--secondary btn--sm" data-testid="credits-list" onClick={toList}>
                {CREDITS_TEXT.toList}
              </button>
            </div>
          ) : null}
          <div className="credits-bar-nav">
            <button type="button" className="btn btn--secondary btn--sm" data-testid="credits-restart" onClick={onRestart}>
              {CREDITS_TEXT.restart}
            </button>
            <button type="button" className="btn btn--secondary btn--sm" data-testid="credits-close" onClick={onClose}>
              {CREDITS_TEXT.close}
            </button>
          </div>
        </div>
      </div>
      <div className="credits-frame">
        <div className="credits-doc">
          <div className="credits-who">
            <p className="credits-kicker">{model.title}</p>
            <h1 className="credits-name" tabIndex={-1} ref={headingRef} data-testid="credits-name" style={{ '--title-chars': titleCharsFor(model.name) } as CSSProperties}>
              {model.name}
            </h1>
            <p className="credits-years">{model.years}</p>
            <p className="credits-born">{model.born}</p>
            {model.gentleNote === null ? null : <p className="credits-gentle">{model.gentleNote}</p>}
          </div>
          <div className="credits-chapters">
            {model.people.length === 0 ? null : (
              <section className="credits-chapter" data-testid="credits-family">
                <h2>{CREDITS_TEXT.familyTitle}</h2>
                <ul className="credits-roll">
                  {model.people.map((p) => (
                    <li className="credits-person" key={p.key} data-testid="credits-person">
                      <span className="credits-role">{p.label}</span>
                      {p.name === '' ? null : <span className="credits-person-name">{p.name}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {model.choices.length === 0 ? null : (
              <section className="credits-chapter" data-testid="credits-choices">
                <h2>{CREDITS_TEXT.choiceTitle}</h2>
                {model.choices.map((r) => (
                  <Record key={r.historyIndex} rec={r} kind="choice" onToggle={toggleVeil} />
                ))}
              </section>
            )}
            {model.era.length === 0 ? null : (
              <section className="credits-chapter" data-testid="credits-era">
                <h2>{CREDITS_TEXT.eraTitle}</h2>
                {model.era.map((r) => (
                  <Record key={r.year} rec={r} kind="era" onToggle={toggleVeil} />
                ))}
              </section>
            )}
            <section className="credits-end" data-testid="credits-end">
              <h2 className="credits-kicker">{model.endTitle}</h2>
              <p className="credits-end-name">{model.name}</p>
              <p className="credits-end-line">{model.endLine}</p>
              <div className="credits-end-actions">
                <button type="button" className="btn btn--primary btn--lg" data-testid="credits-end-close" onClick={onClose}>
                  {CREDITS_TEXT.close}
                </button>
                <button type="button" className="btn btn--secondary" data-testid="credits-end-restart" onClick={onRestart}>
                  {CREDITS_TEXT.restart}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
      <div className="credits-end-space" aria-hidden="true" />
    </>
  );
}

export function CreditsScreen({ game, gentle, windows, onClosed, closeRef, probeThrow = false }: CreditsScreenProps) {
  const requestClose = useInfoPanelHistory(onClosed);
  const rootRef = useRef<HTMLElement>(null);
  const [pinned, setPinned] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    closeRef.current = requestClose;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      closeRef.current = null;
      document.removeEventListener('keydown', onKey);
    };
  }, [closeRef, requestClose]);
  return (
    <main className="credits" data-testid="credits-screen" ref={rootRef}>
      <CreditsBoundary onClose={requestClose}>
        <CreditsView
          key={`${run}-${gentle}`}
          game={game}
          gentle={gentle}
          windows={windows}
          probeThrow={probeThrow}
          rootRef={rootRef}
          pinned={pinned}
          onPin={() => setPinned(true)}
          onRestart={() => setRun((r) => r + 1)}
          onClose={requestClose}
        />
      </CreditsBoundary>
    </main>
  );
}
