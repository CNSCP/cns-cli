#!/usr/bin/env node

// index.js - CNS Command line
// Copyright 2025 Padi, Inc. All Rights Reserved.

// connections [node] [context] [role] [profile]
// emulate [node] [context] [role] [profile] [-r]
// watch [node] [context] [role] [profile] [-r]
// sanitize
// optimize
// backup file
// restore file

// top (changes)
// log key
// push (network to etcd server)
// pull (network from etcd server)
// on error break|resume
// on key command
// every ms command
// clear

// if expr command
// foreach command ($for)
// :label
// goto label
// gosub label
// return
// break
//  'exec': exec,
// set var value

// output format json - errors etc
// add output arg to $1 = command
// orchestrate command
// dont allow profile put or del (or purge except whole profile)
// add /api endpoint for GET, PUT, DELETE
// merge provider / consumer command as capability
// add watch / unwatch cli command
// nodeExist function etc...
// add keys command
// map === connections?
// remove find (use ls)

'use strict';

// Imports

const env = require('dotenv').config();

const etcd = require('etcd3');
const readline = require('readline');
const tables = require('table');
const colours = require('colors');
const short = require('short-uuid');
const express = require('express');
const expressws = require('express-ws');
const compression = require('compression');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

const pack = require('./package.json');

// Errors

const E_OPTION = 'Illegal option';
const E_COMMAND = 'Illegal command';
const E_MISSING = 'Missing argument';
const E_ARGUMENT = 'Invalid argument';
const E_VARIABLE = 'Invalid variable';
const E_ASSIGN = 'Invalid assignment';
const E_PERIOD = 'Invalid period';
const E_MISSMATCH = 'Type missmatch';
const E_CONFIG = 'Not configured';
const E_AVAILABLE = 'Not available';
const E_CONNECT = 'Not connected';
const E_FOUND = 'Not found';
const E_CACHE = 'Failed to cache';
const E_WATCH = 'Failed to watch';
const E_INSTALL = 'Failed to install';
const E_GET = 'Failed to get';
const E_PUT = 'Failed to put';
const E_DEL = 'Failed to del';
const E_PURGE = 'Failed to purge';
const E_READ = 'Failed to read';
const E_WRITE = 'Failed to write';
const E_ABORT = 'Aborted.';

/* Output formats */

const F_TEXT = 'text';
const F_TREE = 'tree';
const F_TABLE = 'table';
const F_JSON = 'json';
const F_XML = 'xml';

/* Connection states */

const S_ONLINE = 'online';
const S_OFFLINE = 'offline';

// Constants

const DATE_SHORT = {day: '2-digit', month: '2-digit', year: 'numeric'};
const DATE_LONG = {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'};

const TIME_SHORT = {hour: '2-digit', minute: '2-digit'};
const TIME_LONG = {hour: 'numeric', minute: '2-digit', hour12: true};

const PROFILE_HOST = 'https://cp.padi.io/profiles';

// Configuration

const config = {
  host: process.env.CNS_HOST || '127.0.0.1',
  port: process.env.CNS_PORT || '2379',
  username: process.env.CNS_USERNAME || '',
  password: process.env.CNS_PASSWORD || ''
};

// Options

const options = {
  prompt: '\\w> ',
  format: F_TREE,
  indent: 2,
  columns: 0,
  rows: 0,
  silent: false,
  debug: false
};

// Stats

const stats = {
  started: toTimestamp(),
  reads: 0,
  writes: 0,
  updates: 0,
  errors: 0,
  connection: S_OFFLINE
};

// Commands

const commands = {
  'help': help,
  'version': version,
  'status': status,
  'output': output,
  'dashboard': dashboard,
  'init': init,
  'connect': connect,
  'disconnect': disconnect,
  'network': network,
  'profiles': profiles,
  'nodes': nodes,
  'contexts': contexts,
  'providers': providers,
  'consumers': consumers,
  'conns': conns,
//  'map': map,
  'find': find,
  'pwd': pwd,
  'cd': cd,
  'ls': ls,
  'get': get,
  'put': put,
  'del': del,
  'purge': purge,
  'cls': cls,
  'echo': echo,
  'ask': ask,
  'curl': curl,
  'wait': wait,
  'run': run,
  'exit': exit,
  'quit': exit
};

// Shortcuts

const shortcuts = {
  'h': 'help',
  'v': 'version',
  's': 'status',
  'o': 'output',
  'i': 'init',
  'c': 'connections',
  '?': 'echo',
  'e': 'exit',
  'q': 'quit'
};

// Local data

var client;
var watcher;
var cache;

var variables;
var descriptors;

var server;
var wss;
var pipe;
var buffer;

var terminal;
var completions;
var confirm;
var signal;
var reply;

var namespace;

// Local functions

// Main entry point
async function main(argv) {
  variables = {};

  try {
    // Parse options
    const cmd = parse(argv);

    try {
      // Connect to key store?
      await connect();
    } catch(e) {
      // Failure
    }

    // Process command?
    if (cmd !== '') {
      await command(cmd);

      if (server === undefined)
        await exit();
      return;
    }

    // Open console
    print('Welcome to CNS v' + pack.version + '.');
    print('Type "help" for more information.');

    open();
    prompt();
  } catch(e) {
    // Failure
    error(e);
    exit(1);
  }
}

// Show usage
function usage() {
  print('Usage: cns [options] [ script.cns ] [command]');

  print('\nOptions:');
  print('  -h, --help                  Output usage information');
  print('  -v, --version               Output version information');
  print('  -H, --host uri              Set network host');
  print('  -P, --port number           Set network port');
  print('  -u, --username string       Set network username');
  print('  -p, --password string       Set network password');
  print('  -o, --output format         Set output format');
  print('  -i, --indent size           Set output indent size');
  print('  -c, --columns size          Set output column limit');
  print('  -r, --rows size             Set output row limit');
  print('  -m, --monochrome            Disable console colours');
  print('  -s, --silent                Disable console output');
  print('  -d, --debug                 Enable debug output');

  print('\nCommands:');
  help();

  print('\nEnvironment:');
  print('  CNS_HOST                    Default network host');
  print('  CNS_PORT                    Default network port');
  print('  CNS_USERNAME                Default network username');
  print('  CNS_PASSWORD                Default network password');

  print('\nDocumentation can be found at https://github.com/cnscp/cns-cli/');
}

// Parse arguments
function parse(args) {
  // Process args array
  const cmds = [];

  while (args.length > 0) {
    // Pop next arg
    const arg = args.shift();

    if (cmds.length > 0) {
      // Belongs to command
      cmds.push(arg);
      continue;
    }

    // Not option?
    if (!arg.startsWith('-')) {
      // Process file or command?
      if (arg.endsWith('.cns'))
        cmds.push('run "' + arg + '";');
      else cmds.push(arg);

      continue;
    }

    // What option?
    switch(arg) {
      case '-h':
      case '--help':
        // Show usage
        usage();
        exit();
        break;
      case '-v':
      case '--version':
        // Show version
        version();
        exit();
        break;
      case '-H':
      case '--host':
        // Network host
        config.host = next(arg, args);
        break;
      case '-P':
      case '--port':
        // Network port
        config.port = next(arg, args);
        break;
      case '-u':
      case '--username':
        // Network user
        config.username = next(arg, args);
        break;
      case '-p':
      case '--password':
        // Network password
        config.password = next(arg, args);
        break;
      case '-o':
      case '--output':
        // Set output type
        options.format = next(arg, args);
        break;
      case '-i':
      case '--indent':
        // Set output indent
        options.indent = next(arg, args) | 0;
        break;
      case '-c':
      case '--columns':
        // Set output column limit
        options.columns = next(arg, args) | 0;
        break;
      case '-r':
      case '--rows':
        // Set output row limit
        options.rows = next(arg, args) | 0;
        break;
      case '-m':
      case '--monochrome':
        // No colour mode
        colours.disable();
        break;
      case '-s':
      case '--silent':
        // Silent mode
        options.silent = true;
        break;
      case '-d':
      case '--debug':
        // Debug mode
        options.debug = true;
        break;
      case '--':
        // Options done
        cmds.push('');
        break;
      default:
        // Bad option
        throw new Error(E_OPTION + ': ' + arg);
    }
  }
  return cmds.join(' ').trim();
}

// Get next arg
function next(arg, args) {
  // No more args?
  if (args.length === 0)
    throw new Error(E_MISSING + ': ' + arg);

  return args.shift();
}

// Open console
function open(history) {
  // Make completions
  completions = Object.keys(commands).sort();
  confirm = false;

  // Create console
  terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    history: history,
    completer: completer,
    prompt: prompt()
  })
  // Input line
  .on('line', async (line) => {
    // Reset confirm
    if (signal !== undefined) return;
    confirm = false;

    try {
      // Parse line
      await command(line);
    } catch(e) {
      // Failure
      broadcast({
        stats: {errors: ++stats.errors}
      });

      error(e);
    }

    // Next prompt
    prompt();
  })
  // Ctrl+C
  .on('SIGINT', () => {
    // Catch signal
    if (signal !== undefined) {
      print('\r' + E_ABORT);

      signal();
      signal = undefined;

      return;
    }

    // Are you sure?
    if (!confirm) {
      confirm = true;

      print('\n(To exit, press Ctrl+C again or Ctrl+D or type exit)');
      prompt();

      return;
    }

    // Terminate
    print('\r');
    exit();
  })
  // Console closed
  .on('close', () => {
    // Ctrl+D
    const key = terminal._previousKey || {};

    if (key.ctrl && key.name === 'd') {
      // Terminate
      print('\r');
      exit();
    }
  });
}

