import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import scourtJson from '../src/data/sources/scourt-birth-names.json';
import { NAMES } from '../src/data/names';
import { TitleScreen } from '../src/screens/TitleScreen';

/**
 * 타이틀 화면의 이름 통계 출처 표기 (법원 자료 이용 조건). 실제 폭 360px에서 넘치지 않는지는 e2e/title.spec.ts가 본다.
 * 여기서는 서버 렌더로 표기 문구·링크를 원자료 권장 표기와 대조한다.
 */
const scourt = scourtJson as unknown as { meta: { url: string; suggestedAttribution: string } };

describe('타이틀 화면 출처 표기', () => {
  const html = renderToStaticMarkup(<TitleScreen onStart={() => {}} />);

  it('타이틀이 뜨고 제목·시작 버튼 아래에 출처 표기(names-credit)가 있다', () => {
    expect(html).toContain('data-testid="title-screen"');
    expect(html).toContain('수저 게임');
    const credit = html.indexOf('data-testid="names-credit"');
    expect(credit).toBeGreaterThan(html.indexOf('시작'));
  });

  it('표기 문구는 names.json의 attribution이고 원자료 권장 표기의 기관·서비스·기준·조회일을 담는다', () => {
    expect(html).toContain(NAMES.meta.attribution.text);
    for (const part of ['대한민국 법원 전자가족관계등록시스템', '통계서비스', '상위 출생신고 이름 현황', '등록일 기준 잠정치', '2026-10-13']) {
      expect(scourt.meta.suggestedAttribution).toContain(part);
      expect(html).toContain(part);
    }
  });

  it('링크는 원자료가 기록한 주소로 새 탭에서 열리고 noopener가 붙는다', () => {
    const m = /<a href="([^"]+)" target="_blank" rel="([^"]+)">/.exec(html);
    expect(m).not.toBeNull();
    expect(m![1].replace(/&amp;/g, '&')).toBe(scourt.meta.url);
    expect(m![2]).toContain('noopener');
  });

  it('지난 세상 이름을 통계라고 표기하지 않는다 (공식 통계를 쓰는 지금·다가올 세상만 밝힌다)', () => {
    expect(NAMES.meta.attribution.text).toContain('지금 세상·다가올 세상');
    expect(NAMES.meta.attribution.text).not.toContain('지난 세상');
  });
});
