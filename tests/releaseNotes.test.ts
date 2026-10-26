import { describe, expect, it } from 'vitest';
import { compareVersions, hasUnseenNotes, VERSION_PATTERN } from '../src/core/build';
import { APP_VERSION } from '../src/buildInfo';
import { INFO_TEXT, NOTES_OPEN_COUNT } from '../src/data/infoText';
import { NOTE_ITEMS_MAX, NOTE_ITEM_MAX_CHARS, NOTE_KINDS, NOTE_KIND_TEXT, RELEASE_NOTES, noteOf, type ReleaseNote } from '../src/data/releaseNotes';
import pkg from '../package.json';
import copyMd from '../docs/design/copy.md?raw';

/**
 * 새 소식(업데이트 노트) 데이터 규칙 (SPEC-005 NT1~NT3·NT5, 완료 기준 12, 마스터 결정 N1·N5): `src/data/releaseNotes.ts`가 단일 기준이다.
 *  ⑥ 현재 `APP_VERSION`의 노트가 반드시 있다 — 버전을 올리고 노트를 안 쓰는 배포를 막는다.
 *  ① 버전당 항목 ≤ 8 · 항목 ≤ 70자 ② 서술은 **해요체**(한 패널 안에 두 어체를 섞지 않는다), 느낌표·이모지 없음 ③ 내부 식별자 없음 ④ 사람 이름·연락처 없음 ⑦ 버전은 단조 감소, 날짜 `YYYY-MM-DD`.
 * 다른 게임의 문장·고유 명칭(⑤)은 사람이 원문과 대조한다(마스터 M17) — 이 시험은 기계가 잡을 수 있는 것만 본다.
 */

/** 내부 식별자: `SPEC-`·`R-숫자`·`M숫자`·`QI숫자`·`QA`·커밋 해시·파일 경로·확장자 */
const INTERNAL = /SPEC-|\bR-\d|\bM\d|\bQI\d|\bQA\b|\b[0-9a-f]{7,}\b|\.(?:ts|tsx|md|json)\b|src\/|docs\//u;
const EMOJI = /\p{Extended_Pictographic}/u;
const CONTACT = /@|https?:|www\.|\d{2,4}-\d{3,4}-\d{4}|[A-Za-z0-9._-]+@[A-Za-z0-9.-]+/;
/** 과장·평가어 (초안 1-4절) */
const HYPE = /훨씬|대폭|완벽|혁신|한결/;

