// QA-003 M7e 3회차 최종 집계(C20 재확인과 관련 케이스): 수확·플레이·감사·바뀐 문장·풀 비교 결과를 읽어 케이스를 cases.jsonl에 덧붙인다(스크립트가 직접 기록한 C20·L02b·L02c는 건드리지 않는다).
// 사용: QA_OUT=qa/results/m7e/r3 QA_SHOT_PREFIX=M7e-r3 node qa/scripts/m7e-r3-final.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, addCase, SHOT_DIR } from './m7e-lib.mjs';

const J = (f, d = null) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) : d);
const casesPath = path.join(OUT, 'cases.jsonl');
const mine = /^M7e-(S01|S02|P01|L02|C10|X01|T03c)$/;
fs.writeFileSync(casesPath, fs.readFileSync(casesPath, 'utf8').trim().split('\n').filter((l) => !mine.test(JSON.parse(l).id)).join('\n') + '\n');
const have = new Set(fs.readdirSync(SHOT_DIR));
const shotsOf = (...ns) => ns.map((n) => `${n}.png`).filter((n) => have.has(n)).map((n) => `qa/screenshots/003/${n}`);
const R = (n) => n.toLocaleString('ko-KR');

const chg = J('changed-sentences.json');
const stat = J('static-pool.json');
const diff = J('diff-r2-r3.json');
const an = J('analysis.json');
const audit = J('audit-summary.json');
const plays = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((t) => J(`play-${t}.json`)).filter(Boolean);

// 표본(수확 + 플레이)
const lives = [];
for (const f of fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[a-z]\d?\.jsonl$/.test(f))) for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').split(String.fromCharCode(10))) { if (!line.trim()) continue; const r = JSON.parse(line); if (r.final) lives.push(r); }

