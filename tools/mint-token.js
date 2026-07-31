#!/usr/bin/env node
//
// Mint a realm access token for testing — and, more usefully, a precise
// statement of the claims `cns-cli` expects. Whatever issues tokens in
// production (arete-hosting) needs to produce exactly this shape.
//
//   node tools/mint-token.js --secret <s> --sys <systemId> [--role participant]
//   node tools/mint-token.js --secret <s> --role observer --sys '*'
//   node tools/mint-token.js --secret <s> --role operator --sys '*' --exp 30d
//
// CLAIMS
//   sys    the system this connection may act as.
//          '*'  = unscoped (may act as any system) — use explicitly.
//          absent = LEGACY, treated as unscoped for backward compatibility.
//                   Prefer '*' so that absence can later mean deny.
//   role   participant (default) | observer | operator | service
//            participant  own tree only, read and write
//            observer     + read the whole realm
//            operator     + write/delete anywhere, full command set (dashboard console)
//            service      realm-resident infrastructure
//   sub    subject, informational
//   exp    expiry (standard JWT claim)
//
// NOTE the signing algorithm is HS256 with a secret shared between the issuer
// and every realm, which means a realm can MINT tokens, not merely verify
// them. Asymmetric signing (issuer holds the private key, realms hold only the
// public key) would remove that and is much cheaper to adopt now than later.

const jwt = require('jsonwebtoken');

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf('--' + name);
  return i === -1 ? def : args[i + 1];
}

const secret = opt('secret', process.env.CNS_DASHBOARD_SECRET);
const sys = opt('sys');
const role = opt('role', 'participant');
const sub = opt('sub', 'cns-test');
const exp = opt('exp', '365d');

if (!secret) {
  console.error('usage: mint-token.js --secret <shared-secret> [--sys <id>|*] [--role participant|observer|operator|service] [--exp 30d]');
  console.error('       (or set CNS_DASHBOARD_SECRET)');
  process.exit(2);
}

const ROLES = ['participant', 'observer', 'operator', 'service'];
if (!ROLES.includes(role)) {
  console.error('role must be one of: ' + ROLES.join(', '));
  process.exit(2);
}

const payload = { sub: sub, role: role };
if (sys !== undefined) payload.sys = sys;

const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: exp });

if (args.includes('--quiet')) {
  process.stdout.write(token);
} else {
  console.log('claims :', JSON.stringify(payload));
  console.log('expires:', exp);
  console.log();
  console.log(token);
}