// Tab completer
function completer(line) {
  const hits = completions.filter((c) => c.startsWith(line));
  return [(hits.length > 0)?hits:completions, line];
}

// Output console prompt
function prompt() {
  const text = options.silent?'':escape(options.prompt);

  if (terminal !== undefined) {
    terminal.setPrompt(text);
    terminal.prompt();
  }
  return text;
}

// Suspend console
function suspend() {
  var history;

  if (terminal !== undefined) {
    history = terminal.history;
    close();
  }
  return history;
}

// Resume from suspend
function resume(rl, history) {
  rl.close();

  if (history !== undefined)
    open(history);
}

// Close console
function close() {
  if (terminal !== undefined) {
    terminal.close();
    terminal = undefined;
  }
}

// Parse command
async function command(line) {
  // Expression eval?
//  if (line.startsWith('!')) {
//    console.log(eval(line.substr(1)));
//    return;
//  }

  // Remove comments
  line = line.split(/^\/\/+|\s\/\/+(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)[0];

  // Split statements
  const statements = line.split(/;+(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);

  for (const statement of statements) {
    // Empty statement?
    const part = statement.trim();
    if (part === '') continue;

    // Split args and remove quotes
    const args = (part.match(/\?|[^\s"]+|"([^"]*)"/g) || [])
      .map((arg) => arg.replace(/^"(.*)"$/, '$1'));

    // Get command arg
    const arg = args.shift();
    const len = args.length;

    const cmd = arg.toLowerCase();

    // Variable assign?
    if (cmd.startsWith('$')) {
      const name = cmd.substr(1);

      if (args[0] === '=' && len < 3) {
        variables[name] = argument(args[1], '');
        return;
      }
      throw new Error(E_ASSIGN);
    }

    // Get command handler?
    const fn = commands[shortcuts[cmd] || cmd];

    if (fn === undefined)
      throw new Error(E_COMMAND + ': ' + arg);

    // Too many args?
    if (cmd !== '?' && cmd !== 'echo' && len > fn.length)
      throw new Error(E_ARGUMENT + ': ' + args[len - 1]);

    // Call command
    await fn.apply(this, args);
  }
}

// Get command argument
function argument(arg, def) {
  const value = (arg === undefined)?def:arg;

  if (typeof value === 'string')
    return variable(value);

  return value;
}

// Get required argument
function required(arg) {
  const value = argument(arg);

  if (value === undefined)
    throw new Error(E_MISSING);

  return value;
}

// Get time argument
function period(arg) {
  const value = argument(arg, '');
  const parts = value.toString().split(/(\D+)/);

  const period = parts[0] | 0;
  const units = parts[1] || '';

  switch (units.toLowerCase()) {
    case 'h':
      // Hours
      return period * 1000 * 60 * 60;
    case 'm':
      // Minutes
      return period * 1000 * 60;
    case 's':
      // Seconds
      return period * 1000;
    case 'ms':
    case '':
      // Milliseconds
      return period;
  }

  // Not valid
  throw new Error(E_PERIOD + ': ' + arg);
}

// Variable substitution
function variable(value) {
  var match;

  // Match variables
  while (match = value.match(/\$([\d\w_]+)/)) {
    // Find variable
    const found = match[0];
    const name = match[1];

    var data;

    switch (name) {
      case 'new':
        // Short uuid
        data = short.generate();
        break;
      case 'uuid':
        // Long uuid
        data = short.uuid();
        break;
      case 'rand':
        // Random value (0 - 99)
        data = (Math.random() * 100) | 0;
        break;
      case 'now':
        // Timestamp
        data = toTimestamp();
        break;
      case 'date':
        // Current date
        data = toDate(DATE_LONG);
        break;
      case 'time':
        // Current time
        data = toTime(TIME_LONG);
        break;
      case 'path':
        // Current path
        data = namespace;
        break;
      case 'ask':
        // Ask reply
        data = reply || '';
        break;
      default:
        // Other vars
        data = process.env[name];

        if (data === undefined) data = config[name];
        if (data === undefined) data = options[name];
        if (data === undefined) data = stats[name];
        if (data === undefined) data = variables[name];
        break;
    }

    // Not found?
    if (data === undefined)
      throw new Error(E_VARIABLE + ': ' + name);

    // Replace with value
    value = value.replace(found, data);
  }
  return value;
}

// Escape code substitution
function escape(value) {
  var match;

  // Match codes
  while (match = value.match(/\\([svVuhHcwWAdDtT])/)) {
    // Find code
    const found = match[0];
    const name = match[1];

    var data = '';

    switch (name) {
      case 's':
        // Service
        data = pack.name;
        break;
      case 'v':
        // Version major
        data = pack.version.split('.');
        data.pop();
        data = data.join('.');
        break;
      case 'V':
        // Version
        data = pack.version;
        break;
      case 'u':
        // Username
        data = config.username;
        break;
      case 'h':
        // Host domain
        data = config.host.match(/^(.*?\:\/\/)?([^:]*)/)[2];
        break;
      case 'H':
        // Host
        data = config.host;
        break;
      case 'c':
        // Connection status
        data = stats.connection;
        break;
      case 'w':
        // Path
        data = client?shorten(namespace):'';
        break;
      case 'W':
        // Directory
        data = client?namespace.split('/').pop():'';
        break;
      case 'A':
        // Timestamp
        data = toTimestamp();
        break;
      case 'd':
        // Short date
        data = toDate(DATE_SHORT);
        break;
      case 'D':
        // Long date
        data = toDate(DATE_LONG);
        break;
      case 't':
        // Short time
        data = toTime(TIME_SHORT);
        break;
      case 'T':
        // Long time
        data = toTime(TIME_LONG);
        break;
    }

    // Replace with value
    value = value.replace(found, data);
  }
  return value;
}

// Get key path
function location(loc) {
  // Must have no wildcard
  if (loc.includes('*'))
    throw new Error(E_ARGUMENT);

  return wildcard(loc);
}

// Get wildcard path
function wildcard(loc) {
  // Absolute path?
  var absolute = loc.startsWith('/');
  if (absolute) loc = loc.substr(1);

  loc = expand(loc);

  const parts = loc.split('/');

  if (parts[0] === 'cns' && parts[1] === 'network')
    absolute = true;

  // Relative path?
  if (!absolute) loc = (namespace?(namespace + '/'):'') + loc;

  // Normalize path
  loc = path.normalize(loc);
  if (loc.startsWith('.')) loc = '';

  // Remove trailing slash
  return loc.replace(/\/$/, '');
}

// Expand home path
function expand(loc) {
  const parts = loc.split('/');

  if (parts[0] === '~') {
    parts.unshift('cns');
    parts[1] = 'network';

    return parts.join('/');
  }
  return loc;
}

// Shorten home path
function shorten(loc) {
  const parts = loc.split('/');

  if (parts[0] === 'cns' && parts[1] === 'network') {
    parts.shift();
    parts[0] = '~';

    return parts.join('/');
  }
  return loc;
}

// Get or set property
function property(path, obj, name, value) {
  // Output all properties?
  if (name === undefined)
    display(path, obj);
  else {
    // Property must exist
    const current = obj[name];

    if (current === undefined)
      throw new Error(E_ARGUMENT + ': ' + name);

    // Output or set property?
    if (value === undefined)
      display(name, current);
    else obj[name] = cast(current, value);
  }
}

// Cast property value
function cast(current, value) {
  // What type?
  switch (typeof current) {
    case 'string':
      return '' + value;
    case 'number':
      return +value;
    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      break;
  }
  throw new Error(E_MISSMATCH);
}

// Show help information
function help() {
  // Output help
  print('  help                                     Output help information');
  print('  version                                  Output version information');
  print('  status [name]                            Output status properties');
  print('  output [name] [value]                    Configure output properties');
  print('  dashboard [port]                         Start CNS Dashboard service');
  print('  init                                     Initialize config file');
  print('  connect                                  Connect to network');
  print('  disconnect                               Disconnect from network');
  print('  network                                  Configure network properties');
  print('  profiles [-i] [profile]                  Configure profile properties');
  print('  nodes [node]                             Configure node properties');
  print('  contexts [node] [context]                Configure context properties');
  print('  providers [node] [context] [profile]     Configure provider properties');
  print('  consumers [node] [context] [profile]     Configure consumer properties');
  print('  conns [node] [context] [profile] [role]  Display profile connections');
//  print('  map                                      Display network map');
  print('  find [filter]                            Find matching keys');
  print('  pwd                                      Display current key path');
  print('  cd [key]                                 Change current key path');
  print('  ls [key]                                 List key values');
  print('  get key                                  Get key value');
  print('  put key value                            Put key value');
  print('  del key                                  Delete key entry');
  print('  purge prefix                             Purge key entries');
  print('  cls                                      Clear the screen');
  print('  echo [-n] [string]                       Write to standard output');
  print('  ask [prompt] [default]                   Read from standard input');
  print('  curl url [method] [data]                 Send http request to url');
  print('  wait [period]                            Wait for specified time');
  print('  run file                                 Run script file');
  print('  exit [code]                              Exit the console with code');
  print('  quit                                     Quit the console');

  // Console mode?
  if (terminal !== undefined && pipe === undefined)
    print('\nPress Ctrl+C to abort current command, Ctrl+D to exit the console.');
}

// Show version
function version() {
  display('version', pack.version);
}

// Display status properties
function status(arg1) {
  const name = argument(arg1);
  property('status', stats, name);
}

// Configure output property
function output(arg1, arg2) {
  const name = argument(arg1);
  const value = argument(arg2);

  property('output', options, name, value);
}

// Start dashboard server
function dashboard(arg1) {
  const host = 'localhost';
  const port = argument(arg1, '8080');

  start(host, port);
}

// Init environment
async function init() {
  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  // Output help
  print('This utility will walk you through creating a .env environment file.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const answers = await questions([
      'CNS Host',
      'CNS Port',
      'CNS Username',
      'CNS Password'
    ], [
      config.host,
      config.port,
      config.username,
      null//config.password
    ]);

  // Prompt to write
  print('\nAbout to write .env file:\n');

  print('CNS_HOST = ' + answers[0]);
  print('CNS_PORT = ' + answers[1]);
  print('CNS_USERNAME = ' + answers[2]);
  //print('CNS_PASSWORD = ' + answers[3]);

  await confirmation();

  // Update new values
  config.host = answers[0];
  config.port = answers[1];
  config.username = answers[2];
  config.password = answers[3];

  // Store config
  const file = path.resolve(process.cwd(), '.env');

  // Get config data
  const data = {
    CNS_HOST: config.host,
    CNS_PORT: config.port,
    CNS_USERNAME: config.username,
    CNS_PASSWORD: config.password
  };

  // Keep user settings
  for (const name in env.parsed) {
    if (data[name] === undefined)
      data[name] = env.parsed[name];
  }

  // Construct contents
  var text = '';

  for (const name in data)
    text += name + '=' + data[name] + '\n';

  // Write file
  write(file, comment() + text);

  // Re-connect
  await connect();
}

// Connect client
async function connect() {
  // Disconnect previous
  await disconnect();

  const host = config.host;
  const port = config.port;

  if (!host) throw new Error(E_CONFIG);

  const username = config.username;
  const password = config.password;

  // Client options
  const options = {
    hosts: host + (port?(':' + port):'')
  };

  // Using auth?
  if (username !== '') {
    options.auth = {
      username: username,
      password: password
    };
  }

  // Create client
  debug('Connecting...');
  client = new etcd.Etcd3(options);

  // Get cache
  cache = await client.getAll()
    .prefix('cns/network')
    .strings()
    .catch((e) => {
      // Failure
      throw new Error(E_CACHE + ': ' + e.message);
    });

  stats.reads++;

  // Start watching
  debug('Watching...');

  watcher = await client.watch()
    .prefix('cns/network')
    .create()
    .catch((e) => {
      // Failure
      throw new Error(E_WATCH + ': ' + e.message);
    });

  watcher
    .on('connected', () => {
      // Re-connect
      debug('Connected...');
    })
    .on('put', (change) => {
      // Key put
      const key = change.key.toString();
      const value = change.value.toString();

      debug('PUT ' + key + ' = ' + value);
      cache[key] = value;

      update(key, value);
    })
    .on('delete', (change) => {
      // Key deleted
      const key = change.key.toString();
      const value = change.value.toString();

      debug('DEL ' + key);
      delete cache[key];

      update(key, null);
    })
    .on('disconnected', () => {
      // Broken connection
      debug('Disconnected...');
    })
    .on('error', (e) => {
      // Failure
      throw new Error(E_WATCH + ': ' + e.message);
    });

  // Success
  debug('Network on ' + host + (username?(' as ' + username):''));
  stats.connection = S_ONLINE;

  broadcast({
    version: pack.version,
    stats: stats,
    keys: cache
  });

  cd();
}

// Disconnect client
async function disconnect() {
  // Reset stats
  stats.reads = 0;
  stats.writes = 0;
  stats.updates = 0;
  stats.errors = 0;
  stats.connection = S_OFFLINE;

  // Reset cache
  cache = {};

  // Close watcher?
  if (watcher !== undefined) {
    debug('Unwatching...');

    await watcher.cancel();
    watcher = undefined;
  }

  // Close client?
  if (client !== undefined) {
    debug('Disconnecting...');

    await client.close();
    client = undefined;

    broadcast({
      stats: {connection: S_OFFLINE},
      keys: {}
    });
  }

  cd();
}

// Configure network
async function network() {
  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  // Output help
  print('This utility will walk you through setting up network properties.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const ns = 'cns/network/';

  const answers = await questions([
      'Network Name',
      'Network Orchestrator',
      'Network Token'
    ], [
      cache[ns + 'name'] || 'New Network',
      cache[ns + 'orchestrator'] || 'contexts',
      cache[ns + 'token'] || ''
    ]);

  // Prompt to write
  print('\nAbout to publish properties:\n');

  print('name = ' + answers[0]);
  print('orchestrator = ' + answers[1]);
  print('token = ' + answers[2]);

  await confirmation();

  // Update new values
  put(ns + 'name', answers[0]);
  put(ns + 'orchestrator', answers[1]);
  put(ns + 'token', answers[2]);

  cd(ns);
}

// Configure profile
async function profiles(arg1, arg2) {
  const profile = argument(arg1);
  const version = argument(arg2);

  // Install profile?
  if (profile === '-i') {
    const profile = version;

    // List descriptors?
    if (profile === undefined) {
      display('descriptors', await getDescriptors());
      return;
    }

    // Send request
    try {
      const data = await request('GET', PROFILE_HOST + '/' + profile);
      const descriptor = JSON.parse(data);

      const title = descriptor.title || '';
      const versions = descriptor.versions || [];

      const ns = 'cns/network/profiles/' + profile + '/';

      // Purge existing
      await purge(ns + 'versions');
      await put(ns + 'name', title);

      // Update new values
      for (var n = 0; n < versions.length; n++) {
        const version = versions[n];
        const properties = version.properties || [];

        const v = n + 1;
        const vs = ns + 'versions/version' + v + '/';

        for (const property of properties) {
          const ps = vs + 'properties/' + property.name + '/';

          await put(ps + 'name', property.description || '');
          await put(ps + 'provider', (property.server === null)?'yes':'no');
          await put(ps + 'required', (property.required === null)?'yes':'no');
          await put(ps + 'propagate', (property.propagate === null)?'yes':'no');
        }
        await put(vs + 'name', 'Version ' + v);
      }
      cd(ns);
    } catch(e) {
      // Failure
      throw new Error(E_INSTALL + ': ' + e.message);
    }
    return;
  }

  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  // List profiles?
  if (profile === undefined) {
    display('profiles', getProfiles());
    return;
  }

  // Profile must exist
  if (cache['cns/network/profiles/' + profile + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + profile);

  // List versions?
  if (version === undefined) {
    display(profile, getVersions(profile));
    return;
  }

  // Version must exist
  if (cache['cns/network/profiles/' + profile + '/versions/version' + version + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + profile + ' version ' + version);

  // List version properties
  display(profile, getProperties(profile, version));
}

// Configure node
async function nodes(arg1, arg2, arg3, arg4) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  var node = argument(arg1);
  var name = argument(arg2, 'New Node');
  var upstream = argument(arg3, 'no');
  var token = argument(arg4, '$uuid');

  // List nodes?
  if (node === undefined) {
    display('nodes', getNodes());
    return;
  }

  const ns = 'cns/network/nodes/' + node + '/';

  // Edit in console?
  if (pipe === undefined) {
    // Output help
    print('This utility will walk you through setting up a network node.');
    print('It only covers the most common items, and tries to guess sensible defaults.\n');

    print('Press ^C at any time to quit.\n');

    // Ask questions
    const answers = await questions([
        'Node Name',
        'Node Upstream',
        'Node Token'
      ], [
        cache[ns + 'name'] || name,
        cache[ns + 'upstream'] || upstream,
        cache[ns + 'token'] || token
      ]);

    // Prompt to write
    print('\nAbout to publish properties:\n');

    print('name = ' + answers[0]);
    print('upstream = ' + answers[1]);
    print('token = ' + answers[2]);

    await confirmation();

    // Update new values
    name = answers[0];
    upstream = answers[1];
    token = answers[2];
  }

  // Update new values
  await put(ns + 'name', name);
  await put(ns + 'upstream', upstream);
  await put(ns + 'token', token);

  cd(ns);
}

// Configure context
async function contexts(arg1, arg2, arg3, arg4) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  var node = argument(arg1);
  var context = argument(arg2);
  var name = argument(arg3, 'New Context');
  var token = argument(arg4, '$uuid');

  // List all contexts?
  if (node === undefined) {
    const nodes = getNodes();

    for (const node in nodes)
      nodes[node] = getContexts(node);

    display('nodes', nodes);
    return;
  }

  // Node must exist
  if (cache['cns/network/nodes/' + node + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + node);

  // List contexts?
  if (context === undefined) {
    display('contexts', getContexts(node));
    return;
  }

  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/';

  // Edit in console?
  if (pipe === undefined) {
    // Output help
    print('This utility will walk you through setting up a node context.');
    print('It only covers the most common items, and tries to guess sensible defaults.\n');

    print('Press ^C at any time to quit.\n');

    // Ask questions
    const answers = await questions([
        'Context Name',
        'Context Token'
      ], [
        cache[ns + 'name'] || name,
        cache[ns + 'token'] || token
      ]);

    // Prompt to write
    print('\nAbout to publish properties:\n');

    print('name = ' + answers[0]);
    print('token = ' + answers[1]);

    await confirmation();

    // Update new values
    name = answers[0];
    token = answers[1];
  }

  // Update new values
  await put(ns + 'name', name);
  await put(ns + 'token', token);

  cd(ns);
}

// Configure provider
async function providers(arg1, arg2, arg3, arg4, arg5) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1);
  const context = argument(arg2);
  const profile = argument(arg3);
  const version = argument(arg4, 1);
  const scope = argument(arg5, '');

  // List all providers?
  if (node === undefined) {
    const nodes = getNodes();

    for (const node in nodes) {
      const contexts = getContexts(node);

      for (const context in contexts)
        contexts[context] = getCapabilities(node, context, 'provider');

      nodes[node] = contexts;
    }
    display('nodes', nodes);
    return;
  }

  // Node must exist
  if (cache['cns/network/nodes/' + node + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + node);

  // List all providers?
  if (context === undefined) {
    const contexts = getContexts(node);

    for (const context in contexts)
      contexts[context] = getCapabilities(node, context, 'provider');

    display('contexts', contexts);
    return;
  }

  // Context must exist
  if (cache['cns/network/nodes/' + node + '/contexts/' + context + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + context);

  // List providers?
  if (profile === undefined) {
    display('provider', getCapabilities(node, context, 'provider'));
    return;
  }

  // Profile must exist
  if (cache['cns/network/profiles/' + profile + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + profile);

  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/provider/' + profile + '/';
  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/';

  // Get property values
  const properties = [];
  const defaults = [];

  const keys = filter(cache, ps + '*/name');

  for (const key in keys) {
    const parts = key.split('/');
    const property = parts[7];

    // Provider property?
    const provider = cache[ps + property + '/provider'];

    if (provider === 'yes') {
      // Add to list
      properties.push(property);
      defaults.push(cache[ns + 'properties/' + property] || '');
    }
  }

  var answers = defaults;

  // Edit in console?
  if (pipe === undefined) {
    // Output help
    print('This utility will walk you through setting up a provider capability.');
    print('It only covers the most common items, and tries to guess sensible defaults.\n');

    print('Press ^C at any time to quit.\n');

    // Ask questions
    answers = await questions(
      properties,
      defaults);

    // Prompt to write
    print('\nAbout to publish properties:\n');

    print('version = ' + version);
    print('scope = ' + scope);

    for (var n = 0; n < properties.length; n++)
      print(properties[n] + ' = ' + answers[n]);

    await confirmation();
  }

  // Update new values
  await put(ns + 'version', version);
  await put(ns + 'scope', scope);

  for (var n = 0; n < properties.length; n++)
    await put(ns + 'properties/' + properties[n], answers[n]);

  cd(ns);
}

// Configure consumer
async function consumers(arg1, arg2, arg3, arg4, arg5) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1);
  const context = argument(arg2);
  const profile = argument(arg3);
  const version = argument(arg4, 1);
  const scope = argument(arg5, '');

  // List all consumers?
  if (node === undefined) {
    const nodes = getNodes();

    for (const node in nodes) {
      const contexts = getContexts(node);

      for (const context in contexts)
        contexts[context] = getCapabilities(node, context, 'consumer');

      nodes[node] = contexts;
    }
    display('nodes', nodes);
    return;
  }

  // Node must exist
  if (cache['cns/network/nodes/' + node + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + node);

  // List all consumers?
  if (context === undefined) {
    const contexts = getContexts(node);

    for (const context in contexts)
      contexts[context] = getCapabilities(node, context, 'consumer');

    display('contexts', contexts);
    return;
  }

  // Context must exist
  if (cache['cns/network/nodes/' + node + '/contexts/' + context + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + context);

  // List consumers?
  if (profile === undefined) {
    display('consumer', getCapabilities(node, context, 'consumer'));
    return;
  }

  // Profile must exist
  if (cache['cns/network/profiles/' + profile + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + profile);

  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/consumer/' + profile + '/';
  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/';

  // Get property values
  const properties = [];
  const defaults = [];

  const keys = filter(cache, ps + '*/name');

  for (const key in keys) {
    const parts = key.split('/');
    const property = parts[7];

    // Consumer property?
    const provider = cache[ps + property + '/provider'];

    if (provider !== 'yes') {
      // Add to list
      properties.push(property);
      defaults.push(cache[ns + 'properties/' + property] || '');
    }
  }

  var answers = defaults;

  // Edit in console?
  if (pipe === undefined) {
    // Output help
    print('This utility will walk you through setting up a consumer capability.');
    print('It only covers the most common items, and tries to guess sensible defaults.\n');

    print('Press ^C at any time to quit.\n');

    // Ask questions
    answers = await questions(
      properties,
      defaults);

    // Prompt to write
    print('\nAbout to publish properties:\n');

    print('version = ' + version);
    print('scope = ' + scope);

    for (var n = 0; n < properties.length; n++)
      print(properties[n] + ' = ' + answers[n]);

    await confirmation();
  }

  // Update new values
  await put(ns + 'version', version);
  await put(ns + 'scope', scope);

  for (var n = 0; n < properties.length; n++)
    await put(ns + 'properties/' + properties[n], answers[n]);

  cd(ns);
}

// Display profile connections
function conns(arg1, arg2, arg3, arg4) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1, '*');
  const context = argument(arg2, '*');
  const role = argument(arg3, '*');
  const profile = argument(arg4, '*');

  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/connections/*/';

  const nodes = {};
  const keys = filter(cache, ns + '*');

  for (const key in keys) {
    const parts = key.split('/');

    const node = parts[3];
    const context = parts[5];
    const role = parts[6];
    const profile = parts[7];
    const conn = parts[9];
//    const other = parts[10];

    parts.pop();

    if (nodes[node] === undefined)
      nodes[node] = {};

    const contexts = nodes[node];

    if (contexts[context] === undefined)
      contexts[context] = {};

    const roles = contexts[context];

    if (roles[role] === undefined)
      roles[role] = {};

    const profiles = roles[role];

    if (profiles[profile] === undefined)
      profiles[profile] = {};

    const connections = profiles[profile];

    if (connections[conn] === undefined)
      connections[conn] = {};

    const properties = connections[conn];
    const keys = filter(cache, parts.join('/') + '/properties/*');

    for (const key in keys) {
      const parts = key.split('/');
      const property = parts.pop();

      properties[property] = keys[key];
    }
  }

  display('nodes', nodes);


//console.log(keys);

}

/*
// Map network
async function map(arg1, arg2) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1);
  const context = argument(arg2);

  // Map properties
  function properties(node, context, role, profile, connection) {
    const props = {};
    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/connections/' + connection + '/properties/*');

    for (const key in keys) {
      const parts = key.split('/');
      const property = parts[11];

      props[property] = keys[key];
    }
    return props;
  }

  // Map connections
  function connections(node, context, role, profile) {
    const anti = (role === 'provider')?'consumer':'provider';

    const conns = {};*/
//    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/connections/*/' + anti);
/*
    for (const key in keys) {
      const parts = key.split('/');
      const connection = parts[9];

      conns[connection] = properties(node, context, role, profile, connection);
    }
    return conns;
  }

  // Map profiles
  function profiles(node, context, role) {
    const profiles = {};*/
//    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/*/version');
/*
    for (const key in keys) {
      const parts = key.split('/');
      const profile = parts[7];

      profiles[profile] = connections(node, context, role, profile);
    }
    return profiles;
  }

  // Map capabilities
  function capabilities(node, context) {
    const capabilities = {};

    const provider = profiles(node, context, 'provider');
    const consumer = profiles(node, context, 'consumer');

    if (Object.keys(provider).length > 0) capabilities.provider = provider;
    if (Object.keys(consumer).length > 0) capabilities.consumer = consumer;

    return capabilities;
  }

  // Map contexts
  function contexts(node) {
    const contexts = {};*/
//    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/*/name');
/*
    for (const key in keys) {
      const parts = key.split('/');
      const context = parts[5];

      contexts[context] = capabilities(node, context);
    }
    return contexts;
  }

  // Map nodes
  function nodes() {
    const nodes = {};*/
//    const keys = filter(cache, 'cns/network/nodes/*/name');
/*
    for (const key in keys) {
      const parts = key.split('/');
      const node = parts[3];

      nodes[node] = contexts(node);
    }
    return nodes;
  }

  // Map network?
  if (node === undefined) {
    display('nodes', nodes());
    return;
  }

  // Map node?
  if (context === undefined) {
    display(node, contexts(node));
    return;
  }

  // Map context
  display(context, capabilities(node, context));
}*/

// Find matching keys
function find(arg1) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const search = required(arg1);
  const wildcard = '*' + search + '*';

  var ns;

  var keys = {};
  var total = 0;

  for (const key in cache) {
    // Ignore profiles
    if (key.startsWith('cns/network/profiles/')) continue;

    // Has name, version or consumer?
    const t1 = key.endsWith('/name');
    const t2 = key.endsWith('/version');
    const t3 = key.endsWith('/consumer');

    if (t1 || t2 || t3) {
      const parts = key.split('/');

      const id = parts[parts.length - 2] || '';
      const name = t1?cache[key]:'';

      if (match(id, wildcard) || (t1 && match(name, wildcard))) {
        parts.pop();

        ns = parts.join('/');
        if (t3) ns += '/properties';

        keys[ns] = name;
        total++;
      }
    }
  }

  // Show found keys
  display('found', keys);

  if (total === 1) cd(ns);
}

// Display path
function pwd() {
  display('path', namespace);
}

// Set path
function cd(arg1) {
  const loc = argument(arg1, '~');
  namespace = location(loc);
}

// List keys
async function ls(arg1, arg2) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const loc = argument(arg1, '');
  const prefix = wildcard(loc);

  var root = [];
  var wild = false;

  const parts = prefix.split('/');

  for (const part of parts) {
    if (part.includes('*')) {
      wild = true;
      break;
    }
    root.push(part);
  }

  const blank = (loc === '');
  const missing = (!wild && cache[prefix] === undefined);

  if (!wild && !blank && !missing) root.pop();

  // Filter keys
  const ns = prefix + ((blank || missing)?'/*':'');
  const keys = filter(cache, ns);

  // Reduce key names
  const from = root.join('/');
  const reduce = {};

  for (const key in keys) {
    const name = key.replace(from + '/', '');
    reduce[name] = keys[key];
  }
  display(from, reduce);
}

// Get key value
async function get(arg1) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const loc = required(arg1);
  const key = location(loc);

  const value = await client.get(key)
    .string()
    .catch((e) => {
      // Failure
      throw new Error(E_GET + ': ' + e.message);
    });

  // Success
  broadcast({
    stats: {reads: ++stats.reads}
  });

  display(key, value);
}

// Put key value
async function put(arg1, arg2) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const loc = required(arg1);
  const value = required(arg2);

  const key = location(loc);

  await client.put(key)
    .value(value)
    .catch((e) => {
      // Failure
      throw new Error(E_PUT + ': ' + e.message);
    });

  // Success
  broadcast({
    stats: {writes: ++stats.writes}
  });
}

// Delete key
async function del(arg1) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const loc = required(arg1);
  const key = location(loc);

  await client.delete()
    .key(key)
    .catch((e) => {
      // Failure
      throw new Error(E_DEL + ': ' + e.message);
    });

  // Success
  broadcast({
    stats: {writes: ++stats.writes}
  });
}

// Purge keys
async function purge(arg1) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const loc = required(arg1);
  const prefix = location(loc);

  await client.delete()
    .prefix(prefix)
    .catch((e) => {
      // Failure
      throw new Error(E_PURGE + ': ' + e.message);
    });

  // Success
  broadcast({
    stats: {writes: ++stats.writes}
  });
}

// Clear screen
function cls() {
  if (pipe === undefined)
    console.clear();
}

// Echo to console
function echo(...args) {
  var newline = true;
  var text = '';

  for (const arg of args) {
    if (text.length === 0) {
      // Suppress newline?
      if (arg === '-n') {
        newline = false;
        continue;
      }
    } else text += ' ';

    text += argument(arg);
  }

  if (newline) text += '\n';

  if (!transmit(text))
    process.stdout.write(text.green);
}

// Read from console
async function ask(arg1, arg2) {
  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  const prompt = argument(arg1, '');
  const def = argument(arg2);

  reply = await input(prompt, def);

  // Terminate script?
  if (reply === null || (prompt.endsWith('?') && reply === 'no'))
    throw new Error(E_ABORT);
}

// Issue http request
async function curl(arg1, arg2, arg3) {
  const url = required(arg1);
  const method = argument(arg2, 'GET');
  const data = argument(arg3);

  // Send request
  var result = await request(method, url, data);
  if (!result.endsWith('\n')) result += '\n';

  if (!transmit(result))
    process.stdout.write(result.green);
}

// Wait some time
async function wait(arg1) {
  const ms = period(arg1);
  await sleep(ms);
}

// Run script file
async function run(arg1) {
  const file = extension(required(arg1), '.cns');

  // Read file
  const data = read(file);
  const lines = data.split('\n');

  // Process lines
  for (var l = 0; l < lines.length; l++) {
    const line = lines[l];

    // Ignore hashbang
    if (l === 0 && line.startsWith('#!'))
      continue;

    try {
      // Execute line
      await command(line);
    } catch(e) {
      // Failure
      throw new Error(file + ': line ' + (l + 1) + ': ' + e.message);
    }
  }
}

// Terminate program
async function exit(arg1) {
  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  const code = argument(arg1, 0) | 0;

  // Shutdown
  if (client !== undefined)
    await disconnect();

  stop();
  close();

  // Exit process
  process.exit(code);
}

// Format output
function display(root, value) {
  // Format and display
  const text = format(root, value).trimEnd();
  if (text !== '') print(text);
}

// Format output value
function format(root, value) {
  // Valid for output?
  if (value !== undefined && value !== null &&
    (typeof value !== 'object' || Object.keys(value).length > 0)) {
    // What output format?
    switch (options.format) {
      case F_TEXT:
        return text(root, value, '');
      case F_TREE:
        return tree(root, value);
      case F_TABLE:
        return table(root, value);
      case F_JSON:
        return json(root, value);
      case F_XML:
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml(root, value, '');
    }
  }
  return '';
}

// Format as text
function text(root, value, level) {
  if (typeof value === 'object') {
    var t = level + root + ':\n';

    level += indent(' ');

    for (const name in value)
      t += text(name, value[name], level);

    return t;
  }
  return level + root + ' = ' + value.toString() + '\n';
}

// Format as tree
function tree(root, value) {
  if (typeof value === 'object') {
    const t = [root];
    const v = generateTree(value);

    parseTree(v);
    renderTree(v, t);

    return t.join('\n');
  }
  return value.toString();
}

// Format as table
function table(root, value) {
  const t = [];

  if (typeof value === 'object') {
    for (const name in value) {
      var v = value[name];

      if (typeof v === 'object')
        v = table(name, v).trimEnd();

      t.push([name, v]);
    }
  } else t.push([root, value.toString()]);

  return (t.length === 0)?'':tables.table(t);
}

// Forat as json
function json(root, value) {
  const data = {};
  data[root] = value;

  return JSON.stringify(data, null, indent());
}

// Format as xml
function xml(root, value, level) {
  const nl = (indent() > 0)?'\n':'';

  if (typeof value === 'object') {
    var t = level + '<group name="' + root + '">' + nl;
    var c = level + '</group>' + nl;

    level += indent(' ');

    for (const name in value)
      t += xml(name, value[name], level);

    return t + c;
  }
  return level + '<item name="' + root + '" value="' + value.toString() + '"/>' + nl;
}

// Generate tree data
function generateTree(obj) {
  const t = [];

  for (const name in obj) {
    const value = obj[name];

    const item = {
      name: name,
      value: ''
    };

    if (typeof value === 'object')
      item.children = generateTree(value);
    else item.value = value.toString();

    t.push(item);
  }
  return t;
}

// Parse tree data
function parseTree(data, parent) {
  // Parse items
  const l = data.length;

  for (var n = 0; n < l; n++) {
    const item = data[n];

    item.last = (n === l - 1);
    item.parents = [];

    // Add parent info
    if (parent !== undefined && parent.parents !== undefined) {
      item.parents = parent.parents.slice();

      item.parents.push({
        last: parent.last
      });
    }

    // Parse children?
    if (item.children !== undefined && item.children.length > 0)
      parseTree(item.children, item);
  }
}

// Render tree data
function renderTree(data, render) {
  // Indent chars
  const p1 = indent(' ') + ' ';
  const p2 = indent('─') + ' ';

  // Parse items
  for (const item of data) {
    // Get name and indent
    var name = '';

    for (const parent of item.parents)
      name += (parent.last?' ':'│') + p1;

    name += (item.last?'└':'├') + p2 + item.name;

    // Add item
    render.push(justify(name, item.value));

    // Parse children?
    if (item.children !== undefined && item.children.length > 0)
      renderTree(item.children, render);
  }
}

// Justify name value pair
function justify(name, value) {
  name += '  ';

  const cols = columns();
  const span = cols - name.length - value.length;

  return (span > 0)?
    ((value === '')?name:(name + ' '.repeat(span) + value)):
    ((name + value).substr(0, cols - 1) + '…');
}

// Get indent
function indent(char) {
  const size = Math.min(Math.max(options.indent, 0), 8);
  return (char === undefined)?size:char.repeat(size);
}

// Get column count
function columns() {
  return options.columns || process.stdout.columns || 80;
}

// Get row count
function rows() {
  return options.rows || process.stdout.rows || 25;
}

// Ask for confirmation
async function confirmation() {
  const answer = await input('\nIs this OK?');

  if (answer === null || answer === 'no')
    throw new Error(E_ABORT);
}

// Ask multiple questions
async function questions(prompts, defs) {
  const answers = [];

  for (var n = 0; n < prompts.length; n++) {
    const answer = await input(prompts[n], defs[n]);
    if (answer === null) throw new Error(E_ABORT);

    answers.push(answer);
  }
  return answers;
}

// Ask for input
async function input(prompt, def) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Suspend console
    const history = suspend();

    // Create readline
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    // Ctrl+C
    .on('SIGINT', () => {
      // Abort input
      resume(rl, history);
      resolve(null);
    });

    // Hide input?
    if (def === null) {
      // Override output handler
      rl._writeToOutput = (s) => {
        if (s !== '\n' && s !== '\r' && s !== '\r\n') {
          // Hide user input
          if (s.startsWith(prompt))
            s = prompt + '*'.repeat(rl.line.length);
          else s = '*';
        }
        rl.output.write(s);
      };
    }

    // Is a question?
    const yn = prompt.endsWith('?');

    if (prompt !== '') {
      if (yn) prompt += ' (yes/no)';
      prompt += ': ';
    }

    // Get input
    rl.question(prompt, (answer) => {
      // Resume console
      resume(rl, history);

      // Decode answer
      answer = variable(answer.trim());

      if (yn) {
        switch (answer.toLowerCase()) {
          case 'y':
          case 'yes':
            answer = 'yes';
            break;
          default:
            answer = 'no';
            break;
        }
      }
      resolve(answer);
    });

    // Start with default?
    if (def) rl.write(def);
  });
}