// ---------------- S01 ----------------
{
  const labelRow = chg.rows.find((r) => /middle-parents-farewell\/share 라벨/.test(r.loc));
  addCase({ id: 'M7e-S01', cat: '바뀐 곳', title: `10절 문장·라벨이 JSON과 화면에 맞는다: 새 문장 ${chg.staticNew}개(${chg.pairs}행) + 10-9절 라벨 「일가친척과 의논해 치른다」`, steps: `docs/data/content-M7e.md 10절 표의 (지금 → 새) 문장을 파싱해 ① 이벤트 JSON에 새 문장이 있는지 ② 바뀐 옛 문장(2회차의 줄인 라벨 「가족·친척과 …」 포함)이 남았는지 ③ 이번 표본 ${chg.lives}판(수확 60 + 플레이 9)의 화면에서 새 문장이 보였는지 센다. 라벨은 10-9절 문안으로 대조. 그리고 2회차 화면 글(374판)과 지금 JSON을 견줘 「바뀐 것은 라벨 한 곳뿐」을 확인(diff-r2-r3)`, expected: '새 문장 누락 0, 옛 문장·옛 라벨 잔존 0, 2회차 대비 바뀐 글 = 라벨 한 곳', verdict: chg.staticNewMiss === 0 && chg.oldLeft === 0 && chg.oldOnScreen === 0 && diff.bodyMiss.length === 0 && diff.resMiss.length === 0 && diff.labelsAdded.length === 1 && diff.labelsRemoved.length === 1 && diff.labelsAdded[0] === '일가친척과 의논해 치른다' && diff.labelsRemoved[0] === '가족·친척과 의논해 치른다' ? 'PASS' : 'FAIL', actual: `새 문장 ${chg.staticNew}개 중 누락 ${chg.staticNewMiss}, 옛 문장·옛 라벨 잔존 ${chg.oldLeft}(화면에서도 ${chg.oldOnScreen}). 라벨 「일가친척과 의논해 치른다」는 JSON에 있고 화면(선택지·연표 줄)에서 ${labelRow.seen}번 읽힘, 결과 문장 「가족이나 친척과 역할을 나누어 장례를 치렀습니다…」도 ${chg.rows.find((r) => /farewell\/share 결과/.test(r.loc)).seen}번. 이번 표본(${chg.lives}판)에서 새 문장 ${chg.newOnScreenSentences}/${chg.staticNew}개를 화면에서 봤고 나머지 ${chg.newNeverOnScreen}개(표본 크기 탓, 흔치 않은 이벤트)는 2회차에서 화면 확인 완료(374판 111/111)·이번에 JSON 글자가 2회차 화면 글과 같음을 확인. 2회차 화면 글 대비: 본문 ${diff.poolBodies}개·결과 ${diff.poolResults}개 모두 같고 못 찾은 것 0, 라벨은 추가 「${diff.labelsAdded}」·제거 「${diff.labelsRemoved}」 한 쌍뿐`, shots: shotsOf('M7e-r3-N01-1-farewell-card-age54', 'M7e-r3-N01-1-farewell-after-age54') });
  addCase({ id: 'M7e-S02', cat: '바뀐 곳', title: '풀 지표(독립 측정)와 lint 규칙 「라벨·제목은 한글과 공백만」: 이벤트 140개 본문·결과·라벨·제목', steps: '이벤트 JSON을 직접 읽어 정규식으로 센다(developer의 시험과 따로): 합쇼체 아닌 문장·8음절 이상 어절·라벨 6음절 이상 어절·「~지만」·「~수 있었습니다」, 라벨·제목의 한글·공백 외 글자', expected: '합쇼체 외 0, 8음절 이상 어절 0, 라벨 어절 ≤ 5음절, 한글·공백 외 글자 0 (2회차 수치 유지: 31.0%·4)', verdict: stat.S1.length === 0 && stat.S2.length === 0 && stat.S2label.length === 0 && stat.S7.length === 0 && diff.nonHangulLabelsTitles.length === 0 ? 'PASS' : 'FAIL', actual: `합쇼체 아닌 문장 ${stat.S1.length}/${stat.S3.sentences}, 8음절 이상 어절 ${stat.S2.length}, 6음절 이상 라벨 어절 ${stat.S2label.length}(라벨 어절 최대 ${diff.maxLabelWordSyllables}음절 ${diff.maxLabelWordWhere}), 같은 끝 구절 연속 ${stat.S7.length}. 라벨·제목 중 한글·공백 외 글자(가운뎃점·쉼표·괄호·슬래시·숫자·영문)가 든 것 ${diff.nonHangulLabelsTitles.length}개(2회차: 라벨 1개). 「가족·친척」 ${stat.S6['가족·친척'].length}곳, 「일가친척」 ${stat.S6['일가친척'].length}곳, 「가족이나 친척」 ${stat.S6['가족이나 친척'].length}곳. 「~지만」 결과 80/258=31.0%, 「~수 있었습니다」 결과 ${stat.S4.filter((x) => x.kind === '결과').length}(2회차와 같음)`, shots: shotsOf('M7e-r3-L02c-farewell-360x740-100') });
}

