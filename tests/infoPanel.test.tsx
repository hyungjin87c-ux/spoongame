import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildFeedbackUrl, feedbackFieldsOf } from '../src/core';
import { buildAboutFaq } from '../src/data/aboutFaq';
import { INFO_TEXT, NOTES_OPEN_COUNT } from '../src/data/infoText';
import { NOTE_KIND_TEXT, RELEASE_NOTES, type ReleaseNote } from '../src/data/releaseNotes';
import { DASH_TEXT } from '../src/data/dashText';
import { TitleScreen } from '../src/screens/TitleScreen';
import { FeedbackLink } from '../src/ui/FeedbackLink';
import { InfoPanel } from '../src/ui/InfoPanel';
import { PANEL_STATE_KEY, decideCloseRequest, hasPanelMark } from '../src/ui/infoPanelHistory';
import historySrc from '../src/ui/infoPanelHistory.ts?raw';
import infoPanelSrc from '../src/ui/InfoPanel.tsx?raw';
import titleScreenSrc from '../src/screens/TitleScreen.tsx?raw';
import { visibleText } from './helpers/visible';

/**
 * 정보 패널 「새 소식과 소개」 (SPEC-005 QI7 NT4·NT5·FQ1, 완료 기준 12): 서버 렌더로 구조·접근성 속성·문구를 본다. 열고 닫기(Esc·뒤로가기·포커스 복귀·inert)·새로고침·320px는 e2e/info-panel.spec.ts.
 */

const REPO = 'https://github.com/owner/spoongame';
const BUILD = 'v0.2.0 (abc1234)';
const FIELDS = feedbackFieldsOf({ phase: 'title', era: null, lifeLength: null }, REPO, BUILD);
const URL_ = buildFeedbackUrl(FIELDS);
const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const faq = buildAboutFaq({ orgs: ['국가데이터처', '행정안전부', '교육부'] });
const noop = () => undefined;

const render = (over: Partial<{ section: 'news' | 'intro'; notes: readonly ReleaseNote[]; feedbackUrl: string | null }> = {}): string =>
  renderToStaticMarkup(<InfoPanel section={over.section ?? 'news'} notes={over.notes ?? RELEASE_NOTES} faq={faq} feedbackUrl={over.feedbackUrl === undefined ? URL_ : over.feedbackUrl} onClosed={noop} guardKey="info-panel:1" />);

