// Stage 2 regression: concurrent socket callers must not cross state.
//
// Before Stage 2, `pipe`, `buffer` and the output format were module globals.
// receive() saved and restored them around `await command(...)` — but an await
// yields, so a second client's request could overwrite them mid-flight. The
// observable symptoms were: a response carrying another client's output, or a
// response formatted as the OTHER caller requested.
//
// This test fires interleaved requests from two sockets, each asking for a
// different output format and reading a different key, then asserts every
// response matches its own request. It FAILS against pre-Stage-2 code.
//
// Usage: node test/socket-concurrency.mjs   (expects a realm on :8080)

import WebSocket from 'ws';

const WS = process.env.CNS_WS || 'ws://127.0.0.1:8080/';
const ROUNDS = Number(process.env.ROUNDS || 12);

const A = { sys: '77770000-0000-4000-8000-00000000000a', mark: 'AAAA-alpha', format: 'json' };
const B = { sys: '88880000-0000-4000-8000-00000000000b', mark: 'BBBB-bravo', format: 'xml' };

function open() {
  return new Promise((res, rej) => {
    const ws = new WebSocket(WS);
    ws.once('open', () => res(ws));
    ws.once('error', rej);
  });
}

// Each socket keeps its own transaction counter and resolves by transaction id.
function rpcFactory(ws) {
  let tx = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const p = pending.get(m.transaction);
    if (p) { pending.delete(m.transaction); p(m); }
  });
  return (command, format) => new Promise((resolve, reject) => {
    const transaction = ++tx;
    pending.set(transaction, resolve);
    ws.send(JSON.stringify({ transaction, format, command }));
    setTimeout(() => { pending.delete(transaction); reject(new Error('timeout')); }, 5000);
  });
}

let pass = 0, fail = 0;
const bad = [];
function check(ok, label) {
  if (ok) pass++; else { fail++; if (bad.length < 6) bad.push(label); }
}

async function main() {
  const wsA = await open(), wsB = await open();
  const rpcA = rpcFactory(wsA), rpcB = rpcFactory(wsB);

  // Seed one distinctive key per client.
  await rpcA(`systems ${A.sys} "Conc A"`, 'json');
  await rpcB(`systems ${B.sys} "Conc B"`, 'json');
  await rpcA(`put cns/${A.sys}/nodes/n/name "${A.mark}"`, 'json');
  await rpcB(`put cns/${B.sys}/nodes/n/name "${B.mark}"`, 'json');

  // Interleave reads. Both in flight simultaneously, each round.
  for (let i = 0; i < ROUNDS; i++) {
    const [ra, rb] = await Promise.all([
      rpcA(`get cns/${A.sys}/nodes/n/name`, A.format),
      rpcB(`get cns/${B.sys}/nodes/n/name`, B.format)
    ]);

    const bodyA = JSON.stringify(ra.response ?? '');
    const bodyB = JSON.stringify(rb.response ?? '');

    // 1. No cross-contamination of another caller's output.
    check(bodyA.includes(A.mark) && !bodyA.includes(B.mark), `round ${i}: A body leaked B`);
    check(bodyB.includes(B.mark) && !bodyB.includes(A.mark), `round ${i}: B body leaked A`);

    // 2. Each response honours the format THAT caller asked for.
    check(ra.format === A.format, `round ${i}: A got format ${ra.format} (wanted ${A.format})`);
    check(rb.format === B.format, `round ${i}: B got format ${rb.format} (wanted ${B.format})`);
  }

  wsA.close(); wsB.close();
  console.log(`  checks passed: ${pass}/${pass + fail}`);
  if (fail) { console.log('  failures:'); for (const b of bad) console.log('    - ' + b); }
  console.log(fail ? '=== socket-concurrency: FAIL ===' : '=== socket-concurrency: PASS ===');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
