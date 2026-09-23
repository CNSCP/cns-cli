// declare.test.js - what a declaration records, against recorded canon answers
//
// Run: npm test   (Node's built-in test runner; no network)
//
// Fixtures: test/fixtures/canon.json, recorded from https://cp.cnscp.io with
// Accept: application/cp+json; profile=2026.

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const registry = require('../registry');
const declare = require('../declare');
const canon = require('./fixtures/canon.json');

const ORIGIN = 'https://cp.example.test';

// A fake Registry serving the recorded answers. Tests can replace answers,
// make it fail, and read what was asked.
function fakeRegistry() {
  const answers = new Map(Object.entries(canon.answers));
  const log = [];
  var failure = null;

  async function get(url, headers) {
    const path = url.slice(ORIGIN.length);
    log.push({ path: path, headers: headers });

    if (failure) throw new Error(failure);

    const a = answers.get(path);
    if (a === undefined) return { status: 404, headers: {}, body: '{"registered":false}' };

    if (a.etag && headers['if-none-match'] === a.etag) return { status: 304, headers: { etag: a.etag }, body: '' };

    return { status: a.status, headers: a.etag ? { etag: a.etag } : {}, body: a.body };
  }

  return {
    get: get,
    log: log,
    answers: answers,
    fail: (message) => { failure = message; },
    heal: () => { failure = null; }
  };
}

function resolverFor(fake) {
  return registry.createResolver({ origin: ORIGIN, get: fake.get, retryGap: 0 });
}

// A surface as the resolver holds it: Map(n -> status)
function versions(pairs) {
  return new Map(pairs);
}

// Expect a ResolveError of the given kind
function throwsKind(fn, kind) {
  assert.throws(fn, (e) => {
    assert.strictEqual(e.kind, kind);
    return true;
  });
}

async function rejectsKind(promise, kind) {
  await assert.rejects(promise, (e) => {
    assert.strictEqual(e.kind, kind);
    return true;
  });
}

test('D1 surface() asks every time, with If-None-Match once held; a 304 keeps what is held', async () => {
  const fake = fakeRegistry();
  const resolver = resolverFor(fake);

  const first = await resolver.surface('padi.lighting');
  assert.deepStrictEqual([...first.versions], [[1, 'deprecated'], [2, 'published']]);
  assert.strictEqual(first.held, false);
  assert.strictEqual(fake.log[0].headers['if-none-match'], undefined);

  const second = await resolver.surface('padi.lighting');
  assert.strictEqual(fake.log.length, 2);
  assert.strictEqual(fake.log[1].path, '/padi.lighting');
  assert.strictEqual(fake.log[1].headers['if-none-match'], canon.answers['/padi.lighting'].etag);
  assert.deepStrictEqual([...second.versions], [...first.versions]);
  assert.strictEqual(second.held, false);
  assert.strictEqual(resolver.counts.notModified, 1);

  // A version published since: seen at once, with no sweep
  const surface = JSON.parse(canon.answers['/padi.lighting'].body);
  surface.versions.push({ version: 3, status: 'published' });
  fake.answers.set('/padi.lighting', { status: 200, etag: '"lighting-3p"', body: JSON.stringify(surface) });

  const third = await resolver.surface('padi.lighting');
  assert.deepStrictEqual([...third.versions], [[1, 'deprecated'], [2, 'published'], [3, 'published']]);
});

test('D2 surface(): held versions when the Registry does not answer; nothing held is "unavailable"', async () => {
  const fake = fakeRegistry();
  const resolver = resolverFor(fake);

  // Nothing held: unavailable
  fake.fail('connect ECONNREFUSED');
  await rejectsKind(resolver.surface('padi.light'), registry.UNAVAILABLE);

  // Held, then the Registry stops answering: lifecycle as last held
  fake.heal();
  await resolver.surface('padi.lighting');
  fake.fail('timeout');

  const held = await resolver.surface('padi.lighting');
  assert.strictEqual(held.held, true);
  assert.deepStrictEqual([...held.versions], [[1, 'deprecated'], [2, 'published']]);

  // The returned versions are a copy: changing them changes nothing held
  held.versions.set(2, 'deprecated');
  assert.strictEqual((await resolver.surface('padi.lighting')).versions.get(2), 'published');
});

