// Stage 3 regression: the rights matrix.
//
// Each connection's identity and role come from verified JWT claims (sys/role)
// and are pinned for the connection's lifetime. This test drives one socket per
// role and asserts the table in arete_realm_rights_model.md:
//
//   participant  own tree read+write, nothing else
//   observer     + read the whole realm, still no cross-tree write
//   operator     + write/delete anywhere, full command set
//   legacy       no claims -> unrestricted (backward compatibility)
//
// Requires a realm on :8080 started with CNS_DASHBOARD_SECRET set.
// Usage: CNS_SECRET=<secret> node test/socket-rights.mjs

import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

const WS = process.env.CNS_WS || 'ws://127.0.0.1:8080/';
const SECRET = process.env.CNS_SECRET;
if (!SECRET) { console.error('set CNS_SECRET'); process.exit(2); }

const ALICE = 'aa000000-0000-4000-8000-00000000aaaa';
const BOB = 'bb000000-0000-4000-8000-00000000bbbb';

let pass = 0, fail = 0;
const failures = [];
function check(ok, label, detail) {
  if (ok) { pass++; console.log('  PASS  ' + label); }
  else { fail++; failures.push(label); console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

function mint(sys, role) {
  const payload = { sub: 'test', role };
  if (sys !== undefined) payload.sys = sys;
  return jwt.sign(payload, SECRET, { algorithm: 'HS256', expiresIn: '10m' });
}

function open(token) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(WS, token ? { headers: { Authorization: 'Bearer ' + token } } : undefined);
    const snapshot = new Promise((r) => ws.once('message', (m) => r(JSON.parse(m))));
    ws.once('open', async () => res({ ws, snapshot: await snapshot }));
    ws.once('error', rej);
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

const denied = (r) => /Outside system scope|not permitted over socket|Illegal command/i.test(JSON.stringify(r.response ?? r));
const ok = (r) => !/error|Outside system scope|not permitted/i.test(JSON.stringify(r.response ?? r));

async function main() {
  // Seed both systems using a legacy (unrestricted) connection.
  const legacy = await open(mint('*', 'operator'));
  const admin = rpcFactory(legacy.ws);
  await admin(`systems ${ALICE} "Alice"`);
  await admin(`systems ${BOB} "Bob"`);
  await admin(`put cns/${ALICE}/nodes/n/name "ALICE-DATA"`);
  await admin(`put cns/${BOB}/nodes/n/name "BOB-DATA"`);

  // ---------- participant (Alice) ----------
  const alice = await open(mint(ALICE, 'participant'));
  const a = rpcFactory(alice.ws);

  check(ok(await a(`put cns/${ALICE}/nodes/n/label "mine"`)), 'participant: write own tree');
  check(ok(await a(`get cns/${ALICE}/nodes/n/name`)), 'participant: read own tree');
  check(denied(await a(`put cns/${BOB}/nodes/n/name "pwned"`)), 'participant: write OTHER tree denied');
  check(denied(await a(`get cns/${BOB}/nodes/n/name`)), 'participant: read OTHER tree denied');
  check(denied(await a(`purge cns/${BOB}`)), 'participant: purge OTHER tree denied');
  check(denied(await a(`nodes ${BOB} n2 "x" no`)), 'participant: structural cmd for OTHER system denied');
  check(ok(await a(`nodes ${ALICE} n2 "mine" no`)), 'participant: structural cmd for OWN system allowed');
  check(denied(await a('curl http://example.com')), 'participant: console verb denied');

  // Snapshot visibility
  const aKeys = Object.keys(alice.snapshot.keys || {});
  check(aKeys.length > 0 && aKeys.every((k) => k.startsWith(`cns/${ALICE}/`)),
    'participant: snapshot contains ONLY own tree', `saw ${aKeys.filter((k) => !k.startsWith(`cns/${ALICE}/`)).slice(0, 2)}`);

  // ---------- observer ----------
  const obs = await open(mint(ALICE, 'observer'));
  const o = rpcFactory(obs.ws);
  const oKeys = Object.keys(obs.snapshot.keys || {});
  check(oKeys.some((k) => k.startsWith(`cns/${BOB}/`)), 'observer: snapshot sees OTHER trees');
  check(ok(await o(`get cns/${BOB}/nodes/n/name`)), 'observer: read OTHER tree allowed');
  check(denied(await o(`put cns/${BOB}/nodes/n/name "pwned"`)), 'observer: write OTHER tree DENIED');
  check(ok(await o(`put cns/${ALICE}/nodes/n/label "obs"`)), 'observer: write own tree allowed');

  // ---------- operator ----------
  const op = await open(mint('*', 'operator'));
  const p = rpcFactory(op.ws);
  check(ok(await p(`put cns/${BOB}/nodes/n/opnote "ok"`)), 'operator: write OTHER tree allowed');
  check(ok(await p('output debug false')), 'operator: full command set (dashboard console)');
  check(denied(await p('purge cns')), 'operator: realm-wide purge still blocked');

  // ---------- legacy (no claims) ----------
  const leg = await open(mint(undefined, 'participant'));
  const l = rpcFactory(leg.ws);
  check(ok(await l(`get cns/${BOB}/nodes/n/name`)), 'legacy (no sys claim): unrestricted read — back-compat');

  for (const c of [legacy.ws, alice.ws, obs.ws, op.ws, leg.ws]) c.close();
  console.log(`\n=== socket-rights: ${pass}/${pass + fail} passed ===`);
  if (fail) console.log('failed: ' + failures.join('; '));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
