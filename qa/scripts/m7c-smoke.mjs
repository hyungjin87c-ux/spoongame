// M7c 스모크: 오라클로 평범한 인생 상태를 만들고 prod에서 「생각 남기기」 시트를 연다.
import { launch, openOracle, plainLife, openSeeded, openManual, readNote, readLog, readSave, noteRowsOf, putText, shot, sleep, PROD } from './m7c-lib.mjs';
const b = await launch();
const { page: oracle } = await openOracle(b);
const st = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
console.log('state', st.phase, st.age, st.paused, Object.keys(st.seen).length);
const { page } = await openSeeded(b, st);
await openManual(page);
console.log(JSON.stringify(await readNote(page), null, 1));
await putText(page, '여섯 살 여름의 매미 소리');
console.log('after', (await readNote(page)).count);
await shot(page, 'smoke');
await page.getByTestId('note-save').tap();
await sleep(500);
console.log(JSON.stringify(await readLog(page)));
console.log(JSON.stringify(noteRowsOf(await readSave(page))));
await b.close();
