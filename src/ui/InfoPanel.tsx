import { useCallback, useEffect, useRef } from 'react';
import type { FaqItem } from '../data/aboutFaq';
import { INFO_TEXT, NOTES_OPEN_COUNT } from '../data/infoText';
import { POLICY_SECTIONS } from '../data/policyText';
import { NOTE_KIND_TEXT, type ReleaseNote } from '../data/releaseNotes';
import { FeedbackLink } from './FeedbackLink';
import { useInfoPanelHistory } from './infoPanelHistory';
import { useScrollLock } from './useScrollLock';

/**
 * 정보 패널 「새 소식과 소개」 (SPEC-005 QI7 NT4·NT5·FQ1, docs/design/design-system.md 14-7·copy.md 13절, diff-005 D5-50). 첫 화면 **위에** 뜨는 모달 시트다 —
 * `.overlay > .sheet.sheet--info[role=dialog aria-modal aria-labelledby=info-title]`. 바깥(`.title`·본문 끝 여백·하단 띠)을 `inert`로 두는 일은 이 패널을 렌더하는 `TitleScreen`이 한다(결정 시트·기록 시트와 같은 방식, design-system.md 11-10).
 * 본문은 네 구역이다: 「새 소식」(버전별 `<details>`, **최신 3개가 펼쳐져** 있고 나머지는 접힘) → 「소개」(질문 `<details>` 열 개, 처음엔 모두 접힘) → 「개인정보 처리방침」 → 「이용 안내」(SPEC-004 GS12 — 첫 화면 하단 링크 줄이 여는 구역, **법률 검토 전 초안** 표시, 새 경로 없음) → 끝의 「의견 보내기」(도구 줄과 같은 `FeedbackLink`·`buildFeedbackUrl`, N2).
 * `<details>/<summary>`는 Enter·Space 조작과 `aria-expanded`를 브라우저가 준다.
 *
 * 열고 닫기 (NT5):
 *  - 열릴 때 제목(h2, `tabIndex=-1`)으로 포커스가 가고(스크롤 없이), 「소개」 링크로 열었으면 그 구역 머리가 패널 위에 오게 스크롤한다(sticky 머리 아래, `scroll-margin-top`).
 *  - 닫는 길 셋: 「닫기」 · **Esc** · **뒤로가기**(열 때 history 항목 하나를 더한다 — `useInfoPanelHistory`). 닫히면 포커스는 **열었던 푸터 링크**로 돌아간다(그 일은 `TitleScreen`이 한다).
 *  - 패널이 열려 있다는 사실은 저장하지 않는다 — 새로고침하면 닫힌 첫 화면이다(SV3).
 * 서버 호출·방문 분석은 없다. 문구는 `data/infoText.ts`·`releaseNotes.ts`·`aboutFaq.ts`(copy.md 13절 확정 글).
 */

export type InfoSection = 'news' | 'intro' | 'privacy' | 'terms';

export interface InfoPanelProps {
  /** 어느 구역으로 열었는가 (푸터의 「새 소식」 단추와 링크 줄의 「소개」·「개인정보 처리방침」·「이용 안내」) */
  section: InfoSection;
  notes: readonly ReleaseNote[];
  faq: readonly FaqItem[];
  /** 패널 끝 「의견 보내기」의 주소 (`buildFeedbackUrl`) — 없으면 버튼을 그리지 않는다 */
  feedbackUrl: string | null;
  /** 패널이 닫혔다 (닫기·Esc·뒤로가기 어느 길이든 마지막에 한 번 이상 불린다) — 부모가 패널을 걷어 낸다 */
  onClosed: () => void;
  /** 입력 가드 키 (열 때마다 새로 걸린다) */
  guardKey: string;
}

export function InfoPanel({ section, notes, faq, feedbackUrl, onClosed, guardKey }: InfoPanelProps) {
  useScrollLock();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const requestClose = useInfoPanelHistory(onClosed);

  // 열릴 때: 제목으로 포커스(스크롤 없이). 「소개」로 열었으면 그 구역 머리가 패널 위에 오게 한다
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    if (section !== 'news') document.getElementById(`info-${section}`)?.scrollIntoView({ block: 'start' });
  }, [section]);

  // Esc = 닫기 (뒤로가기·「닫기」와 같은 일)
  const close = useCallback(() => requestClose(), [requestClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="overlay" data-testid="info-overlay">
      <div className="sheet sheet--info" role="dialog" aria-modal="true" aria-labelledby="info-title" data-testid="info-panel" data-section={section}>
        <div className="sheet__head">
          <h2 id="info-title" className="sheet__title" tabIndex={-1} ref={titleRef} data-testid="info-title">
            {INFO_TEXT.panelTitle}
          </h2>
          <button type="button" className="btn btn--ghost btn--sm info__close" data-testid="info-close" onClick={close}>
            {INFO_TEXT.close}
          </button>
        </div>
        <div className="sheet__body">
          <section className="info__section" id="info-news" aria-labelledby="info-news-h" data-testid="info-news">
            <h3 id="info-news-h" className="info__h">
              {INFO_TEXT.newsName}
            </h3>
            <p className="info__lead">{INFO_TEXT.newsLead}</p>
            {notes.map((n, i) => (
              <details className="info__ver" open={i < NOTES_OPEN_COUNT} key={n.version} data-testid="info-version" data-version={n.version}>
                <summary>
                  <span>
                    <span className="info__ver-head">
                      <strong>v{n.version}</strong> <span className="info__ver-date">{n.date}</span>
                    </span>
                    <span className="info__ver-sum">{n.summary}</span>
                  </span>
                </summary>
                <ul className="info__items">
                  {n.items.map((it, j) => (
                    <li key={j}>
                      <span className="note-kind">{NOTE_KIND_TEXT[it.kind]}</span>
                      <span>{it.text}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
          <section className="info__section" id="info-intro" aria-labelledby="info-intro-h" data-testid="info-intro">
            <h3 id="info-intro-h" className="info__h">
              {INFO_TEXT.introName}
            </h3>
            <p className="info__lead">{INFO_TEXT.introLead}</p>
            {faq.map((q) => (
              <details className="faq__item" key={q.id} data-testid="faq-item" data-faq={q.id}>
                <summary>
                  <span>{q.question}</span>
                </summary>
                <div className="faq__a">
                  {q.answer.map((line, k) => (
                    <p key={k}>{line}</p>
                  ))}
                </div>
              </details>
            ))}
          </section>
          {POLICY_SECTIONS.map((sec) => (
            <section className="info__section" id={`info-${sec.id}`} aria-labelledby={`info-${sec.id}-h`} data-testid={`info-${sec.id}`} data-draft="true" key={sec.id}>
              <h3 id={`info-${sec.id}-h`} className="info__h">
                {sec.name}
              </h3>
              <p className="info__lead" data-testid={`info-${sec.id}-head`}>
                {sec.head}
              </p>
              <dl className="policy">
                {sec.items.map((it) => (
                  <div key={it.h}>
                    <dt>{it.h}</dt>
                    <dd>{it.p}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {feedbackUrl === null ? null : (
            <div className="info__foot">
              <FeedbackLink url={feedbackUrl} guardKey={guardKey} variant="panel" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