// Get profile descriptors
async function getDescriptors() {
  if (descriptors === undefined) {
    descriptors = {};

    const profiles = JSON.parse(await request('GET', PROFILE_HOST));

    for (const profile of profiles) {
      const id = profile.name;
      const name = profile.title || '';

      descriptors[id] = name;
    }
  }
  return descriptors;
}

// Get network profiles
function getProfiles() {
  const profiles = {};

  const prefix = 'cns/network/profiles/*/name';
  const keys = filter(cache, prefix);

  for (const key in keys) {
    const parts = key.split('/');
    const profile = parts[3];

    profiles[profile] = keys[key];
  }
  return profiles;
}

// Get profile versions
function getVersions(profile) {
  const versions = {};

  const prefix = 'cns/network/profiles/' + profile + '/versions/*/name';
  const keys = filter(cache, prefix);

  for (const key in keys) {
    const parts = key.split('/');
    const version = parts[5];

    versions[version] = keys[key];
  }
  return versions;
}

// Get profile version properties
function getProperties(profile, version) {
  const properties = {};

  const prefix = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/*/name';
  const keys = filter(cache, prefix);

  for (const key in keys) {
    const parts = key.split('/');
    const version = parts[7];

    properties[version] = keys[key];
  }
  return properties;
}

// Get network nodes
function getNodes() {
  const nodes = {};

  const prefix = 'cns/network/nodes/*/name';
  const keys = filter(cache, prefix);

  for (const key in keys) {
    const parts = key.split('/');
    const node = parts[3];

    nodes[node] = keys[key];
  }
  return nodes;
}

