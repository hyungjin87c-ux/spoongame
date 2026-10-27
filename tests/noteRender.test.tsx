import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NOTE_LIMITS, finalizeNote, notesOf, type EndingGame, type HistoryEntry } from '../src/core';
import { NOTE_MANUAL } from '../src/data/noteCards';
import { NOTE_TEXT } from '../src/data/noteSheetText';
import { EndingScreen } from '../src/screens/EndingScreen';
import { LogCard } from '../src/ui/dash/LogCard';
import { NoteBody, NoteLabel, NoteText } from '../src/ui/dash/NoteText';
import { startLife } from '../scripts/simulateLib';
import { playSession, writeIt } from './helpers/notes';

/**
 * 「나의 기록」 줄의 안전한 표시 (SPEC-003 M7c FR4·FR5·FR9, content-M7c 4-1절 D1~D5·D8, 3-8절 A1·A2·A10·A15·A16): 사용자가 쓴 글은 React 텍스트 자식으로만 그리고, 인생 기록(LogCard)과
 * 엔딩 연표(TimelineItem)가 같은 부품(NoteText)을 쓴다. 폭에 따른 줄바꿈·넘침·방향 글의 기하(D4·A10)는 브라우저가 필요해 e2e/m7c-*.spec.ts가 본다.
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다 */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}

const ATTACKS: Array<{ id: string; text: string }> = [
  { id: 'A1', text: '<script>alert(1)</script>' },
  { id: 'A2', text: `'; DROP TABLE users;-- " ${String.fromCharCode(92)}n &amp; &lt;b&gt;` },
  { id: 'A10', text: 'שלום עולם مرحبا بالعالم' },
  { id: 'A15', text: '**굵게** [링크](http://x) # 제목' },
  { id: 'A16', text: `https://${'a'.repeat(120)}.example.com/path` },
  { id: '그림 문자', text: '👨\u200D👩\u200D👧 🇰🇷 👍🏽 1\uFE0F\u20E3' },
];

const noteEntry = (text: string, title: string | null = '영유아기 기억'): HistoryEntry => ({ age: 5, kind: 'note', text, ...(title === null ? {} : { title }), eventId: 'note-infant-memory' });

describe('NoteText: 사용자 글 한 덩어리 (D1·D2·D3·D5)', () => {
  it('<bdi dir="auto" data-user-text> 하나이고, 안에는 글자뿐이다(자식 요소 0) — 공격 입력 6종 모두', () => {
    for (const a of ATTACKS) {
      const html = renderToStaticMarkup(<NoteText text={a.text} />);
      expect(html.startsWith('<bdi '), a.id).toBe(true);
      expect(html, a.id).toContain(' dir="auto"');
      expect(html, a.id).toContain(' data-user-text=""');
      expect(html.endsWith('</bdi>'), a.id).toBe(true);
      const inner = html.slice(html.indexOf('>') + 1, html.length - '</bdi>'.length);
      expect(inner, `${a.id}: 안쪽에 태그가 없다`).not.toMatch(/<[a-z/]/i);
      // 글은 HTML로 해석되지 않는다: 열린 꺾쇠가 글자로 이스케이프돼 있다
      const decoded = inner.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
      expect(decoded, `${a.id}: 글이 그대로다`).toBe(a.text);
    }
  });

  it('A1 <script>: 실행 가능한 요소가 없다. A15 마크다운·A16 URL: 링크·서식·제목 요소가 없다 (<a>·<img>·<script>·<strong>·<em>·<h1> 0)', () => {
    for (const id of ['A1', 'A15', 'A16']) {
      const a = ATTACKS.find((x) => x.id === id)!;
      const html = renderToStaticMarkup(<NoteBody entry={noteEntry(a.text)} />);
      for (const tag of ['<a ', '<a>', '<img', '<script', '<strong', '<em>', '<h1', '<br', '<iframe', '<style', '<svg']) {
        if (tag === '<svg') continue; // 라벨의 연필 아이콘은 우리 그림이다(aria-hidden)
        expect(html, `${id} ${tag}`).not.toContain(tag);
      }
    }
  });

  it('A2: HTML 엔티티가 풀리지 않는다 — 글의 「&amp;」는 화면에도 「&amp;」 네 글자로 나온다', () => {
    const html = renderToStaticMarkup(<NoteText text={'&amp; &lt;b&gt;'} />);
    expect(html).toContain('&amp;amp; &amp;lt;b&amp;gt;');
  });

  it('줄바꿈은 글자 그대로 둔다(<br> 없음) — 보이는 것은 CSS white-space: pre-line (D3)', () => {
    const html = renderToStaticMarkup(<NoteText text={'첫 줄\n둘째 줄\n셋째 줄'} />);
    expect(html).toContain('첫 줄\n둘째 줄\n셋째 줄');
    expect(html).not.toContain('<br');
  });

  it('화면별 추가 클래스를 받아도 같은 요소다: 연표(tl-text)는 클래스만 더한다', () => {
    const a = renderToStaticMarkup(<NoteText text="x" />);
    const b = renderToStaticMarkup(<NoteText text="x" className="tl-text" />);
    expect(a).toBe('<bdi class="note-text" dir="auto" data-user-text="" data-testid="note-text">x</bdi>');
    expect(b).toBe('<bdi class="tl-text note-text" dir="auto" data-user-text="" data-testid="note-text">x</bdi>');
  });
});