describe('패널의 모양 (NT5·FQ1) — 모달 시트', () => {
  const html = render();

  it('모달 대화상자: role=dialog · aria-modal · 이름은 제목(h2#info-title) · 제목은 tabindex=-1(열릴 때 포커스) · 바탕 .overlay 안의 .sheet--info', () => {
    expect(html).toContain('<div class="overlay" data-testid="info-overlay">');
    expect(html).toContain('class="sheet sheet--info" role="dialog" aria-modal="true" aria-labelledby="info-title"');
    expect(html).toMatch(/<h2 id="info-title" class="sheet__title" tabindex="-1"[^>]*>새 소식과 소개<\/h2>/);
    expect(html).toContain(`>${INFO_TEXT.panelTitle}<`);
  });

  it('머리에 「닫기」 버튼(닫기·Esc·뒤로가기가 같은 닫기)이 있다', () => {
    expect(html).toMatch(/<button type="button" class="btn btn--ghost btn--sm info__close" data-testid="info-close">닫기<\/button>/);
  });

  it('두 구역: 「새 소식」(h3) → 「소개」(h3), 각 구역은 aria-labelledby로 제목에 묶이고 머리 한 줄 안내가 있다', () => {
    expect(html.indexOf('id="info-news"')).toBeLessThan(html.indexOf('id="info-intro"'));
    for (const [id, h, lead] of [
      ['info-news', 'info-news-h', INFO_TEXT.newsLead],
      ['info-intro', 'info-intro-h', INFO_TEXT.introLead],
    ]) {
      expect(html).toContain(`id="${id}" aria-labelledby="${h}"`);
      expect(html).toContain(`<p class="info__lead">${lead}</p>`);
    }
    expect(html).toContain('<h3 id="info-news-h" class="info__h">새 소식</h3>');
    expect(html).toContain('<h3 id="info-intro-h" class="info__h">소개</h3>');
  });

  it('새 소식: 버전별 <details>가 최신 위로 놓이고 최신 3개만 펼쳐 있다 (다섯 버전을 주면 셋만 open) · 항목 종류는 두 글자 칩 · 날짜 YYYY-MM-DD', () => {
    const v = (version: string): ReleaseNote => ({ version, date: '2026-01-01', summary: '요약이에요.', items: [{ kind: 'new', text: '항목이에요.' }] });
    const five = ['0.5.0', '0.4.0', '0.3.0', '0.2.0', '0.1.0'].map(v);
    const doc = render({ notes: five });
    const details = [...doc.matchAll(/<details class="info__ver"( open="")? data-testid="info-version" data-version="([^"]+)">/g)];
    expect(details.map((d) => d[2])).toEqual(['0.5.0', '0.4.0', '0.3.0', '0.2.0', '0.1.0']);
    expect(details.map((d) => d[1] !== undefined)).toEqual([true, true, true, false, false]);
    expect(NOTES_OPEN_COUNT).toBe(3);
    // 실제 노트: 두 버전, 둘 다 펼침
    const real = [...html.matchAll(/<details class="info__ver"( open="")? data-testid="info-version" data-version="([^"]+)">/g)];
    expect(real.map((d) => d[2])).toEqual(RELEASE_NOTES.map((n) => n.version));
    expect(real.every((d) => d[1] !== undefined)).toBe(true);
    // 버전 줄: 굵은 v + 날짜, 요약
    for (const n of RELEASE_NOTES) {
      expect(html).toContain(`<strong>v${n.version}</strong> <span class="info__ver-date">${n.date}</span>`);
      expect(html).toContain(`<span class="info__ver-sum">${n.summary}</span>`);
      for (const it of n.items) expect(html).toContain(`<li><span class="note-kind">${NOTE_KIND_TEXT[it.kind]}</span><span>${esc(it.text)}</span></li>`);
    }
  });

  it('소개: 질문 열 개가 <details>/<summary>(키보드·aria-expanded는 브라우저가)이고 처음엔 모두 접혀 있다 · 답은 줄마다 <p>', () => {
    const items = [...html.matchAll(/<details class="faq__item"( open="")? data-testid="faq-item" data-faq="([^"]+)">/g)];
    expect(items).toHaveLength(10);
    expect(items.every((m) => m[1] === undefined)).toBe(true);
    for (const q of faq) {
      expect(html).toContain(`<summary><span>${esc(q.question)}</span></summary>`);
      for (const line of q.answer) expect(html).toContain(`<p>${esc(line)}</p>`);
    }
  });

  it('패널 끝 「의견 보내기」: 같은 FeedbackLink·buildFeedbackUrl — 새 탭(target=_blank rel=noopener noreferrer) · 주소는 buildFeedbackUrl의 값 · 읽기 이름 「(새 탭으로 열립니다)」 (N2)', () => {
    expect(URL_).not.toBeNull();
    const link = html.match(/<a class="btn btn--secondary btn--sm"[^>]*data-testid="info-feedback">[\s\S]*?<\/a>/)![0];
    expect(link).toContain(`href="${esc(URL_!)}"`);
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).toContain(`<span>${DASH_TEXT.toolFeedback}</span>`);
    expect(link).toContain(`<span class="sr-only">${DASH_TEXT.feedbackNewTab}</span>`);
    expect(html.indexOf('info__foot')).toBeGreaterThan(html.indexOf('id="info-intro"'));
    // 화면 필드는 기존 첫 화면 값(「첫 화면」)이고 세상·인생 길이는 비어 있다
    expect(decodeURIComponent(new URL(URL_!).searchParams.get('screen')!)).toBe(`첫 화면, ${BUILD}`);
  });

  it('주소를 만들 수 없으면(저장소 주소가 빌드 설정에 없다) 의견 보내기 영역이 아예 없다', () => {
    const none = render({ feedbackUrl: null });
    expect(none).not.toContain('info__foot');
    expect(none).not.toContain('info-feedback');
  });

  it('이름·연락처 없이 문구만 있다: 보이는 글자에 이메일·전화·주소 문자열이 없다 (주소는 의견 보내기 링크의 href에만)', () => {
    const shown = visibleText(html);
    expect(shown).not.toMatch(/@|https?:\/\//);
  });

  it('두 푸터 링크 이름과 구역 이름이 같다 (QM3-3: 가리키는 이름 일치)', () => {
    expect(INFO_TEXT.newsName).toBe('새 소식');
    expect(INFO_TEXT.introName).toBe('소개');
    expect(html).toContain(`>${INFO_TEXT.newsName}</h3>`);
    expect(html).toContain(`>${INFO_TEXT.introName}</h3>`);
  });

  it('소스: 패널은 Esc·「닫기」·뒤로가기를 같은 닫기로 처리하고 외부 주소로 요청하지 않는다', () => {
    expect(infoPanelSrc).toContain("e.key !== 'Escape'");
    expect(infoPanelSrc).toContain('useInfoPanelHistory');
    expect(infoPanelSrc).toContain('useScrollLock');
    expect(infoPanelSrc).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  });
});

