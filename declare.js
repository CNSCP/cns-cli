// declare.js - what a declaration records (CNS/CP specification §8.4, §8.6)
// Copyright 2025 Padi, Inc. All Rights Reserved.

'use strict';

const registry = require('./registry');

const PUBLISHED = 'published';
const DEPRECATED = 'deprecated';

// Highest version number with the given status, or undefined
function highest(versions, status) {
  var top;
  for (const [n, s] of versions) {
    if (s === status && (top === undefined || n > top)) top = n;
  }
  return top;
}

// Choose the version a declaration records.
//
//   name       the Profile name
//   versions   Map(n -> status), from the resolver's surface()
//   requested  the version the caller gave, or undefined
//
// Returns { version, deprecated }. Throws a ResolveError (a defective
// declaration, §8.4) when there is nothing to record:
//
//   - nothing published            -> "nothing published"
//   - a version that doesn't exist -> "no such version"
//
// With no version given, the highest published, non-Deprecated version is
// recorded. If every version is Deprecated, the highest is recorded: the
// declaration is not defective, it waits (§8.6).
function chooseVersion(name, versions, requested) {
  if (requested !== undefined) {
    const n = registry.parseVersion(requested);
    const status = (n === null) ? undefined : versions.get(n);

    if (status === PUBLISHED) return { version: n, deprecated: false };
    if (status === DEPRECATED) return { version: n, deprecated: true };

    if (highest(versions, PUBLISHED) === undefined && highest(versions, DEPRECATED) === undefined)
      throw new registry.ResolveError(registry.UNPUBLISHED, name);

    throw new registry.ResolveError(registry.NO_VERSION, name, requested,
      (status !== undefined) ? ('status ' + status) : undefined);
  }

  const published = highest(versions, PUBLISHED);
  if (published !== undefined) return { version: published, deprecated: false };

  const deprecated = highest(versions, DEPRECATED);
  if (deprecated !== undefined) return { version: deprecated, deprecated: true };

  throw new registry.ResolveError(registry.UNPUBLISHED, name);
}

// The console answers worth writing: only those that change the value the
// Capability already holds. Pressing Enter at a prompt writes nothing.
//
//   names    Property names, in prompt order
//   answers  what was answered, in the same order
//   current  { name: value } held at the Capability now
//
// Returns [[name, value], ...].
function changedAnswers(names, answers, current) {
  const writes = [];

  for (var n = 0; n < names.length; n++) {
    const held = current[names[n]];
    const was = (held === undefined || held === null) ? '' : String(held);

    if (answers[n] !== was) writes.push([names[n], answers[n]]);
  }
  return writes;
}

module.exports = {
  chooseVersion: chooseVersion,
  changedAnswers: changedAnswers
};
