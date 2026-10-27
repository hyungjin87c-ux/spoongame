import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILD_LABEL } from '../src/buildInfo';
import { GAME_KEY, SETTINGS_KEY } from '../src/core/storage';
import { buildCarousel } from '../src/core';
import { faqHelpLine } from '../src/data/aboutFaq';
import { FOOT_TEXT } from '../src/data/footText';
import { DRAFT_MARK, POLICY_SECTIONS, PRIVACY, TERMS } from '../src/data/policyText';
import { NAME_CREDIT, footerStatsText } from '../src/data/titleText';
import { TitleScreen } from '../src/screens/TitleScreen';
import { visibleText } from './helpers/visible';

/**
 * 첫 화면 하단 (SPEC-004 GS12, copy.md 16-12 (a)~(g)·17절): 서비스 소개 · 운영자 의도 · 아주 작은 링크 줄. 서버 렌더로 구조·문구·링크를 본다 — 실제 폭·키보드·패널 열기는 e2e/first-screen.spec.ts·e2e/info-panel.spec.ts.
 * 「80억분의 1」은 이름만(링크 없음) + 관계없음을 같은 블록에서 밝힌다. 하단 소개 문장이 다른 게임의 문장을 옮기지 않았음은 reviewer 판독(구조만 참고).
 */

const html = renderToStaticMarkup(<TitleScreen generation="random" lifeLength="short30" onSelectGeneration={() => {}} onSelectLifeLength={() => {}} onBegin={() => {}} />);
const foot = html.slice(html.indexOf('data-testid="title-foot"'), html.indexOf('data-testid="page-end-space"') > 0 ? html.indexOf('data-testid="page-end-space"') : html.indexOf('page-end-space'));
/** 줄바꿈 묶음(span.nowrap·keep-phrase)과 읽기 전용 꼬리를 벗긴 보이는 글자 — 묶음이 태그 자리에 공백을 넣어 「109(24시간)」을 가르지 않게 */
const plainText = (h: string): string => visibleText(h.replace(/<span class="(?:nowrap|keep-phrase)">([^<]*)<\/span>/g, '$1').replace(/<span class="sr-only">[^<]*<\/span>/g, ''));
/** marker가 든 요소의 여는 태그부터 */
const from = (h: string, marker: string): string => h.slice(h.lastIndexOf('<', h.indexOf(marker)));
const footText = plainText(foot);
const orgs = buildCarousel().orgs;

