import { BUILD_LABEL } from '../buildInfo';
import { FOOT_TEXT } from '../data/footText';
import { INFO_TEXT } from '../data/infoText';
import { NAME_CREDIT, footerStatsText } from '../data/titleText';
import { FeedbackLink } from './FeedbackLink';
import { Glue } from './Glue';
import type { InfoSection } from './InfoPanel';

/**
 * 첫 화면 하단 (SPEC-004 GS12, docs/design/copy.md 16-12 (a)~(g)·design-system.md 17-12-5, diff-004.md D4-63): 서비스 소개 · 운영자의 의도 · 아주 작은 링크 줄.
 * 상자 없이 가는 줄(1px)과 작은 글씨로만 나눈다. 순서: (a) 세 칸 「이 게임은 · 왜 만들었나 · 무엇이 실제 자료인가」 → (b) 무거운 일 안내(상담전화·「15세 이상 권장」) → (c) AI 고지 → (d) 의견 + 작은 단추 둘
 * → (f) 가족 한 줄 → (e) 아주 작은 링크 줄 「소개 · 개인정보 처리방침 · 이용 안내 · 의견 보내기 · 그 밖의 문의 {메일}」 → (g) 이름 출처 · 통계 출처 · 「운영자 cottonchild · 버전」. 법률 꼬리(링크 줄·출처·운영자)를 맨 아래에 모았다.
 * 링크 줄 행선지(마스터 결정): 「소개」·「개인정보 처리방침」·「이용 안내」는 정보 패널(`InfoPanel`)의 구역이고 새 경로·페이지는 없다. 「의견 보내기」는 기존 GitHub 이슈 링크(새 탭), 「그 밖의 문의」는 메일 주소 글자(`mailto:`만).
 * 「80억분의 1」은 이름만 적고 링크가 없다 — 그 게임과 관계없는 개인 프로젝트임을 같은 블록(「왜 만들었나」)에서 밝힌다. 가상 인구 줄은 없다(GS11).
 * 빌드 버전·통계 출처·이름 출처 줄은 하단 맨 아래에 있다(FS7).
 */
export function TitleFooter({
  orgs,
  feedbackUrl,
  unseenNotes,
  openPanel,
  guardKey,
}: {
  /** 통계 출처 기관 (캐러셀 데이터의 `orgs` — 푸터 출처 줄·「무엇이 실제 자료인가」·소개 Q3와 같은 쉼표 나열) */
  orgs: readonly string[];
  /** 「의견 보내기」 이슈 작성 주소 (`buildFeedbackUrl`). 없으면 그 링크를 그리지 않는다 */
  feedbackUrl: string | null;
  /** 아직 보지 않은 새 소식이 있는가 — 「새 소식」 단추에 「새」 표시 */
  unseenNotes: boolean;
  /** 정보 패널을 연다 (열었던 요소로 포커스가 돌아온다) */
  openPanel: (section: InfoSection, opener: HTMLElement) => void;
  guardKey: string;
}) {
  const panelLink = (section: InfoSection, testId: string, label: string) => (
    <a
      href="#"
      data-panel={section}
      data-testid={testId}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.preventDefault();
        openPanel(section, e.currentTarget);
      }}
    >
      {label}
    </a>
  );
  return (
    <footer className="title-foot title-foot--r4" data-testid="title-foot">
      {/* (a) 세 칸 */}
      <div className="foot-cols" data-testid="foot-cols">
        {[FOOT_TEXT.what, FOOT_TEXT.why].map((c) => (
          <section key={c.h}>
            <h2>{c.h}</h2>
            <p>
              <Glue text={c.p} />
            </p>
          </section>
        ))}
        <section>
          <h2>{FOOT_TEXT.data.h}</h2>
          <p>
            <Glue text={FOOT_TEXT.data.p(orgs)} />
          </p>
        </section>
      </div>
      {/* (b) 무거운 일 · 상담전화 · 권장 연령 */}
      <p className="foot-p" data-testid="foot-heavy">
        <Glue text={FOOT_TEXT.heavy()} />
      </p>
      {/* (c) AI 고지 */}
      <p className="foot-p" data-testid="foot-ai">
        <Glue text={FOOT_TEXT.ai} />
      </p>
      {/* (d) 의견 + 작은 단추 둘: 「의견 보내기」(GitHub 이슈, 새 탭) · 「새 소식」(패널 — 안 본 소식이 있으면 「새」 표시: 색 + 글자, 읽기 전용 꼬리가 뜻을 전한다) */}
      <div className="foot-beta" data-testid="foot-beta">
        <p className="foot-p">
          <Glue text={FOOT_TEXT.beta} />
        </p>
        <span className="foot-beta__actions">
          <FeedbackLink url={feedbackUrl} guardKey={guardKey} variant="foot-btn" />
          <a
            href="#"
            className="btn btn--secondary btn--sm"
            data-panel="news"
            data-testid="link-news"
            aria-haspopup="dialog"
            onClick={(e) => {
              e.preventDefault();
              openPanel('news', e.currentTarget);
            }}
          >
            {INFO_TEXT.newsName}
            {unseenNotes ? (
              <>
                <span className="news-badge" aria-hidden="true" data-testid="news-badge">
                  {INFO_TEXT.badge}
                </span>
                <span className="sr-only">{INFO_TEXT.badgeSr}</span>
              </>
            ) : null}
          </a>
        </span>
      </div>
      {/* (f) 가족 한 줄 */}
      <p className="foot-p foot-family" data-testid="foot-family">
        <Glue text={FOOT_TEXT.family} />
      </p>
      {/* (e) 아주 작은 링크 줄 */}
      <p className="foot-small foot-links" data-testid="info-links">
        {panelLink('intro', 'link-intro', FOOT_TEXT.links.intro)} <span aria-hidden="true">·</span> {panelLink('privacy', 'link-privacy', FOOT_TEXT.links.privacy)} <span aria-hidden="true">·</span>{' '}
        {panelLink('terms', 'link-terms', FOOT_TEXT.links.terms)} <span aria-hidden="true">·</span>{' '}
        {feedbackUrl === null ? null : (
          <>
            <FeedbackLink url={feedbackUrl} guardKey={guardKey} variant="foot-link" /> <span aria-hidden="true">·</span>{' '}
          </>
        )}
        <span className="nowrap">{FOOT_TEXT.links.contact}</span>{' '}
        <a href={`mailto:${FOOT_TEXT.email}`} data-testid="foot-mail">
          {FOOT_TEXT.email}
        </a>
      </p>
      {/* (g) 이름 출처(법원 통계 자료 이용 조건: 출처를 구체적으로 — 문구·주소는 names.json의 meta.attribution과 같다) · 통계 출처 · 운영자 · 버전 */}
      <p className="foot-small credit" data-testid="names-credit">
        <a href={NAME_CREDIT.url} target="_blank" rel="noopener noreferrer">
          <Glue text={NAME_CREDIT.text} />
        </a>
      </p>
      <p className="foot-small" data-testid="stats-credit">
        <Glue text={footerStatsText(orgs)} />
      </p>
      <p className="foot-small foot-op" data-testid="foot-operator">
        <span className="nowrap">{FOOT_TEXT.operator}</span> <span aria-hidden="true">·</span>{' '}
        <span className="num" data-testid="build-version">
          {BUILD_LABEL}
        </span>
      </p>
    </footer>
  );
}