/** 「…」로 인용한 화면 문구(게임 안 도장 「이렇게 흘러갔습니다」 같은 합쇼체 인용)는 서술이 아니라 인용이라 어체 판정에서 뺀다 */
const stripQuoted = (t: string): string => t.replace(/「[^」]*」/g, '');
/** 문장 끝: 마침표 앞 글자는 모두 「요」(해요체) */
function sentencesOf(text: string): string[] {
  return stripQuoted(text)
    .split(/(?<=[.?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}
const isHaeyo = (sentence: string): boolean => /요[.?]$/.test(sentence);

describe('새 소식 데이터 (NT3)', () => {
  it('현재 APP_VERSION의 노트가 있고 package.json의 버전과 같은 값이다 (NT1·NT3 ⑥) — 버전만 올리고 노트를 안 쓰는 배포를 막는다', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(noteOf(APP_VERSION), `v${APP_VERSION}의 노트가 src/data/releaseNotes.ts에 없다`).toBeDefined();
    expect(RELEASE_NOTES[0].version, '최신 노트가 맨 위이고 지금 버전이다').toBe(APP_VERSION);
  });

  it('버전은 x.y.z 꼴이고 0.MINOR.PATCH(NT1)이며 최신이 위(단조 감소), 같은 버전이 둘 없다', () => {
    for (const n of RELEASE_NOTES) {
      expect(n.version, n.version).toMatch(VERSION_PATTERN);
      expect(n.version.startsWith('0.'), `1.0.0은 정하지 않는다(NT1): ${n.version}`).toBe(true);
    }
    for (let i = 1; i < RELEASE_NOTES.length; i++) {
      const order = compareVersions(RELEASE_NOTES[i - 1].version, RELEASE_NOTES[i].version);
      expect(order, `${RELEASE_NOTES[i - 1].version} → ${RELEASE_NOTES[i].version}`).not.toBeNull();
      expect(order!, '위쪽이 더 높다').toBeGreaterThan(0);
    }
    expect(new Set(RELEASE_NOTES.map((n) => n.version)).size).toBe(RELEASE_NOTES.length);
  });

  it('날짜는 YYYY-MM-DD이고 실제 달력에 있는 날이며 위쪽 버전이 아래쪽보다 앞서지 않는다', () => {
    for (const n of RELEASE_NOTES) {
      expect(n.date, n.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const d = new Date(`${n.date}T00:00:00Z`);
      expect(Number.isNaN(d.getTime()), `${n.version}: ${n.date}`).toBe(false);
      expect(d.toISOString().slice(0, 10)).toBe(n.date);
    }
    for (let i = 1; i < RELEASE_NOTES.length; i++) expect(RELEASE_NOTES[i - 1].date >= RELEASE_NOTES[i].date, '날짜는 줄지 않는다').toBe(true);
    // v0.1.0은 1차 릴리스 선언일(소급 작성)
    expect(noteOf('0.1.0')?.date).toBe('2026-10-20');
  });

  it('버전당 항목 ≤ 8, 항목 ≤ 70자(공백·문장부호 포함), 항목이 하나도 없는 버전이 없고 종류는 네 가지(추가·개선·수정·내용)다', () => {
    expect(NOTE_ITEMS_MAX).toBe(8);
    expect(NOTE_ITEM_MAX_CHARS).toBe(70);
    for (const n of RELEASE_NOTES) {
      expect(n.items.length, n.version).toBeGreaterThan(0);
      expect(n.items.length, n.version).toBeLessThanOrEqual(NOTE_ITEMS_MAX);
      for (const it of n.items) {
        expect(NOTE_KINDS as readonly string[], `${n.version}: ${it.text}`).toContain(it.kind);
        expect([...it.text].length, `${n.version}: ${it.text}`).toBeLessThanOrEqual(NOTE_ITEM_MAX_CHARS);
        expect(it.text.trim(), '앞뒤 공백').toBe(it.text);
      }
    }
    expect(Object.values(NOTE_KIND_TEXT)).toEqual(['추가', '개선', '수정', '내용']);
    for (const t of Object.values(NOTE_KIND_TEXT)) expect([...t].length, '두 글자 칩').toBe(2);
  });

  it('내부 식별자(SPEC-·R-·M7·QI·QA·커밋 해시·파일 경로)가 없다 — 요약·항목 모두', () => {
    for (const n of RELEASE_NOTES) {
      for (const t of [n.summary, ...n.items.map((i) => i.text)]) expect(t, `${n.version}: ${t}`).not.toMatch(INTERNAL);
    }
  });

  it('느낌표·이모지·과장어·연락처(메일·주소·전화)가 없다 (담담한 어조, 이름·연락처 비공개 M15)', () => {
    for (const n of RELEASE_NOTES) {
      for (const t of [n.summary, ...n.items.map((i) => i.text)]) {
        expect(t, t).not.toMatch(/[!！]/);
        expect(t, t).not.toMatch(EMOJI);
        expect(t, t).not.toMatch(HYPE);
        expect(t, t).not.toMatch(CONTACT);
      }
    }
  });

  it('서술은 해요체다 (N1) — 요약·항목의 모든 문장이 「~요.」로 끝난다 (「…」로 인용한 게임 안 문구는 판정에서 뺀다), 합쇼체 종결(~습니다·~입니다)이 서술에 섞이지 않는다', () => {
    for (const n of RELEASE_NOTES) {
      for (const t of [n.summary, ...n.items.map((i) => i.text)]) {
        const sentences = sentencesOf(t);
        expect(sentences.length, t).toBeGreaterThan(0);
        for (const s of sentences) {
          expect(isHaeyo(s), `${n.version}: 「${s}」`).toBe(true);
          expect(s, `${n.version}: 합쇼체 종결`).not.toMatch(/(?:습니다|입니다|합니다)[.?]$/);
        }
      }
    }
  });

  it('요약은 한 줄(한 문장)이고 비어 있지 않다', () => {
    for (const n of RELEASE_NOTES) {
      expect(n.summary.length, n.version).toBeGreaterThan(0);
      expect(sentencesOf(n.summary), n.version).toHaveLength(1);
    }
  });

  it('copy.md 13-2 확정 문구와 글자 그대로 같다 — v0.2.0 항목 8개와 요약, v0.1.0 요약 (문구는 designer 소유)', () => {
    const sec = copyMd.slice(copyMd.indexOf('### 13-2.'), copyMd.indexOf('### 13-3.'));
    const v2 = noteOf('0.2.0') as ReleaseNote;
    expect(sec).toContain(`요약 **「${v2.summary}」**`);
    for (const it of v2.items) expect(sec, it.text).toContain(`| ${NOTE_KIND_TEXT[it.kind]} | ${it.text} |`);
    expect(v2.items).toHaveLength(8);
    const v1 = noteOf('0.1.0') as ReleaseNote;
    expect(sec).toContain(`요약 **「${v1.summary}」**`);
    for (const it of v1.items) expect(sec, it.text).toContain(it.text);
    expect(v1.items).toHaveLength(8);
  });
});

describe('v0.2.1 새 소식 (SPEC-005 r4 UXN-1 — copy.md 15-7)', () => {
  it('v0.2.1 항목 다섯은 copy.md 15-7 확정 제안 표와 글자 그대로 같고, 여섯째(QI13 5세 인용 교체)와 요약은 NT3 규칙을 지키는 developer 제안이다 — 날짜는 main 배포일', () => {
    const sec = copyMd.slice(copyMd.indexOf('### 15-7.'), copyMd.indexOf('### 15-8.'));
    expect(sec.length, 'copy.md에 15-7절이 있다').toBeGreaterThan(100);
    const kindOf: Record<string, string> = { 추가: 'new', 개선: 'better', 수정: 'fixed', 내용: 'content' };
    const rows = [...sec.matchAll(/^\| (추가|개선|수정|내용) \| (.+) \| \d+ \|$/gm)].map((m) => ({ kind: kindOf[m[1]], text: m[2] }));
    expect(rows, 'copy.md 15-7 표').toHaveLength(5);
    const v = noteOf('0.2.1') as ReleaseNote;
    expect(v.items.slice(0, 5)).toEqual(rows);
    expect(v.items, '다섯 + QI13 한 줄').toHaveLength(6);
    expect(v.items[5].kind).toBe('content');
    expect(v.items[5].text).toContain('다섯 살');
    expect(v.date, 'main 배포일(2026-10-27, 마스터가 배포 때 고침)').toBe('2026-10-27');
    // R-504: 요약의 「한 줄로 모였어요」는 PC에서만 사실이다(휴대폰·태블릿 < 960px은 그대로) — 요약이 그 조건을 밝힌다 (마스터 2026-10-27)
    expect(v.summary).toBe('결정 카드에 질문과 풀이가 생기고, PC에서는 진행·도구 버튼이 한 줄로 모였어요.');
    expect([...v.summary].length, '요약도 70자 이하').toBeLessThanOrEqual(NOTE_ITEM_MAX_CHARS);
    // 옛 이름은 이 한 곳(개선 항목 — 이름을 바꿨다는 사실을 알리는 글)에만 남는다: 완료 기준 3의 「옛 이름 0건」 점검이 이 파일을 예외로 둔다(tests/foldRename.test.ts)
    expect(RELEASE_NOTES.flatMap((n) => n.items).filter((it) => /카드[ ]접기/.test(it.text))).toHaveLength(1);
  });
});

describe('새 소식 표시 규칙 (NT4) — 버전 비교와 「새」 표시', () => {
  it('compareVersions는 숫자 비교다 (0.10.0 > 0.9.0), 꼴이 다르면 null', () => {
    expect(compareVersions('0.2.0', '0.1.0')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0);
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0);
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('0.2.10', '0.2.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0);
    for (const bad of ['', '0.2', '0.2.0.1', 'v0.2.0', '0.2.x', ' 0.2.0', '-1.0.0']) {
      expect(compareVersions(bad, '0.1.0'), bad).toBeNull();
      expect(compareVersions('0.1.0', bad), bad).toBeNull();
    }
  });

  it('hasUnseenNotes: 지금 버전이 마지막으로 본 버전보다 높으면 참 — 본 적 없음(빈 글자·이상한 값)이면 참, 같거나 낮으면 거짓, 지금 버전의 꼴을 못 읽으면 거짓', () => {
    expect(hasUnseenNotes('0.2.0', '')).toBe(true);
    expect(hasUnseenNotes('0.2.0', 'abc')).toBe(true);
    expect(hasUnseenNotes('0.2.0', '0.1.0')).toBe(true);
    expect(hasUnseenNotes('0.2.0', '0.2.0')).toBe(false);
    expect(hasUnseenNotes('0.2.0', '0.3.0')).toBe(false);
    expect(hasUnseenNotes('0.10.0', '0.9.0')).toBe(true);
    expect(hasUnseenNotes('', '')).toBe(false);
    expect(hasUnseenNotes('개발', '')).toBe(false);
  });

  it('패널 상수: 최신 3개 버전만 펼친다 (NT4), 구역 이름은 copy.md 13-1 확정 이름이다', () => {
    expect(NOTES_OPEN_COUNT).toBe(3);
    const sec = copyMd.slice(copyMd.indexOf('### 13-1.'), copyMd.indexOf('### 13-2.'));
    for (const t of [INFO_TEXT.panelTitle, INFO_TEXT.newsName, INFO_TEXT.introName, INFO_TEXT.newsLead, INFO_TEXT.introLead, INFO_TEXT.close, INFO_TEXT.badge, INFO_TEXT.badgeSr]) expect(sec, t).toContain(t);
    for (const t of [INFO_TEXT.newsLead, INFO_TEXT.introLead]) expect(sentencesOf(t).every(isHaeyo), t).toBe(true);
  });
});