describe('FeedbackLink 두 자리 (도구 줄 · 패널) — 같은 주소·같은 속성', () => {
  it('variant만 다르다: 도구 줄 버튼은 btn--tool·tool-feedback, 패널은 btn--secondary btn--sm·info-feedback — href·target·rel·읽기 이름은 같다', () => {
    const tool = renderToStaticMarkup(<FeedbackLink url={URL_} guardKey="k" />);
    const panel = renderToStaticMarkup(<FeedbackLink url={URL_} guardKey="k" variant="panel" />);
    expect(tool).toContain('class="btn btn--tool"');
    expect(tool).toContain('data-testid="tool-feedback"');
    expect(panel).toContain('class="btn btn--secondary btn--sm"');
    expect(panel).toContain('data-testid="info-feedback"');
    for (const attr of [`href="${esc(URL_!)}"`, 'target="_blank"', 'rel="noopener noreferrer"', DASH_TEXT.feedbackNewTab]) {
      expect(tool).toContain(attr);
      expect(panel).toContain(attr);
    }
    expect(renderToStaticMarkup(<FeedbackLink url={null} guardKey="k" variant="panel" />)).toBe('');
  });
});

describe('첫 화면 푸터 링크와 「새」 표시 (NT4)', () => {
  const title = (over: { notesSeen?: string; appVersion?: string } = {}): string =>
    renderToStaticMarkup(<TitleScreen era="present" lifeLength="short30" onSelectEra={noop} onSelectLifeLength={noop} onBegin={noop} minute={29_850_000} {...over} />);

  it('푸터에 「새 소식」 · 「소개」 링크 둘이 있고 각각 data-panel로 구역을 가린다 (같은 패널을 연다)', () => {
    const html = title({ notesSeen: '0.2.0', appVersion: '0.2.0' });
    expect(html).toMatch(/<p class="title-foot__links" data-testid="info-links"><a href="#" data-panel="news" data-testid="link-news" aria-haspopup="dialog">새 소식<\/a> <span aria-hidden="true">·<\/span> <a href="#" data-panel="intro" data-testid="link-intro" aria-haspopup="dialog">소개<\/a><\/p>/);
    // 빌드 표기 옆(푸터 안)이다
    expect(html.indexOf('info-links')).toBeGreaterThan(html.indexOf('data-testid="title-foot"'));
  });

  it('「새」 표시: 지금 버전이 마지막으로 본 버전보다 높거나 본 적이 없으면 알약 글자(aria-hidden) + 읽기 전용 꼬리가 뜨고, 같으면 둘 다 없다', () => {
    const badge = '<span class="news-badge" aria-hidden="true" data-testid="news-badge">새</span><span class="sr-only">(읽지 않은 소식 있음)</span>';
    expect(title({ notesSeen: '', appVersion: '0.2.0' })).toContain(`새 소식${badge}</a>`);
    expect(title({ notesSeen: '0.1.0', appVersion: '0.2.0' })).toContain(badge);
    expect(title({ notesSeen: '0.2.0', appVersion: '0.2.0' })).not.toContain('news-badge');
    expect(title({ notesSeen: '0.3.0', appVersion: '0.2.0' })).not.toContain('news-badge');
    // 알약은 「소개」 링크에는 붙지 않는다
    expect(title({ notesSeen: '', appVersion: '0.2.0' })).not.toMatch(/data-panel="intro"[^>]*>소개<span class="news-badge"/);
  });

  it('알약의 글자(「새」)는 스크린리더에 읽히지 않고 뜻은 「(읽지 않은 소식 있음)」이 전한다 — 링크 이름이 「새 소식 새」로 읽히지 않는다 (색 + 글자)', () => {
    const html = title({ notesSeen: '', appVersion: '0.2.0' });
    const link = html.match(/<a href="#" data-panel="news"[\s\S]*?<\/a>/)![0];
    expect(visibleText(link, { ariaHidden: true })).toBe('새 소식 (읽지 않은 소식 있음)');
  });

  it('소스: 패널을 열면 notesSeen을 갱신하고(onSeeNotes) 닫으면 열었던 링크로 포커스를 돌려주며 바깥을 inert로 둔다', () => {
    expect(titleScreenSrc).toContain('onSeeNotes?.(appVersion)');
    expect(titleScreenSrc).toContain('panelOpener.current?.focus()');
    expect(titleScreenSrc.match(/\{\.\.\.panelInert\}/g)?.length).toBe(3); // .title · 본문 끝 여백 · 하단 띠
    // 패널이 열려 있을 때만 inert를 건다 — 닫혀 있으면 빈 속성(변이 점검: 항상 빈 속성이면 바깥이 inert가 되지 않는다)
    expect(titleScreenSrc).toMatch(/const panelInert = panel === null \? \{\} : INERT;/);
  });
});

