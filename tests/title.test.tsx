import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import scourtJson from '../src/data/sources/scourt-birth-names.json';
import { NAMES } from '../src/data/names';
import { TitleScreen } from '../src/screens/TitleScreen';

/**
 * 첫 화면의 이름 통계 출처 표기 (법원 자료 이용 조건). 실제 폭 360px에서 넘치지 않는지는 e2e/title.spec.ts가 본다.
 * 여기서는 서버 렌더로 표기 문구·링크를 원자료 권장 표기와 대조한다. 첫 화면 전체(FS·VP·SC)는 tests/titleScreen.test.tsx.
 */
const scourt = scourtJson as unknown as { meta: { url: string; suggestedAttribution: string } };

describe('첫 화면 출처 표기', () => {
  const html = renderToStaticMarkup(
    <TitleScreen generation="random" lifeLength="short30" onSelectGeneration={() => {}} onSelectLifeLength={() => {}} onBegin={() => {}} />,
  );

  it('첫 화면이 뜨고, 이름 통계 출처 표기(names-credit)가 「태어나기」 버튼보다 뒤(푸터)에 있다', () => {
    expect(html).toContain('data-testid="title-screen"');
    expect(html).toContain('수저 게임');
    const credit = html.indexOf('data-testid="names-credit"');
    expect(credit).toBeGreaterThan(html.indexOf('data-testid="gen-list"'));
    expect(credit).toBeGreaterThan(html.indexOf('data-testid="carousel"'));
  });

  it('표기 문구는 names.json의 attribution이고 원자료 권장 표기의 기관·서비스·기준·조회일을 담는다', () => {
    // 줄바꿈 묶음(QM2-5, ui/Glue.tsx)의 span은 글자를 바꾸지 않고 감싸기만 하므로, 표기 문구 전체는 태그를 뺀 글자로 대조한다(조회일 같은 묶음이 span 안에 있다)
    expect(html.replace(/<[^>]+>/g, '')).toContain(NAMES.meta.attribution.text);
    for (const part of ['대한민국 법원 전자가족관계등록시스템', '통계서비스', '상위 출생신고 이름 현황', '등록일 기준 잠정치', '2026-10-13']) {
      expect(scourt.meta.suggestedAttribution).toContain(part);
      expect(html.replace(/<[^>]+>/g, ''), part).toContain(part); // 묶음 span이 낱말 중간에 걸릴 수 있어 태그를 뺀 글자로
    }
  });

  it('링크는 원자료가 기록한 주소로 새 탭에서 열리고 noopener가 붙는다', () => {
    const m = /<a href="([^"]+)" target="_blank" rel="([^"]+)">/.exec(html);
    expect(m).not.toBeNull();
    expect(m![1].replace(/&amp;/g, '&')).toBe(scourt.meta.url);
    expect(m![2]).toContain('noopener');
  });

  it('2007년 이전 출생 이름(연대 풀 — 통계가 아니다)을 통계라고 표기하지 않는다 (공식 통계를 쓰는 2008년 이후 출생만 밝힌다, NR4)', () => {
    expect(NAMES.meta.attribution.text).toContain('2008년 이후 출생 이름 출처');
    expect(NAMES.meta.attribution.text).not.toMatch(/지난 세상|지금 세상|다가올 세상|2007년 이전|연대/);
  });
});
