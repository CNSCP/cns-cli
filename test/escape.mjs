// Front-end output-escaping regression test.
//
// The dashboard builds its lists as innerHTML strings from etcd keys and
// values, which any participant can write. escapeHtml() is the single boundary
// that stops a value like <img src=x onerror=…> or "><script>… from becoming
// stored XSS in a privileged operator's browser. This test extracts the live
// escapeHtml from public/main.js (no browser needed) and asserts it neutralises
// both text and attribute contexts.
//
// Usage: node test/escape.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../public/main.js'), 'utf8');

const m = src.match(/function escapeHtml\(value\) \{[\s\S]*?\n\}/);
if (!m) { console.error('could not find escapeHtml in main.js'); process.exit(2); }

// eslint-disable-next-line no-eval
const escapeHtml = eval('(' + m[0].replace('function escapeHtml', 'function') + ')');

let pass = 0, fail = 0;
const check = (label, cond) => {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label); }
};
const has = (s, sub) => s.includes(sub);

const script = '<script>alert(1)</script>';
const e1 = escapeHtml(script);
check('escapes < and >', !has(e1, '<script>') && has(e1, '&lt;script&gt;'));

// Attribute-breakout: a value lands inside value="…". A raw " ends the
// attribute and lets onerror/onload in.
const attr = '"><img src=x onerror=alert(1)>';
const e2 = escapeHtml(attr);
check('escapes double quote (attribute breakout)', !has(e2, '"') && has(e2, '&quot;'));
check('no raw < survives in attr payload', !has(e2, '<'));

const single = "' onmouseover='alert(1)";
check('escapes single quote', !escapeHtml(single).includes("'"));

check('escapes ampersand', escapeHtml('a & b').includes('&amp;'));

// Must coerce non-strings without throwing (values may be null/number).
check('null coerces to empty', escapeHtml(null) === '');
check('number coerces', escapeHtml(42) === '42');

// ---- the call sites, not just the helper ----
//
// Testing escapeHtml in isolation proves the tool exists, not that it is used:
// every call site in main.js could be reverted to raw concatenation and the
// assertions above would still pass. So also check the source text. Any of
// these names concatenated straight into markup is attacker-controlled data
// from etcd and must be wrapped (or be one of the pre-escaped *H locals).
const TAINTED = [
  'value', 'name', 'id', 'key', 'scope', 'version', 'token', 'orchestrator',
  'upstream', 'consumer', 'property', 'display', 'from', 'cs', 'ps', 'ns',
  'otherKey', 'otherNode', 'otherContext', 'icon', 'text', 'role', 'profile'
];

// A bare tainted identifier inside a string concatenation: "' + value +" or
// "' + value  +  '". The escaped forms are escapeHtml(x) or the *H locals, so
// neither matches this.
const bare = new RegExp("\\+\\s*(" + TAINTED.join('|') + ")\\s*\\+", 'g');

const offenders = [];
src.split('\n').forEach((line, i) => {
  // Only interested in lines that build markup.
  if (!/['"]\s*<|<\w|=\\?"/.test(line)) return;

  // Not markup: building a key path ('cns/' + system + '/nodes/…') or a CSS
  // selector to hand to query()/focus()/$$(). Selector values are escaped by
  // keySelector() where they can contain etcd data.
  if (/^\s*(const|var|let)\s+\w+\s*=\s*'cns\//.test(line)) return;
  if (/(focus|query|radio|\$\$)\s*\(/.test(line)) return;

  let m;
  bare.lastIndex = 0;
  while ((m = bare.exec(line)) !== null)
    offenders.push(`main.js:${i + 1}  ${m[1]}  ->  ${line.trim().slice(0, 90)}`);
});

check('no tainted value is concatenated into markup unescaped',
  offenders.length === 0);
if (offenders.length) offenders.forEach((o) => console.log('        ' + o));

// And the sanity check that the above rule can actually fire, so a future
// refactor that renames things does not silently make this test vacuous.
const sample = "'<td>' + value + '</td>'";
check('the call-site rule detects an unescaped interpolation',
  new RegExp("\\+\\s*(" + TAINTED.join('|') + ")\\s*\\+").test(sample));

console.log(`\n=== escape: ${pass}/${pass + fail} passed ===`);
process.exit(fail ? 1 : 0);