describe('구조와 순서 (17-12-5)', () => {
  it('블록 순서: 세 칸 → 무거운 일(b) → AI 고지(c) → 의견 + 단추 둘(d) → 가족 한 줄(f) → 링크 줄(e) → 이름 출처 → 통계 출처 → 운영자·버전(g)', () => {
    const marks = ['data-testid="foot-cols"', 'data-testid="foot-heavy"', 'data-testid="foot-ai"', 'data-testid="foot-beta"', 'data-testid="foot-family"', 'data-testid="info-links"', 'data-testid="names-credit"', 'data-testid="stats-credit"', 'data-testid="foot-operator"'];
    const at = marks.map((m) => foot.indexOf(m));
    expect(at.every((i) => i >= 0), `조각 위치 ${at}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(foot.indexOf('data-testid="build-version"'), '빌드 버전은 맨 아래 줄').toBeGreaterThan(foot.indexOf('data-testid="stats-credit"'));
  });

  it('세 칸: 「이 게임은」 · 「왜 만들었나」 · 「무엇이 실제 자료인가」(h2) — 셋째 칸의 기관 나열은 통계 출처 줄·소개 Q3와 같은 데이터(쉼표 나열)', () => {
    const cols = foot.slice(foot.indexOf('data-testid="foot-cols"'), foot.indexOf('data-testid="foot-heavy"'));
    expect([...cols.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1])).toEqual(['이 게임은', '왜 만들었나', '무엇이 실제 자료인가']);
    expect(plainText(cols)).toContain(FOOT_TEXT.data.p(orgs));
    expect(FOOT_TEXT.data.p(orgs)).toContain(`${orgs.join(', ')}의 공개 자료에서 옮겼어요`);
    expect(footText).toContain(footerStatsText(orgs));
  });

  it('무거운 일(b): 상담전화 이름·번호·시간은 데이터(helpLine)에서, 「무거운 장면 가리기」 설정 이름과 「15세 이상 권장」이 같은 문단에 있다', () => {
    const help = faqHelpLine()!;
    expect(help.number).toBe('109');
    const h = from(foot, 'data-testid="foot-heavy"');
    const heavy = plainText(h.slice(0, h.indexOf('</p>') + 4));
    expect(heavy).toContain(`${help.name} ${help.number}(${help.hours})로 전화할 수 있어요`);
    expect(heavy).toContain('「무거운 장면 가리기」');
    expect(heavy).toContain('15세 이상 권장');
  });

  it('AI 고지(c) · 의견(d) · 가족 한 줄(f) 문구가 copy.md 16-12 그대로이고 평가어·느낌표·이모지가 없다', () => {
    expect(footText).toContain('한 사람이 기획하고 AI(Anthropic의 Claude)와 함께 만든 시뮬레이션이에요.');
    expect(footText).toContain('아직 다듬는 중이에요. 이상한 곳이나 바라는 점을 알려 주시면 살펴보고 고칠게요.');
    expect(footText).toContain('가족과 함께라면 부모님이나 자녀의 세대를 골라 살아 보고, 그 시절 이야기를 나눠 보세요.');
    expect(footText).not.toMatch(/[!！]/);
    expect(footText).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('운영자·연락처·권장 연령 (형진 님 답 3차 4)', () => {
  it('운영자 cottonchild · 문의 kottonchild@gmail.com(철자 그대로 — 운영자명의 c와 다르게 k) · 「15세 이상 권장」이 하단에 있다', () => {
    expect(footText).toContain('운영자 cottonchild');
    expect(footText).toContain('kottonchild@gmail.com');
    expect(footText).toContain('15세 이상 권장');
    expect(FOOT_TEXT.email).toBe('kottonchild@gmail.com');
    expect(FOOT_TEXT.operator).toBe('운영자 cottonchild');
  });

  it('문의 메일은 글자로 보이고 링크는 mailto: 하나뿐이다', () => {
    const mails = [...foot.matchAll(/<a [^>]*href="(mailto:[^"]+)"[^>]*>([^<]*)<\/a>/g)];
    expect(mails.map((m) => [m[1], m[2]])).toEqual([['mailto:kottonchild@gmail.com', 'kottonchild@gmail.com']]);
  });

  it('운영자 줄: 「운영자 cottonchild · v0.2.1 (해시)」 — 버전은 빌드 표기 한 곳(BUILD_LABEL)', () => {
    expect(foot).toContain(`data-testid="build-version">${BUILD_LABEL}<`);
    const op = from(foot, 'data-testid="foot-operator"');
    expect(plainText(op.slice(0, op.indexOf('</p>') + 4))).toBe(`운영자 cottonchild · ${BUILD_LABEL}`);
  });
});

describe('「80억분의 1」 — 이름만, 링크 없음, 관계없음 (마스터 결정)', () => {
  it('「80억분의 1」을 감싼 링크(<a>)가 하단에 없고, 이름이 적힌 블록(「왜 만들었나」)에 관계없는 개인 프로젝트임을 밝힌 문장이 있다', () => {
    const anchors = [...foot.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1]);
    expect(anchors.some((t) => t.includes('80억')), '80억분의 1 링크').toBe(false);
    expect(foot).not.toMatch(/href="[^"]*(8billion|80억|80eok)/i);
    const why = foot.slice(foot.indexOf('<h2>왜 만들었나</h2>'), foot.indexOf('<h2>무엇이 실제 자료인가</h2>'));
    expect(plainText(why)).toContain('「80억분의 1」과는 관계없는 개인 프로젝트예요.');
    expect(plainText(why)).toContain('「80억분의 1」을 한국 사정에 맞게 다시 만들어 보고 싶었어요.');
  });

  it('가상 인구 문구는 없다 (GS11 — 하단·첫 화면 어디에도)', () => {
    expect(visibleText(html)).not.toMatch(/가상 인구|가상인구|이 세상의 가상|시뮬레이션 속에서 각자의 삶/);
  });
});

describe('링크 줄 (e) — 행선지는 정보 패널의 구역·GitHub 이슈·메일', () => {
  const linksHtml = from(foot, 'data-testid="info-links"').slice(0, from(foot, 'data-testid="info-links"').indexOf('</p>') + 4);

  it('항목 순서: 소개 · 개인정보 처리방침 · 이용 안내 · 의견 보내기 · 그 밖의 문의 {메일} (구분 기호는 aria-hidden)', () => {
    expect(plainText(linksHtml)).toBe('소개 · 개인정보 처리방침 · 이용 안내 · 의견 보내기 · 그 밖의 문의 kottonchild@gmail.com');
    // 읽기 프로그램에는 구분 기호가 없고 의견 보내기가 새 탭으로 열린다고 알린다
    expect(visibleText(linksHtml, { ariaHidden: true })).toBe('소개 개인정보 처리방침 이용 안내 의견 보내기 (새 탭으로 열립니다) 그 밖의 문의 kottonchild@gmail.com');
  });

  it('소개·개인정보 처리방침·이용 안내는 같은 패널의 구역을 여는 링크(href=#, data-panel)이고 새 경로·새 페이지가 없다', () => {
    for (const [panel, testId] of [['intro', 'link-intro'], ['privacy', 'link-privacy'], ['terms', 'link-terms']] as const) {
      expect(linksHtml).toMatch(new RegExp(`<a href="#" data-panel="${panel}" data-testid="${testId}" aria-haspopup="dialog">`));
    }
    const hrefs = [...linksHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.filter((h) => h.startsWith('/') || h.startsWith('./') || h.endsWith('.html'))).toEqual([]);
  });

  it('의견 보내기: 하단의 단추와 링크 줄의 글자 링크가 같은 GitHub 이슈 주소(새 탭)다', () => {
    const urls = [...foot.matchAll(/<a [^>]*href="(https:\/\/github\.com\/[^"]+issues\/new[^"]*)"[^>]*>/g)].map((m) => m[1]);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(urls[1]);
    expect(foot).toContain('data-testid="foot-feedback"');
    expect(foot).toContain('data-testid="foot-feedback-link"');
    for (const m of foot.matchAll(/<a [^>]*data-testid="foot-feedback(?:-link)?"[^>]*>/g)) {
      expect(m[0]).toContain('target="_blank"');
      expect(m[0]).toContain('rel="noopener noreferrer"');
    }
  });

  it('이름 출처 줄은 법원 통계 이용 조건의 문구·주소 그대로다', () => {
    expect(foot).toContain(`href="${NAME_CREDIT.url}"`);
    expect(footText).toContain(NAME_CREDIT.text);
  });
});

describe('개인정보 처리방침·이용 안내 초안의 사실 (copy.md 17절 — 코드와 어긋나지 않게)', () => {
  const privacyText = PRIVACY.items.map((i) => i.p).join(' ');

  it('저장 키 둘은 코드의 상수와 같다 (suzeo-game:save · suzeo-game:settings)', () => {
    expect(privacyText).toContain(GAME_KEY);
    expect(privacyText).toContain(SETTINGS_KEY);
    expect(GAME_KEY).toBe('suzeo-game:save');
    expect(SETTINGS_KEY).toBe('suzeo-game:settings');
  });

  it('구역 둘 모두 「법률 검토 전 초안」 표시가 머리 줄에 있다', () => {
    expect(POLICY_SECTIONS).toEqual([PRIVACY, TERMS]);
    for (const sec of POLICY_SECTIONS) expect(sec.head).toContain(DRAFT_MARK);
    expect(PRIVACY.items.map((i) => i.h)).toEqual(['무엇을 어디에 저장하나', '서버·외부 요청', '외부 링크', '의견 보내기', '메일 문의', '호스팅', '운영자·바뀜']);
    expect(TERMS.items.map((i) => i.h)).toEqual(['무엇인가', '권장 연령', '숫자의 성격', '상담·치료 아님', '저작권', '책임의 한계', '문의']);
  });

  it('메일 문의는 「답장을 위해 보낸 분의 메일 주소를 받는다」고 밝힌다 (형진 님 답)', () => {
    expect(PRIVACY.items.find((i) => i.h === '메일 문의')!.p).toContain('답장을 위해 보낸 분의 메일 주소를 받아요');
  });

  it('소스 점검: 서버·분석·쿠키·서비스 워커 호출이 src에 없다(처방침의 「서버와 통신하지 않아요」 주장) — fetch·XMLHttpRequest·sendBeacon·document.cookie·serviceWorker', () => {
    const sources = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const bad: string[] = [];
    for (const [path, raw] of Object.entries(sources)) {
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
      if (/\bfetch\s*\(|XMLHttpRequest|sendBeacon|document\.cookie|serviceWorker/.test(code)) bad.push(path);
    }
    expect(bad).toEqual([]);
  });

  it('의견 보내기 항목이 말하는 미리 채우는 값(화면 이름·세대·인생 길이·버전)이 core/feedback.ts의 필드와 같다', () => {
    const p = PRIVACY.items.find((i) => i.h === '의견 보내기')!.p;
    expect(p).toContain('화면 이름, 세대, 인생 길이, 게임 버전 네 가지뿐이에요');
  });
});