// ---------------- P01 부모 임종 카드 표본 ----------------
{
  const NEW = '일가친척과 의논해 치른다';
  const RES = '가족이나 친척과 역할을 나누어 장례를 치렀습니다. 슬픔 한가운데서도 오랜만에 한자리에 모였습니다.';
  const bad = [];
  let cards = 0, shown = 0, picked = 0, rowOk = 0, noSib = 0, solo = 0, soloShown = 0, goneAfter = 0, oldLabel = 0, symbolLabels = 0, allLabels = 0;
  const dwAfter = {};
  for (const l of lives) {
    for (const d of l.decisions) {
      for (const c of d.choices) {
        allLabels++;
        if (/[^가-힣 ]/.test(c.label)) { symbolLabels++; bad.push(`${l.era} ${l.seed}: 라벨에 기호 「${c.label}」`); }
        if (/가족·친척/.test(c.label)) oldLabel++;
      }
      if ((d.key || '').split('@')[0] !== 'middle-parents-farewell') continue;
      cards++;
      const share = d.choices.find((c) => c.id === 'share');
      if (share && share.label === NEW) shown++; else bad.push(`${l.era} ${l.seed}: farewell 카드 share 라벨 「${share?.label}」`);
      const fam = d.family || '';
      if (/형제자매없음/.test(fam) && /배우자없음/.test(fam) && /자녀없음/.test(fam)) { solo++; if (share && share.label === NEW) soloShown++; }
      if (/형제|동생|언니|오빠|누나/.test(d.text + d.choices.map((c) => c.label).join(' '))) { if (/형제자매없음/.test(fam)) bad.push(`${l.era} ${l.seed}: 외동 판에 형제 낱말`); }
      if (d.picked === 'share') {
        picked++;
        const i = l.final.history.findIndex((h) => h.eventId === 'middle-parents-farewell');
        const row = l.final.history[i];
        if (row && row.choice === NEW && row.text === RES) rowOk++; else bad.push(`${l.era} ${l.seed}: 연표 줄 ${row ? '「' + row.choice + '」「' + row.text + '」' : '없음'}`);
        const sn = l.snaps || [];
        const after = sn.find((x) => x.hl >= i + 1);
        if (after && after.fl.includes('parents_gone')) goneAfter++; else bad.push(`${l.era} ${l.seed}: 고른 뒤 parents_gone 없음`);
        const k = after ? after.dw : '?';
        dwAfter[k] = (dwAfter[k] ?? 0) + 1;
      }
    }
  }
  const playF = plays.filter((p) => p.decisions.some((d) => /^middle-parents-farewell/.test(d.key)));
  const playBad = [];
  for (const p of plays) {
    if (p.errors.length) playBad.push(`${p.tag}: 오류 ${p.errors}`);
    if (p.console.length) playBad.push(`${p.tag}: 콘솔 ${p.console.length}`);
    if (p.externalRequests.length) playBad.push(`${p.tag}: 외부 요청 ${p.externalRequests.length}`);
    if (p.ending.f.length) playBad.push(`${p.tag}: 엔딩 판정 ${p.ending.f}`);
  }
  addCase({ id: 'M7e-P01', cat: '1회차 FAIL 재확인', title: '이 라벨이 나오는 판(부모 임종 카드) 표본 플레이: 화면의 선택지 라벨·연표 줄·상태가 10-9절대로, 라벨에 기호 0', steps: `prod에서 정상 플레이 ${plays.length}판(모바일 360×740 ${plays.filter((p) => p.vpName === 'm360').length}판 + 데스크톱 1280×800 ${plays.filter((p) => p.vpName !== 'm360').length}판, 8배속, 임종 카드는 「일가친척과 의논해 치른다」 선택)과 개발 서버 수확 60판(share 우선)에서 임종 카드가 뜬 판의 라벨·연표 줄·저장 상태를 읽는다`, expected: '임종 카드 share 라벨 = 10-9절 문안, 고른 뒤 연표 줄(선택 문구·결과 문장)과 parents_gone이 맞고, 모든 선택지 라벨이 한글·공백뿐', verdict: bad.length || playBad.length || oldLabel ? 'FAIL' : playF.length >= 3 ? 'PASS' : 'FAIL', actual: bad.length || playBad.length ? [...bad, ...playBad].slice(0, 5).join(' / ') : `표본 ${lives.length}판에서 임종 카드 ${cards}장 모두 share 라벨 「${NEW}」(${shown}/${cards}), 옛 라벨 「가족·친척…」 ${oldLabel}. 고른 ${picked}판 모두 연표 줄 = 「선택: ${NEW}」 + 「${RES.slice(0, 22)}…」(${rowOk}/${picked}), parents_gone 켜짐 ${goneAfter}/${picked}, 고른 뒤 주거 ${Object.entries(dwAfter).map(([k, v]) => `${k} ${v}`).join('·')}. 식구가 부모뿐인 판 ${solo}장 모두 새 라벨 보임(${soloShown}/${solo}). 화면의 선택지 라벨 ${R(allLabels)}개 중 한글·공백 외 글자 ${symbolLabels}. 정상 플레이 ${plays.length}판 중 임종 카드가 뜬 판 ${playF.length}판(${playF.map((p) => `${p.tag}:${p.era}·${p.vpName}·${p.decisions.find((d) => /^middle-parents-farewell/.test(d.key)).age}세`).join(' ')}) — 카드 화면과 선택 뒤 인생 기록 스크린샷을 찍음, 오류·콘솔·외부 요청 0, 엔딩 판정 통과`, shots: shotsOf('M7e-r3-N01-1-farewell-card-age54', 'M7e-r3-N01-1-farewell-after-age54', 'M7e-r3-N01-7-farewell-card-age54', 'M7e-r3-N01-9-farewell-after-age64') });
}