describe('NoteLabel: 「나의 기록 · {주제}」 (D8, R-403 ⑤)', () => {
  it('연필 아이콘(aria-hidden) + FitPair — 한 줄 모양의 가운뎃점은 접근성 트리에서 숨는다: 낭독 「나의 기록 영유아기 기억」', () => {
    const html = renderToStaticMarkup(<NoteLabel topic="영유아기 기억" />);
    expect(html).toContain('<svg class="icon icon--sm" aria-hidden="true"');
    expect(html).toContain('<span aria-hidden="true">·</span>');
    // 낭독되는 글자: aria-hidden 조각(아이콘·기호·탐침)을 뺀 나머지
    const read = html
      .replace(/<svg[^>]*>[^]*?<\/svg>/g, '')
      .replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    expect(read).toBe('나의 기록 영유아기 기억');
    expect(NOTE_TEXT.rowLabel).toBe('나의 기록');
  });

  it('주제가 없는 줄(수동 기록)은 수동 기록의 주제 「지금의 생각」을 쓴다', () => {
    const html = renderToStaticMarkup(<NoteBody entry={noteEntry('오늘', null)} />);
    expect(html).toContain(`나의 기록 `);
    expect(html).toContain(NOTE_MANUAL.topic);
    expect(NOTE_MANUAL.topic).toBe('지금의 생각');
  });

  it('라벨은 사용자 글이 아니므로 data-user-text 표식이 없다(낱말 끊김 감사 대상 그대로) — 글 영역에만 있다', () => {
    const html = renderToStaticMarkup(<NoteBody entry={noteEntry('내 글')} />);
    expect(html.match(/data-user-text/g)).toHaveLength(1);
    const label = html.slice(0, html.indexOf('<bdi'));
    expect(label).not.toContain('data-user-text');
  });
});

describe('두 화면이 같은 부품을 쓴다 (D3, FR4·FR9)', () => {
  const entries: HistoryEntry[] = [
    { age: 0, kind: 'stage', text: '태어났다.' },
    noteEntry('다섯 살 무렵, 마루 끝에 앉아 있던 기억이 있다.\n햇볕이 따뜻했다.'),
    { age: 9, kind: 'event', text: '이사를 갔다.', title: '이삿짐' },
  ];

  it('인생 기록(LogCard): note 줄은 log__row--note이고 라벨 + 글(NoteText)이 들어 있으며, 다른 줄은 그대로다', () => {
    const html = renderToStaticMarkup(<LogCard history={entries} live={false} />);
    const rows = html.match(/<li class="log__row[^"]*"[^>]*data-kind="[a-z]+"[^>]*>[^]*?<\/li>/g)!;
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain('log__row--note');
    expect(rows[1]).toContain('data-testid="note-label"');
    expect(rows[1]).toContain('data-testid="note-text"');
    expect(rows[1]).toContain('다섯 살 무렵, 마루 끝에 앉아 있던 기억이 있다.\n햇볕이 따뜻했다.');
    expect(rows[0]).not.toContain('note-text');
    expect(rows[2]).not.toContain('note-text');
    expect(rows[2]).not.toContain('log__row--note');
    // 최신순(SPEC-005 LR1): 저장 순서는 [출생, 나의 기록, 이사]이고 화면은 거꾸로 — 첫 줄이 가장 최근(이사), 끝 줄이 출생. 가운데 줄(나의 기록)은 어느 순서든 가운데다
    expect(rows[0]).toContain('이사를 갔다.');
    expect(rows[0]).toContain('log__row--latest');
    expect(rows[2]).toContain('태어났다.');
    expect(rows[1]).not.toContain('log__row--latest');
  });

  it('엔딩 연표(TimelineItem)와 인생 기록 줄의 안쪽 마크업이 같은 부품이다: 라벨과 글 요소가 똑같고 연표는 글에 tl-text 클래스만 더한다', () => {
    const game = playSession(startLife(2024, 'alpha'), { respond: writeIt }).session.game as EndingGame;
    expect(game.phase).toBe('ending');
    const notes = notesOf(game);
    expect(notes.length).toBeGreaterThan(0);
    const ending = renderToStaticMarkup(<EndingScreen game={game} onRebirth={() => {}} />);
    const items = ending.match(/<li class="is-note"[^>]*data-kind="note"[^>]*>[^]*?<\/li>/g)!;
    expect(items, '연표의 note 줄 수 = 기록 수').toHaveLength(notes.length);
    // 시간순: 나이가 줄어들지 않는다
    const ages = items.map((li) => Number(/<span class="log__age">(\d+)세<\/span>/.exec(li)![1]));
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
    expect(ages).toEqual(notes.map((n) => n.age));
    // 같은 부품: 같은 줄을 인생 기록(LogCard)에 그린 것과 라벨·글 요소가 같다
    const logHtml = renderToStaticMarkup(<LogCard history={game.history} live={false} />);
    // 인생 기록은 최신순(SPEC-005 LR1)이라 뒤집어 연표(시간순)와 같은 순서로 맞대어 본다
    const logRows = logHtml.match(/<li class="log__row[^"]*log__row--note[^"]*"[^>]*>[^]*?<\/li>/g)!.reverse();
    expect(logRows).toHaveLength(notes.length);
    const part = (li: string, cls: string) => ({
      label: /<span class="log__note-label"[^]*?<\/span><\/span>(?=<bdi)/.exec(li)![0],
      text: new RegExp(`<bdi class="${cls}note-text"[^]*?</bdi>`).exec(li)![0],
    });
    for (let i = 0; i < notes.length; i++) {
      const e = part(items[i], 'tl-text ');
      const l = part(logRows[i], '');
      expect(e.label, `줄 ${i} 라벨`).toBe(l.label);
      expect(e.text.replace('tl-text ', ''), `줄 ${i} 글`).toBe(l.text);
    }
  });

  it('엔딩에서도 note 줄 하나 안의 요소는 라벨 + 글(격리 요소 하나)뿐이다 — 글 안에 요소가 없다', () => {
    const game = playSession(startLife(2024, 'alpha'), { respond: writeIt }).session.game as EndingGame;
    const ending = renderToStaticMarkup(<EndingScreen game={game} onRebirth={() => {}} />);
    for (const li of ending.match(/<li class="is-note"[^>]*>[^]*?<\/li>/g)!) {
      const bdi = /<bdi[^]*?<\/bdi>/.exec(li)![0];
      expect(bdi.slice(bdi.indexOf('>') + 1, -'</bdi>'.length)).not.toMatch(/<[a-z/]/i);
      expect(li.match(/<bdi/g)).toHaveLength(1);
    }
  });
});

