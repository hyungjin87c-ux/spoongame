import { describe, expect, it } from 'vitest';
import doc from '../docs/data/events-distribution.md?raw';
import { ERAS, STAGES, isChoiceEvent } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { EVENT_MOTIFS } from '../scripts/eventMotifs';
import { cellCounts, renderDistributionDoc } from '../scripts/eventDistributionLib';

/**
 * docs/data/events-distribution.md (M4 TODO 근거 문서)가 이벤트 데이터와 어긋나지 않는지 확인한다.
 * 문서는 손으로 고치지 않고 `npx vite-node scripts/eventDistribution.ts`로 다시 만든다.
 */
describe('docs/data/events-distribution.md 는 이벤트 데이터에서 만든 것과 같다', () => {
  it('파일 전체가 renderDistributionDoc(EVENT_POOL)의 출력과 똑같다 (다르면 문서를 다시 만든다: npx vite-node scripts/eventDistribution.ts)', () => {
    expect(doc).toBe(renderDistributionDoc(EVENT_POOL));
  });

  it('총계 문장의 이벤트 수·선택지 수가 실제와 같다', () => {
    const total = EVENT_POOL.events.length;
    const choices = EVENT_POOL.events.filter(isChoiceEvent).length;
    expect(doc).toContain(`이벤트 **${total}개** = 선택지 이벤트 ${choices}개 + 서술 이벤트 ${total - choices}개`);
    expect(total).toBeGreaterThanOrEqual(60);
  });

  it('시대 x 단계 표의 모든 칸이 실제 개수와 같다 (서술 / 선택지)', () => {
    for (const stage of STAGES) {
      const row = doc.split('\n').find((l) => l.startsWith(`| ${STAGE_TABLE[stage].label} (`));
      expect(row, `${stage} 행`).toBeDefined();
      const cells = row!.split('|').slice(2, 2 + ERAS.length).map((c) => c.trim());
      ERAS.forEach((era, i) => {
        const c = cellCounts(EVENT_POOL, era, stage);
        expect(cells[i], `${era}/${stage}`).toBe(`${c.narrative} / ${c.choice}`);
      });
    }
  });

  it('모든 이벤트 id가 목록에 한 번씩 있고, 모티브 한 줄이 붙어 있다', () => {
    for (const e of EVENT_POOL.events) {
      const rows = doc.split('\n').filter((l) => l.startsWith(`| \`${e.id}\` |`));
      expect(rows, e.id).toHaveLength(1);
      expect(rows[0]).toContain(EVENT_MOTIFS[e.id]);
      expect(rows[0]).toContain(e.title);
    }
    expect(Object.keys(EVENT_MOTIFS).sort()).toEqual(EVENT_POOL.events.map((e) => e.id).sort());
  });

  it('모티브 한 줄은 커뮤니티 글을 옮긴 것이 아니라 사연의 종류를 적은 짧은 문장이다 (URL·느낌표·인용 표지 없음, 60자 이하)', () => {
    for (const [id, motif] of Object.entries(EVENT_MOTIFS)) {
      expect(motif.length, id).toBeGreaterThan(5);
      expect(motif.length, id).toBeLessThanOrEqual(60);
      expect(motif, id).not.toMatch(/[!?]|https?:|www\.|출처|원문|퍼옴|링크|\d{4}\s*년/);
    }
  });

  it('플래그 표: 켜는 이벤트가 있는 모든 플래그가 한 줄씩 있다', () => {
    const flagRows = doc.split('\n').filter((l) => /^\| `[a-z_0-9]+` \| /.test(l));
    expect(flagRows.length).toBeGreaterThanOrEqual(25);
    for (const f of ['has_partner', 'married', 'has_child', 'close_friend', 'exam_prep', 'health_ignored']) {
      expect(flagRows.some((l) => l.startsWith(`| \`${f}\` |`)), f).toBe(true);
    }
  });
});
