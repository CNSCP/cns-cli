// Stage 1 socket-fence regression test.
//
// Brings up a local realm (etcd + this cns-cli in dashboard mode +
// orchestrator) and asserts, over the websocket the SDK actually uses:
//   - attacks are BLOCKED  (eval/RCE, output(debug), curl/SSRF, run, connect,
//     disconnect, variable-set, relative-key mutation, realm-wide purge)
//   - participant flows STILL WORK (register, declare, bind, put, self-retract)
//
// Usage: node test/socket-security.mjs        (expects a realm on :8080 / :2379)
// The runner script test/run-socket-security.sh boots the realm first.

import WebSocket from 'ws';

const WS = process.env.CNS_WS || 'ws://127.0.0.1:8080/';
let tx = 0;
let pass = 0, fail = 0;

function rpc(ws, command) {
  return new Promise((resolve, reject) => {
    const transaction = ++tx;
    const onMsg = (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.transaction !== transaction) return;
      ws.off('message', onMsg);
      resolve(m);
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ transaction, format: 'json', command }));
    setTimeout(() => { ws.off('message', onMsg); reject(new Error('timeout')); }, 3000);
  });
}

function open() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

// A command is BLOCKED if the response carries an error (display('error',…)
// serializes to a string containing our E_FORBIDDEN / E_RELATIVE text), and
// crucially had no side effect. We assert on the returned response text.
function blocked(label, resp) {
  const body = JSON.stringify(resp.response ?? resp);
  const ok = /not permitted over socket|Absolute key required|above system scope|Illegal command/i.test(body);
  report(ok, `BLOCKED  ${label}`, ok ? '' : `got: ${body.slice(0, 120)}`);
  return ok;
}
function allowed(label, cond, detail) {
  report(cond, `ALLOWED  ${label}`, cond ? '' : detail);
}
function report(ok, label, detail) {
  if (ok) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

const SYS = '55550000-0000-4000-8000-000000000055';

async function main() {
  const ws = await open();

  // ---- attacks that must be blocked ----
  await rpc(ws, 'output debug true').then((r) => blocked('output debug true (RCE precondition)', r));
  await rpc(ws, '!process.exit(1)').then((r) => blocked('! eval (RCE)', r));
  await rpc(ws, 'curl http://169.254.169.254/ GET').then((r) => blocked('curl (SSRF)', r));
  await rpc(ws, 'run /etc/passwd').then((r) => blocked('run (file exec)', r));
  await rpc(ws, 'disconnect').then((r) => blocked('disconnect (DoS)', r));
  await rpc(ws, 'connect').then((r) => blocked('connect (DoS)', r));
  await rpc(ws, 'dashboard 9999').then((r) => blocked('dashboard (spawn server)', r));
  await rpc(ws, '$x = 1').then((r) => blocked('variable set (shared state)', r));
  await rpc(ws, 'cd cns/foo').then((r) => blocked('cd (shared namespace)', r));
  await rpc(ws, 'put foo/bar 1').then((r) => blocked('put relative key', r));
  await rpc(ws, 'purge cns').then((r) => blocked('purge realm-wide', r));

  // ---- participant flows that must still work ----
  let r;
  r = await rpc(ws, `systems ${SYS} "Fence Test"`);
  allowed('systems (register)', !/error/i.test(JSON.stringify(r.response ?? '')), JSON.stringify(r).slice(0, 120));

  r = await rpc(ws, `put cns/${SYS}/nodes/n1/name "Node 1"`);
  allowed('put absolute key', !/not permitted|Absolute key|error/i.test(JSON.stringify(r.response ?? '')), JSON.stringify(r).slice(0, 120));

  r = await rpc(ws, `get cns/${SYS}/nodes/n1/name`);
  allowed('get absolute key returns value', JSON.stringify(r.response ?? '').includes('Node 1'), JSON.stringify(r).slice(0, 160));

  r = await rpc(ws, `purge cns/${SYS}`);
  allowed('self-retract (purge own system subtree)', !/not permitted|above system|error/i.test(JSON.stringify(r.response ?? '')), JSON.stringify(r).slice(0, 120));

  r = await rpc(ws, `get cns/${SYS}/nodes/n1/name`);
  allowed('self-retract actually removed the key', !JSON.stringify(r.response ?? '').includes('Node 1'), JSON.stringify(r).slice(0, 160));

  // ---- variable substitution must NOT run on socket args ----
  // A wire caller sends literal values. If variable() ran, "$HOME" would be
  // replaced from process.env (and "$dashboardSecret" from config — the JWT
  // signing key), writing a server secret into the caller's own tree.
  await rpc(ws, `put cns/${SYS}/nodes/n1/leak "$HOME"`);
  r = await rpc(ws, `get cns/${SYS}/nodes/n1/leak`);
  {
    const body = JSON.stringify(r.response ?? '');
    const literal = body.includes('$HOME');
    const expanded = /"\/(?:home|root|Users|sessions)/.test(body);
    report(literal && !expanded, 'NO-SUBST  $HOME stored literally (secret-leak guard)',
      `got: ${body.slice(0, 160)}`);
  }
  await rpc(ws, `purge cns/${SYS}`);

  ws.close();
  console.log(`\n=== socket-security: ${pass}/${pass + fail} passed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