// ---------------- L02(감사) · C10(포커스) ----------------
if (audit) {
  const g = audit.layout;
  const v = g['결정카드'];
  if (v) addCase({ id: 'M7e-L02', cat: '1회차 FAIL 재확인', title: `결정 카드(임종 3종·돌봄 짝·대조 2종) × 11뷰포트 × 글자 100·150·200% = ${v.combos}조합: 가로 넘침·낱말 끊김·글 잘림 0`, steps: `카드 ${v.states}종을 prod에서 열어 문서 가로 넘침·요소 밖·낱말 끊김(독립 측정기)·글 잘림·영향 줄 칸 밖을 잰다`, expected: '위반 0(CM11·QM3-1), 한 줄보다 넓은 낱말 0', verdict: v.bad === 0 && v.errs === 0 ? 'PASS' : 'FAIL', actual: v.bad === 0 ? `${v.combos}조합 위반 0·측정 오류 ${v.errs}, 한 줄보다 넓은 낱말 ${v.unavoidable}` : `${v.bad}/${v.combos}조합 위반: ${v.examples.slice(0, 3).join(' | ')}`, shots: shotsOf('M7e-r3-L02c-farewell-320x568-200', 'M7e-r3-L02c-farewell-360x740-100') });
  const f = audit.focus;
  if (f) {
    const total = Object.values(f).reduce((n, x) => n + x.combos, 0);
    const bad = Object.values(f).reduce((n, x) => n + x.bad, 0);
    const errs = Object.values(f).reduce((n, x) => n + x.errs, 0);
    addCase({ id: 'M7e-C10', cat: '접근성', title: '키보드 포커스 가림 0(CM10): 부모 임종 카드 3종 × 11뷰포트 × 글자 100·200%', steps: `카드 3종 = ${total}조합에서 Tab 순회마다 포커스 링 상자와 고정 요소 상자의 겹침·화면 밖·중심점 가림을 잰다`, expected: '가림 0·못 닿음 0', verdict: bad === 0 && errs === 0 ? 'PASS' : 'FAIL', actual: bad === 0 ? `${total}조합 가림 0·못 닿음 0${errs ? ', 측정 오류 ' + errs : ''}` : `${bad}/${total}조합 위반`, shots: shotsOf('M7e-r3-C20-farewell-share-label') });
  }
}
// ---------------- T08 읽기에서 남는 것 ----------------
{
  let both = 0, lives2 = 0;
  for (const l of lives) {
    const h = l.final.history;
    const a = h.findIndex((x) => x.eventId === 'middle-parents-care' && x.choice === '가족이나 친척과 나누어 맡는다');
    const b = h.findIndex((x) => x.eventId === 'middle-parents-farewell' && x.choice === '일가친척과 의논해 치른다');
    if (a >= 0 && b >= 0) { both++; }
    if (b >= 0) lives2++;
  }
  const L0 = fs.readFileSync(casesPath, 'utf8').trim().split('\n').map((x) => JSON.parse(x)).filter((r) => r.id !== 'M7e-T08');
  fs.writeFileSync(casesPath, L0.map((r) => JSON.stringify(r)).join('\n') + '\n');
  addCase({ id: 'M7e-T08', cat: '문장 품질', title: '읽기: 새 라벨이 같은 판의 다른 말과 어울리는가(낮은 심각도 기록)', steps: `표본 ${lives.length}판의 인생 기록을 읽는다(부모 병환 → 임종이 두 해 간격으로 이어지는 판)`, expected: '(주관 점검 — 낮은 심각도는 기록)', verdict: 'RECORD', actual: `부모 병환 카드의 「가족이나 친척과 나누어 맡는다」(구어)와 임종 카드의 「일가친척과 의논해 치른다」(한자어)를 둘 다 고른 판 ${both}판에서 두 줄이 몇 해 간격으로 나란히 보여 같은 사람들을 다르게 부르는 느낌이 있고(스크린샷 farewell-after-age54: 52세 「가족이나 친척과 나누어 맡는다」, 54세 「일가친척과 의논해 치른다」), 임종 결과 문장은 「가족이나 친척과 …」로 라벨과 결과도 다르게 부른다. planner 10-9절이 의도한 선택(짝 라벨은 그대로, 장례 장면의 자연스러운 낱말)이고 뜻은 같아 결함이 아니다 — 용어를 맞출지는 planner 판단. 「일가친척과 의논해 치른다」를 고른 판 ${lives2}판 모두 뜻이 어색하지 않게 읽힘`, shots: shotsOf('M7e-r3-N01-7-farewell-after-age54') });
}
// ---------------- X01 ----------------
{
  const L = fs.readFileSync(casesPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const ext = L.reduce((n, r) => n + (r.externalRequests ?? []).length, 0) + plays.reduce((n, p) => n + p.externalRequests.length, 0);
  const con = L.flatMap((r) => (r.console ?? []).map((c) => c.text)).length + plays.reduce((n, p) => n + p.console.length, 0);
  addCase({ id: 'M7e-X01', cat: '환경', title: `외부 요청 0·콘솔 오류 0: 3회차 케이스와 플레이 ${plays.length}판`, steps: '케이스마다 페이지 요청 중 127.0.0.1·localhost 밖의 요청과 콘솔 오류·경고를 모았다', expected: '0', verdict: ext === 0 && con === 0 ? 'PASS' : 'FAIL', actual: `외부 요청 ${ext}건, 콘솔 오류·경고 ${con}건`, shots: [] });
}

// ---------------- 스크린샷 붙이기 + 같은 ID 중복 정리 ----------------
{
  const attach = {
    'M7e-C20': ['C20-farewell-share-label'],
    'M7e-L02b': ['L02c-farewell-320x568-200'],
    'M7e-L02c': ['L02c-farewell-360x740-100', 'L02c-farewell-320x568-200'],
    'M7e-X01': [],
  };
  const L = fs.readFileSync(casesPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const last = new Map();
  for (const r of L) last.set(r.id, r);
  const out = [...last.values()].map((r) => {
    if (r.id === 'M7e-C20' && !r.actual.includes('접근성 이름 원문')) {
      const nd = J('c20-name-detail.json', []);
      const sh = nd.filter((x) => x.id === 'choice-share');
      r.actual += ` — 2회차와 같은 범위(2회차 카드 29종·버튼 85개)를 포함한 33종·97개. 접근성 이름 원문(CDP): ${sh.map((x) => `${x.card} 「${x.name}」`).slice(0, 2).join(' / ')} — 기호 ${sh.reduce((n, x) => n + x.nonHangulSymbols.length, 0)}개. 2회차 FAIL이던 farewell share 3종(plain·moved·past)이 모두 통과`;
    }
    if ((!r.shots || !r.shots.length) && attach[r.id]) r.shots = attach[r.id].map((n) => `qa/screenshots/003/M7e-r3-${n}.png`).filter((p) => fs.existsSync(p));
    return r;
  });
  fs.writeFileSync(casesPath, out.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const by = {};
  for (const r of out) by[r.verdict] = (by[r.verdict] ?? 0) + 1;
  console.log('총', out.length, by, '스크린샷 없는 케이스', out.filter((r) => !r.shots?.length).map((r) => r.id).join(' '));
}