// Get node contexts
function getContexts(node) {
  const contexts = {};

  const prefix = 'cns/network/nodes/' + node + '/contexts/*/name';
  const keys = filter(cache, prefix);

  for (const key in keys) {
    const parts = key.split('/');
    const context = parts[5];

    contexts[context] = keys[key];
  }
  return contexts;
}

// Get context capabilities
function getCapabilities(node, context, role) {
  const profiles = {};

  const prefix = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/*/version';
  const keys = filter(cache, prefix);

  for (const key in keys) {
    const parts = key.split('/');
    const profile = parts[7];

    profiles[profile] = 'Version ' + Number(keys[key]);
  }
  return profiles;
}

// Filter keys
function filter(keys, filter) {
  const result = {};
  const filters = filter.split('/');

  for (const key in keys) {
    if (compare(key, filters))
      result[key] = keys[key];
  }
  return result;
}

// Compare key with filters
function compare(key, filters) {
  const keys = key.split('/');

  if (keys.length === filters.length) {
    for (var n = 0; n < keys.length; n++)
      if (!match(keys[n], filters[n])) return false;

    return true;
  }
  return false;
}

// Wildcard match
function match(text, filter) {
  const esc = (s) => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
  return new RegExp('^' + filter.split('*').map(esc).join('.*') + '$', 'i').test(text);
}

// Start dashboard server
function start(host, port) {
  // Stop previous
  stop();

  // Initialize express
  const app = new express();

  app.use(compression());
  app.use(express.static(path.join(__dirname, '/public')));

  debug('Creating webserver...');

  // Create server
  server = http.createServer(app)
  // Started
  .on('listening', () => {
    // Create web socket
    debug('Creating websocket...');
    wss = expressws(app, server).getWss();

    // Web socket request
    app.ws('/', async (ws, req) => {
      // Receive
      ws.on('message', async (packet) => {
        debug('Websocket request: ' + packet);
        await receive(ws, packet);
      })
      // Close
      .on('close', () => {
        debug('Websocket disconnect...');
      })
      // Failure
      .on('error', (e) => {
        debug('Websocket error: ' + e.message);
      });

      // Initial changes
      debug('Websocket connect...');

      ws.send(JSON.stringify({
        version: pack.version,
        stats: stats,
        keys: cache
      }));
    });

    // All other requests
    app.use((req, res) => {
      res.status(404).send('<h1>Page not found</h1>');
    });

    print('CNS Dashboard running on http://' + host + ':' + port);
  })
  // Failure
  .on('error', (e) => {
    error(e);
  });

  // Start listening
  server.listen(port);
}

// Receive socket command
async function receive(ws, packet) {
  try {
    const data = JSON.parse(packet);

    const transaction = data.transaction;
    const format = data.format;
    const cmd = data.command;

    // Invalid packet?
    if (!transaction || !cmd)
      throw new Error(E_AVAILABLE);

    // Using format?
    var oldformat;

    if (format) {
      oldformat = options.format;
      options.format = format;
    }

    // Pipe to socket
    pipe = ws;
    buffer = '';

    try {
      await command(cmd);
    } catch(e) {
      // Failure
      broadcast({
        stats: {errors: ++stats.errors}
      });

      display('error', e.message);
    }

    // Format as json?
    if (options.format === F_JSON && buffer.startsWith('{'))
      buffer = JSON.parse(buffer);

    // Create response
    const response = JSON.stringify({
      transaction: transaction,
      format: options.format,
      response: buffer
    });

    // Restore pipe
    pipe = undefined;
    buffer = undefined;

    if (format)
      options.format = oldformat;

    // Send response
    debug('Websocket response: ' + response);
    ws.send(response);
  } catch(e) {
    // Failure
    broadcast({
      stats: {errors: ++stats.errors}
    });

    error(e);
  }
}

// Update key value
function update(key, value) {
  const keys = {};
  keys[key] = value;

  broadcast({
    stats: {updates: ++stats.updates},
    keys: keys
  });
}

// Buffer pipe response
function transmit(text) {
  if (pipe !== undefined) {
    buffer += text;
    return true;
  }
  return false;
}

// Broadcast to clients
function broadcast(changes) {
  if (wss === undefined) return;

  try {
    // Stringify packet
    const packet = JSON.stringify(changes);

    // Broadcast to all clients
    wss.clients.forEach((ws) => {
      ws.send(packet);
    });
  } catch(e) {
    // Failure
    debug(e.message);
  }
}

// Stop dashboard server
function stop() {
  // Close socket server
  if (wss !== undefined) {
    debug('Closing websocket...');

    wss.close();
    wss = undefined;
  }

  // Close web server
  if (server !== undefined) {
    debug('Closing webserver...');

    server.close();
    server = undefined;
  }
}

// Get http request
function request(method, url, data) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Decode url
    const decode = new URL(url.startsWith('localhost')?('http://' + url):url);
    const handler = (decode.protocol === 'https:')?https:http;

    const options = {
      protocol: decode.protocol,
      hostname: decode.hostname,
      port: decode.port,
      path: decode.pathname + decode.search,
      method: method
    };

    // Send request
    debug('Requesting ' + url + '...');

    const req = handler
      .request(options, (res) => resolve(res))
      .on('error', (e) => reject(e));

    // Post request?
    if (method === 'POST') {
      // No data defined?
      if (data === undefined)
        throw new Error(E_MISSING);

      req.write(data);
    }
    req.end();
  })
  .then((result) => {
    // Get response
    return response(result);
  });
}

// Get http response
function response(res) {
  // Status ok?
  if (res.statusCode !== 200)
    throw new Error(res.statusCode + ' ' + res.statusMessage);

  // I promise to
  return new Promise((resolve, reject) => {
    // Collate data
    var data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => resolve(data));
    res.on('error', (e) => reject(e));
  });
}

// Generation comment
function comment() {
  return escape('// Generated by \\s on \\A\n');
}

// Ensure extension
function extension(file, ext) {
  return file.endsWith(ext)?file:(file + ext);
}

// Read from file
function read(file) {
  // Missing file name?
  if (file === undefined)
    throw new Error(E_MISSING);

  try {
    // Read file
    debug('Reading ' + file + '...');
    return fs.readFileSync(file, 'utf8');
  } catch(e) {
    // Failure
    throw new Error(E_READ + ': ' + file);
  }
}

// Write to file
function write(file, data) {
  // Missing file name?
  if (file === undefined)
    throw new Error(E_MISSING);

  try {
    // Write file
    debug('Writing ' + file + '...');
    fs.writeFileSync(file, data, 'utf8');
  } catch(e) {
    // Failure
    throw new Error(E_WRITE + ': ' + file);
  }
}

// Go to sleep
function sleep(ms) {
  // I promise to
  return new Promise((resolve) => {
    if (ms !== 0) {
      // Wait for timeout
      const timer = setTimeout(() => {
        signal = undefined;
        resolve();
      }, ms);

      // Break signal handler
      signal = () => {
        clearTimeout(timer);
        resolve();
      };
    } else {
      // Wait forever
      signal = () => {
        resolve();
      };
    }
  });
}

// Format timestamp
function toTimestamp() {
  return new Date().toISOString();
}

// Format date
function toDate(format) {
  return new Date()
    .toLocaleDateString([], format)
    .replaceAll(',', '')
    .toUpperCase();
}

// Format time
function toTime(format) {
  return new Date()
    .toLocaleTimeString([], format)
    .replaceAll(',', '')
    .toUpperCase();
}

// Log text to console
function print(text) {
  if (!options.silent && !transmit(text + '\n'))
    console.log(text.green);
}

// Log debug to console
function debug(text) {
  if (options.debug && !transmit(text + '\n'))
    console.debug(text.magenta);
}

// Log error to console
function error(e) {
  // Catch command abort
  if (e.message === E_ABORT) {
    print('\n' + E_ABORT);
    return;
  }

  if (!transmit(e.message + '\n'))
    console.error(e.message.red);

  debug(e.stack);
}

// Catch terminate signal
process.on('SIGINT', () => {
  print('\r' + E_ABORT);
  exit(1);
});

// Start application
main(process.argv.slice(2));