describe('소스 점검: 사용자 글을 읽거나 새어 나가게 하는 코드가 없다 (D1·D5, P3, S8)', () => {
  const FILES = ['../src/ui/dash/NoteText.tsx', '../src/ui/dash/NoteSheet.tsx', '../src/ui/noteInput.ts', '../src/ui/noteFocus.ts', '../src/core/noteText.ts', '../src/core/notes.ts', '../src/screens/EndingScreen.tsx', '../src/ui/dash/LogCard.tsx'];
  const strip = (src: string) => src.replace(/\/\*[^]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

  it('dangerouslySetInnerHTML · innerHTML · <a> · <img> · console.* 가 없다', async () => {
    for (const f of FILES) {
      const code = strip(await readText(f));
      expect(code, `${f} dangerouslySetInnerHTML`).not.toContain('dangerouslySetInnerHTML');
      expect(code, `${f} innerHTML`).not.toMatch(/\.innerHTML|outerHTML|insertAdjacentHTML/);
      expect(code, `${f} console`).not.toMatch(/console\./);
      if (f.includes('Note')) {
        expect(code, `${f} <a>`).not.toMatch(/<a[\s>]/);
        expect(code, `${f} <img>`).not.toMatch(/<img[\s>]/);
      }
    }
  });

  it('NoteText는 글을 Glue·FitPair·Pair에 넣지 않는다(글을 바꾸지 않는다, D5) — 이 파일에서 그 부품은 라벨(NOTE_TEXT.rowLabel · 주제)에만 쓴다', async () => {
    const code = strip(await readText('../src/ui/dash/NoteText.tsx'));
    const textFn = code.slice(code.indexOf('export function NoteText'), code.indexOf('export function NoteBody'));
    expect(textFn).not.toMatch(/Glue|FitPair|Pair/);
    expect(code).toContain('<FitPair a={NOTE_TEXT.rowLabel} b={topic} hideSeparator />');
  });

  it('시트의 글 처리는 core의 finalizeNote/sanitizeLive만 쓴다: 한도는 NOTE_LIMITS 하나, 입력란에 maxlength=140이 없다', async () => {
    const code = strip(await readText('../src/ui/dash/NoteSheet.tsx'));
    expect(code).not.toMatch(/maxLength=\{140\}|maxlength="140"/i);
    expect(code).toContain('maxLength={4000}');
    expect(NOTE_LIMITS.graphemes).toBe(140);
    // 저장은 부모가 reducer로 한다 — 시트는 글을 저장소·주소·속성에 쓰지 않는다
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|document\.title|history\.(push|replace)State|location\./);
    expect(finalizeNote('  ', NOTE_LIMITS.graphemes).empty).toBe(true);
  });
});