describe('뒤로가기 = 닫기 (NT5) — history 표식 규칙', () => {
  it('hasPanelMark: 현재 항목에 이 패널의 토큰 표식이 있을 때만 참이다 — 새로고침 뒤 남은 옛 토큰·다른 모양의 state는 거짓', () => {
    expect(PANEL_STATE_KEY).toBe('suzeoInfoPanel');
    expect(hasPanelMark({ [PANEL_STATE_KEY]: 't1' }, 't1')).toBe(true);
    expect(hasPanelMark({ [PANEL_STATE_KEY]: 't1' }, 't2')).toBe(false);
    for (const bad of [null, undefined, 'x', 1, [], { other: 't1' }]) expect(hasPanelMark(bad, 't1')).toBe(false);
  });

  it('R-491 decideCloseRequest: 되돌리는 중이면 표식이 아직 남아 있어도 무시한다(두 번째 history.back 없음) · 표식이 있으면 한 걸음 되돌리고 · 없으면 바로 닫는다', () => {
    expect(decideCloseRequest(false, true)).toBe('back');
    expect(decideCloseRequest(false, false)).toBe('close');
    // popstate 전에 닫기 요청이 겹친 경우(「닫기」 더블클릭·Esc 연타): history.state의 표식은 아직 그대로(marked 참)지만 둘째 요청은 무시
    expect(decideCloseRequest(true, true)).toBe('ignore');
    expect(decideCloseRequest(true, false)).toBe('ignore');
  });

  it('R-491 소스: 훅이 닫기 요청마다 decideCloseRequest(closing)를 거치고, 되돌리기 직전에 closing을 켜며, popstate·보호 시간에서 끈다 (변이 점검: 이 중 하나가 없으면 겹친 닫기가 history를 두 걸음 되돌린다)', () => {
    expect(historySrc).toContain('const closing = useRef(false);');
    expect(historySrc).toContain('decideCloseRequest(closing.current, marked)');
    // closing을 켠 다음에 history.back()을 부른다
    expect(historySrc).toMatch(/closing\.current = true;\s*window\.history\.back\(\);/);
    // 풀림: popstate 처리기와 보호 시간 콜백 둘 다
    expect(historySrc.match(/closing\.current = false;/g)).toHaveLength(2);
    // 닫기 버튼과 Esc가 같은 요청 함수(close)를 쓴다 — 두 길이 같은 가드를 지난다
    expect(infoPanelSrc).toContain('const close = useCallback(() => requestClose(), [requestClose]);');
    expect(infoPanelSrc).toContain('data-testid="info-close" onClick={close}');
    expect(infoPanelSrc).toMatch(/e\.preventDefault\(\);\s*close\(\);/);
  });
});