test('D3 surface(): "not registered" is never answered from what is held', async () => {
  const fake = fakeRegistry();
  const resolver = resolverFor(fake);

  await rejectsKind(resolver.surface('nosuch.thing.here'), registry.UNREGISTERED);

  // Held, then released: the Registry's answer wins over what was held
  await resolver.surface('padi.light');
  fake.answers.delete('/padi.light');
  await rejectsKind(resolver.surface('padi.light'), registry.UNREGISTERED);

  // ...and after that, an outage does not bring the old versions back
  fake.fail('timeout');
  await rejectsKind(resolver.surface('padi.light'), registry.UNAVAILABLE);

  // Registered since: asked again, not remembered as absent
  fake.heal();
  fake.answers.set('/padi.light', canon.answers['/padi.light']);
  assert.deepStrictEqual([...(await resolver.surface('padi.light')).versions], [[1, 'published']]);
});

test('D4 version choice with no version given: the highest published, non-Deprecated', async () => {
  const fake = fakeRegistry();
  const resolver = resolverFor(fake);

  const light = await resolver.surface('padi.light');
  assert.deepStrictEqual(declare.chooseVersion('padi.light', light.versions), { version: 1, deprecated: false });

  // v1 is Deprecated: v2 is recorded
  const lighting = await resolver.surface('padi.lighting');
  assert.deepStrictEqual(declare.chooseVersion('padi.lighting', lighting.versions), { version: 2, deprecated: false });

  // Order does not matter; a higher Deprecated version is passed over
  assert.deepStrictEqual(
    declare.chooseVersion('x', versions([[3, 'published'], [5, 'deprecated'], [4, 'published'], [1, 'published']])),
    { version: 4, deprecated: false });

  // Every version Deprecated: the highest, flagged. Not defective (§8.6)
  assert.deepStrictEqual(
    declare.chooseVersion('x', versions([[1, 'deprecated'], [2, 'deprecated']])),
    { version: 2, deprecated: true });

  // Nothing published
  const appliance = await resolver.surface('padi.appliance');
  throwsKind(() => declare.chooseVersion('padi.appliance', appliance.versions), registry.UNPUBLISHED);

  // A status this code does not know is never chosen
  throwsKind(() => declare.chooseVersion('x', versions([[1, 'withdrawn']])), registry.UNPUBLISHED);
});

test('D5 version choice with a version given: checked against the Registry', async () => {
  const fake = fakeRegistry();
  const resolver = resolverFor(fake);
  const lighting = (await resolver.surface('padi.lighting')).versions;

  assert.deepStrictEqual(declare.chooseVersion('padi.lighting', lighting, '2'), { version: 2, deprecated: false });
  assert.deepStrictEqual(declare.chooseVersion('padi.lighting', lighting, 2), { version: 2, deprecated: false });

  // Deprecated: accepted, flagged
  assert.deepStrictEqual(declare.chooseVersion('padi.lighting', lighting, '1'), { version: 1, deprecated: true });

  // No such version, or not a version number at all
  throwsKind(() => declare.chooseVersion('padi.lighting', lighting, '3'), registry.NO_VERSION);
  throwsKind(() => declare.chooseVersion('padi.lighting', lighting, 'abc'), registry.NO_VERSION);
  throwsKind(() => declare.chooseVersion('padi.lighting', lighting, '0'), registry.NO_VERSION);
  throwsKind(() => declare.chooseVersion('padi.lighting', lighting, '2.0'), registry.NO_VERSION);

  // A version whose status this code does not know is refused, with it
  assert.throws(() => declare.chooseVersion('x', versions([[1, 'withdrawn'], [2, 'published']]), '1'),
    /x:1 no such version \(status withdrawn\)/);

  // Nothing published at all: that ground, not "no such version"
  const appliance = (await resolver.surface('padi.appliance')).versions;
  throwsKind(() => declare.chooseVersion('padi.appliance', appliance, '1'), registry.UNPUBLISHED);
});

test('D6 the console writes only the answers that change a value', () => {
  const names = ['sIn', 'sOut', 'sNote'];

  // Enter at every prompt: each answer is the value shown, so nothing is written
  assert.deepStrictEqual(declare.changedAnswers(names, ['', '1', 'x'], { sOut: '1', sNote: 'x' }), []);

  // One typed value
  assert.deepStrictEqual(declare.changedAnswers(names, ['', '0', 'x'], { sOut: '1', sNote: 'x' }), [['sOut', '0']]);

  // A Property never written shows as "": typing something writes it; Enter does not
  assert.deepStrictEqual(declare.changedAnswers(names, ['5', '', ''], {}), [['sIn', '5']]);

  // Held values compare as text
  assert.deepStrictEqual(declare.changedAnswers(['n'], ['1'], { n: 1 }), []);
  assert.deepStrictEqual(declare.changedAnswers(['n'], [''], { n: null }), []);
});
