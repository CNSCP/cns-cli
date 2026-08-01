// Enrolment: the automated path from a distributable credential to a
// system-scoped one, with no human in the loop and nothing over-privileged
// ever handed to an app.
//
//   1. An `enrol` credential can do NOTHING except exchange itself.
//   2. The exchange is ATTENUATING — it always yields `participant`.
//   3. FIRST CLAIM WINS — a system id already enrolled cannot be enrolled
//      again, so a widely distributed enrolment token cannot impersonate an
//      existing system.
//   4. The issued token works as a normal scoped participant credential.
//   5. An operator can revoke it, after which it stops working.
//
// Requires a realm on :8080 with CNS_DASHBOARD_SECRET set.
// Usage: CNS_SECRET=<secret> node test/socket-enrol.mjs

import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

const WS = process.env.CNS_WS || 'ws://127.0.0.1:8080/';
const SECRET = process.env.CNS_SECRET;
if (!SECRET) { console.error('set CNS_SECRET'); process.exit(2); }

const SYS = 'ee000000-0000-4000-8000-0000000000ee';
const OTHER = 'ff000000-0000-4000-8000-0000000000ff';

let pass = 0, fail = 0;
const failures = [];
function check(ok, label, detail) {
  if (ok) { pass++; console.log('  PASS  ' + label); }
  else { fail++; failures.push(label); console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

const mint = (sys, role) => {
  const payload = { sub: 'test', role };
  if (sys !== undefined) payload.sys = sys;
  return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '10m' });
};

function open(token) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(WS, token ? { headers: { Authorization: 'Bearer ' + token } } : undefined);
    const snap = new Promise((r) => ws.once('message', (m) => r(JSON.parse(m))));
    ws.once('open', async () => res({ ws, snapshot: await snap }));
    ws.once('error', (e) => rej(e));
  });
}

function rpcFactory(ws) {
  let tx = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.transaction && pending.has(m.transaction)) { pending.get(m.transaction)(m); pending.delete(m.transaction); }
  });
  return (command) => new Promise((resolve, reject) => {
    const transaction = ++tx;
    pending.set(transaction, resolve);
    ws.send(JSON.stringify({ transaction, format: 'json', command }));
    setTimeout(() => { pending.delete(transaction); reject(new Error('timeout')); }, 4000);
  });
}

const body = (r) => JSON.stringify(r.response ?? r);
const denied = (r) => /not permitted|Outside system scope|already enrolled|Illegal command/i.test(body(r));

async function main() {
  // ---------- 1. an enrolment credential can do nothing else ----------
  const en = await open(mint(undefined, 'enrol'));
  const e = rpcFactory(en.ws);

  check(Object.keys(en.snapshot.keys || {}).length === 0,
    'enrol: snapshot is empty (sees nothing)', JSON.stringify(Object.keys(en.snapshot.keys || {}).slice(0, 3)));
  check(denied(await e('get cns')), 'enrol: cannot read');
  check(denied(await e(`put cns/${SYS}/x 1`)), 'enrol: cannot write');
  check(denied(await e(`systems ${SYS} "x"`)), 'enrol: cannot register a system');
  check(denied(await e('curl http://example.com')), 'enrol: cannot run console verbs');

  // ---------- 2. the exchange ----------
  const res = await e(`enrol ${SYS}`);
  const issued = (res.response && res.response.enrolment) || {};
  check(typeof issued.token === 'string' && issued.token.length > 20,
    'enrol: exchange returns a token', body(res).slice(0, 120));
  check(issued.role === 'participant', 'enrol: issued role is participant (attenuating)', String(issued.role));
  check(issued.system === SYS, 'enrol: issued token is bound to the requested system', String(issued.system));

  // ---------- 3. first claim wins ----------
  check(denied(await e(`enrol ${SYS}`)), 'enrol: re-enrolling a claimed system is refused (no impersonation)');
  const second = await e(`enrol ${OTHER}`);
  check(!denied(second), 'enrol: a different, unclaimed system still works');

  // ---------- 3b. a sys-scoped enrolment voucher is locked to one system ----------
  const LOCKED = 'aa110000-0000-4000-8000-0000000000aa';
  const OTHER2 = 'bb220000-0000-4000-8000-0000000000bb';
  const v = await open(mint(LOCKED, 'enrol'));
  const vr = rpcFactory(v.ws);

  check(denied(await vr(`enrol ${OTHER2}`)),
    'voucher: sys-scoped enrolment cannot enrol a DIFFERENT system');
  const vres = await vr(`enrol ${LOCKED}`);
  const vissued = (vres.response && vres.response.enrolment) || {};
  check(vissued.system === LOCKED && vissued.role === 'participant',
    'voucher: sys-scoped enrolment issues its own system', body(vres).slice(0, 120));
  try { v.ws.close(); } catch { /* */ }

  // ---------- 4. the issued token behaves as a scoped participant ----------
  const app = await open(issued.token);
  const a = rpcFactory(app.ws);

  check(!denied(await a(`systems ${SYS} "Enrolled App"`)), 'issued: can register its own system');
  check(!denied(await a(`put cns/${SYS}/nodes/n/name "mine"`)), 'issued: can write its own tree');
  check(denied(await a(`put cns/${OTHER}/nodes/n/name "pwned"`)), 'issued: cannot write another tree');
  check(denied(await a(`enrol ${'11110000-0000-4000-8000-000000001111'}`)),
    'issued: cannot enrol further systems (no privilege escalation)');

  // ---------- 5. revocation ----------
  const op = await open(mint('*', 'operator'));
  const o = rpcFactory(op.ws);
  check(!denied(await o(`revoke ${SYS}`)), 'operator: can revoke an enrolment');

  let rejected = false;
  try { await open(issued.token); } catch { rejected = true; }
  check(rejected, 'revoked token is refused at connect');

  for (const c of [en.ws, app.ws, op.ws]) { try { c.close(); } catch { /* */ } }
  console.log(`\n=== socket-enrol: ${pass}/${pass + fail} passed ===`);
  if (fail) console.log('failed: ' + failures.join('; '));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
