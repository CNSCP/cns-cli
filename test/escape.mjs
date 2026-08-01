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

console.log(`\n=== escape: ${pass}/${pass + fail} passed ===`);
process.exit(fail ? 1 : 0);
