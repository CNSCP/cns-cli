#!/usr/bin/env node

// index.js - CNS Command line
// Copyright 2025 Padi, Inc. All Rights Reserved.

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
const os = require('os');
const cp = require('child_process');

const pack = require('./package.json');

// Errors

const E_OPTION = 'Illegal option';
const E_MISSING = 'Missing argument';
const E_COMMAND = 'Illegal command';
const E_ARGUMENT = 'Invalid argument';
const E_VARIABLE = 'Invalid variable';
const E_PERIOD = 'Invalid period';
const E_MISSMATCH = 'Type missmatch';
const E_CONFIG = 'Not configured';
const E_AVAILABLE = 'Not available';
const E_CONNECT = 'Not connected';
const E_FOUND = 'Not found';
const E_USERS = 'Failed to get users';
const E_ROLES = 'Failed to get roles';
const E_INSTALL = 'Failed to install';
const E_WATCH = 'Failed to watch';
const E_LIST = 'Failed to list';
const E_GET = 'Failed to get';
const E_PUT = 'Failed to put';
const E_DEL = 'Failed to del';
const E_PURGE = 'Failed to purge';
const E_SPAWN = 'Failed to spawn';
const E_READ = 'Failed to read';
const E_WRITE = 'Failed to write';
//const E_ABORT = 'Aborted.';

// Constants

const HOME = 'cns/network';

const DATE_SHORT = {day: '2-digit', month: '2-digit', year: 'numeric'};
const DATE_LONG = {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'};

const TIME_SHORT = {hour: '2-digit', minute: '2-digit'};
const TIME_LONG = {hour: 'numeric', minute: '2-digit', hour12: true};

// Defaults

const defaults = {
  host: '127.0.0.1',
  port: '2379',
  username: '',
  password: ''
};

// Configuration

const config = {
  host: process.env.CNS_HOST || defaults.host,
  port: process.env.CNS_PORT || defaults.port,
  username: process.env.CNS_USERNAME || defaults.username,
  password: process.env.CNS_PASSWORD || defaults.password
};

// Options

const options = {
  prompt: '\\w> ',
  format: 'tree',
  indent: 2,
  columns: 0,
  rows: 0,
  silent: false,
  debug: false
};

// System

const system = {
  name: os.hostname(),
  address: 'unknown',
  mask: 'unknown',
  arch: os.arch(),
  platform: os.platform(),
  release: os.release()
};

// Stats

const stats = {
  started: new Date().toISOString(),
  reads: 0,
  writes: 0,
  updates: 0,
  errors: 0,
  connection: 'offline'
};

// Commands

const commands = {
  'help': help,
  'version': version,
  'init': init,
  'config': configure,
  'output': output,
  'device': device,
  'status': status,
  'dashboard': dashboard,
  'connect': connect,
  'users': users,
  'roles': roles,
  'network': network,
  'install': install,
  'profiles': profiles,
  'nodes': nodes,
  'contexts': contexts,
  'provider': provider,
  'consumer': consumer,
  // connections [conn]
  // sanitize
  // optimize
  // backup file
  // restore file
  'map': map,
  // top (changes)
  'find': find,
  'pwd': pwd,
  'cd': cd,
  'ls': ls,
  'get': get,
  'put': put,
  'del': del,
  'purge': purge,
  // log key
  // push (network to etcd server)
  // pull (network from etcd server)
  // on error break|resume
  // on key command
  // every ms command
  // clear
  'disconnect': disconnect,
  'cls': cls,
  'echo': echo,
  'ask': ask,
  // if expr command
  // foreach command ($for)
  // :label
  // goto label
  // gosub label
  // return
  // break
  'exec': exec,
  'curl': curl,
  'wait': wait,
  'history': history,
  'save': save,
  'load': load,
  // run file
  'exit': exit,
  'quit': exit
};

// Shortcuts

const shortcuts = {
  'h': 'help',
  'v': 'version',
  'i': 'init',
  'c': 'config',
  'o': 'output',
  'd': 'device',
  's': 'status',
  '?': 'echo',
  'e': 'exit',
  'q': 'quit'
};

// Local data

var client;
var cache;
var watcher;

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
  try {
    // Update system
    getAddress();
    getMemory();

    // Parse options
    const cmds = parse(argv);

    try {
      // Connect to key store?
      await connect();
    } catch(e) {
      // Failure
    }

    // Process command?
    if (cmds !== '') {
      await command(cmds);

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
  print('Usage: cns [options] [ script.cns ] [command]\n');

  print('Options:');
  phint('-h, --help', 'Output usage information');
  phint('-v, --version', 'Output version information');
  phint('-H, --host uri', 'Set network host');
  phint('-P, --port number', 'Set network port');
  phint('-u, --username string', 'Set network username');
  phint('-p, --password string', 'Set network password');
  phint('-o, --output format', 'Set output format');
  phint('-i, --indent size', 'Set output indent size');
  phint('-c, --columns size', 'Set output column limit');
  phint('-r, --rows size', 'Set output row limit');
  phint('-m, --monochrome', 'Disable console colours');
  phint('-s, --silent', 'Disable console output');
  phint('-d, --debug', 'Enable debug output\n');

  print('Commands:');
  help();

  print('\nEnvironment:');
  phint('CNS_HOST', 'Default network host');
  phint('CNS_PORT', 'Default network port');
  phint('CNS_USERNAME', 'Default network username');
  phint('CNS_PASSWORD', 'Default network password\n');

  print('Documentation can be found at https://github.com/cnscp/cns-cli/');
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
        cmds.push('load "' + arg + '";');
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
    prompt: escape(options.prompt)
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
      stats.errors++;
      broadcast();

      error(e);
    }

    // Next prompt
    prompt();
  })
  // Ctrl+C
  .on('SIGINT', () => {
    // Catch signal
    if (signal !== undefined) {
      print('\rAborted.');

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
  if (terminal !== undefined && !options.silent)
    terminal.prompt();
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
  // Update system vars
  getMemory();

  // Expression eval?
  if (line.startsWith('!')) {
    console.log(eval(line.substr(1)));
    return;
  }

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
    const cmd = arg.toLowerCase();

    const fn = commands[shortcuts[cmd] || cmd];

    // Not a command?
    if (fn === undefined)
      throw new Error(E_COMMAND + ': ' + arg);

    // Too many args?
    const len = args.length;

    if (cmd !== '?' && cmd !== 'echo' && cmd !== 'exec' && len > fn.length)
      throw new Error(E_ARGUMENT + ': ' + args[len - 1]);

    // Call command
    await fn.apply(this, args);
  }
}

// Get command argument
function argument(arg, def) {
  const value = (arg === undefined)?def:arg;

  // Expand variables
  if (typeof value === 'string')
    return variable(value);

  return value;
}

// Get required argument
function required(arg) {
  const value = argument(arg);

  // No value?
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
    case 'h': return period * 1000 * 60 * 60;
    case 'm': return period * 1000 * 60;
    case 's': return period * 1000;
    case 'ms':
    case '': return period;
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
        data = new Date().toISOString();
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
// command line if numeric
        data = process.env[name];

        if (data === undefined) data = config[name];
        if (data === undefined) data = options[name];
        if (data === undefined) data = system[name];
        if (data === undefined) data = stats[name];
//        if (data === undefined) data = cache[name];
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
  while (match = value.match(/\\([uhHsvVwWAdDtT])/)) {
    // Find code
    const found = match[0];
    const name = match[1];

    var df;
    var tf;

    var data = '';

    switch (name) {
      case 'u': data = config.username; break;
      case 'h': data = config.host.match(/^(.*?\:\/\/)?([^:]*)/)[2]; break;
      case 'H': data = config.host; break;
      case 's': data = pack.name; break;
      case 'v': const v = pack.version.split('.'); v.pop(); data = v.join('.'); break;
      case 'V': data = pack.version; break;
      case 'w': data = shorten(namespace); break;
      case 'W': data = namespace.split('/').pop(); break;
//      case 'p': const ns = shorten(namespace), n = ns.split('/'); data = (n.length > 2)?(n.shift() + '/../' + n.pop()):ns; break;
      case 'A': data = new Date().toISOString(); break;
      case 'd': df = DATE_SHORT; break;
      case 'D': df = DATE_LONG; break;
      case 't': tf = TIME_SHORT; break;
      case 'T': tf = TIME_LONG; break;
    }

    if (df) data = new Date().toLocaleDateString([], df).replaceAll(',', '').toUpperCase();
    if (tf) data = new Date().toLocaleTimeString([], tf).replaceAll(',', '').toUpperCase();

    // Replace with value
    value = value.replaceAll(found, data);
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
  phint('help', 'Output help information');
  phint('version', 'Output version information');
  phint('init', 'Initialize config file');
  phint('config [name] [value]', 'Display or set config properties');
  phint('output [name] [value]', 'Display or set output properties');
  phint('device [-n] [name]', 'Display device properties');
  phint('status [name]', 'Display status properties');
  phint('dashboard [port]', 'Start CNS Dashboard service');
  phint('connect', 'Connect to network');
  phint('users', 'Display network users');
  phint('roles', 'Display user roles');
  phint('network', 'Configure network properties');
  phint('install url', 'Configure profile from url');
  phint('profiles [profile]', 'Configure profile properties');
  phint('nodes [node]', 'Configure node properties');
  phint('contexts [node] [context]', 'Configure context properties');
  phint('provider [node] [context] [profile]', 'Configure provider properties');
  phint('consumer [node] [context] [profile]', 'Configure consumer properties');
  phint('map', 'Display network map');
  phint('find [filter]', 'Find matching keys');
  phint('pwd', 'Display current key path');
  phint('cd [key]', 'Change current key path');
  phint('ls [-l] [key]', 'List key values');
  phint('get key', 'Get key value');
  phint('put key value', 'Put key value');
  phint('del key', 'Delete key entry');
  phint('purge prefix', 'Delete matching key entries');
  phint('disconnect', 'Disconnect from network');
  phint('cls', 'Clear the screen');
  phint('echo [-n] [string]', 'Write to standard output');
  phint('ask [prompt] [default]', 'Read from standard input');
  phint('exec file', 'Spawn process');
  phint('curl url [method] [data]', 'Send http request to url');
  phint('wait [period]', 'Wait for specified time period');
  phint('history [-c]', 'Display terminal history');
  phint('save file', 'Save history to script file');
  phint('load file', 'Load and execute script file');
  phint('exit [code]', 'Exit the console with code');
  phint('quit', 'Quit the console');

  // Console mode?
  if (terminal !== undefined && pipe === undefined)
    print('\nPress Ctrl+C to abort current command, Ctrl+D to exit the console.');
}

// Show version
function version() {
  display('version', pack.version);
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
    config.password
  ]);

  if (answers === null) return;

  // Update new values
  config.host = answers[0];
  config.port = answers[1];
  config.username = answers[2];
  config.password = answers[3];

  // Prompt to write
  print('\nAbout to write .env file:\n');

  print('CNS_HOST = ' + answers[0]);
  print('CNS_PORT = ' + answers[1]);
  print('CNS_USERNAME = ' + answers[2]);
  print('CNS_PASSWORD = ' + answers[3]);

  if (!await confirmation()) return;

  // Store and re-connect
  await store();
  await connect();
}

// Set config property
async function configure(arg1, arg2) {
  const name = argument(arg1);
  const value = argument(arg2);

  property('config', config, name, value);

  if (value === undefined) return;

  // Store and re-connect
  await store();
  await connect();
}

// Set output property
function output(arg1, arg2) {
  const name = argument(arg1);
  const value = argument(arg2);

  property('output', options, name, value);

  if (value === undefined) return;

  if (name === 'prompt' && terminal !== undefined)
    terminal.setPrompt(escape(options.prompt));
}

// Display device properties
function device(arg1) {
  const name = argument(arg1);

  // Display network interfaces?
  if (name === '-n') {
    const nets = os.networkInterfaces();
    property('device', nets);
    return;
  }
  property('device', system, name);
}

// Display status properties
function status(arg1) {
  const name = argument(arg1);
  property('status', stats, name);
}

// Start dashboard server
function dashboard(arg1) {
  const host = 'localhost';
  const port = argument(arg1, '8080');

  start(host, port);
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
      throw new Error(E_CONNECT + ': ' + e.message);
    });

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

//      debug('PUT ' + key + ' = ' + value);
      cache[key] = value;

      stats.updates++;
      broadcast();
    })
    .on('delete', (change) => {
      // Key deleted
      const key = change.key.toString();
      const value = change.value.toString();

//      debug('DEL ' + key);
      delete cache[key];

      stats.updates++;
      broadcast();
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
  cd();

  stats.connection = 'online';
  broadcast();
}

// Display users
async function users() {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  // Get users
  const users = await client.getUsers()
    .catch((e) => {
      // Failure
      throw new Error(E_USERS + ': ' + e.message);
    });

  // Success
  const u = {};

  for (const user of users) {
    const name = user.name;
    const roles = await user.roles();

    const r = [];

    for (const role of roles)
      r.push(role.name);

    u[name] = r.join(', ');
  }
  display('users', u);
}

// Display roles
async function roles() {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  // Get roles
  const roles = await client.getRoles()
    .catch((e) => {
      // Failure
      throw new Error(E_ROLES + ': ' + e.message);
    });

  // Success
  const r = {};

  for (const role of roles) {
    const name = role.name;
    const perms = await role.permissions();

    const p = [];

    for (const perm of perms)
      p.push(perm.permission);

    r[name] = p.join(', ');
  }
  display('roles', r);
}

// Configure network
async function network() {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

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
      cache[ns + 'name'] || 'My Network',
      cache[ns + 'orchestrator'] || 'contexts',
      cache[ns + 'token'] || ''
    ]);

  if (answers === null) return;

  // Prompt to write
  print('\nAbout to publish properties:\n');

  print('name = ' + answers[0]);
  print('orchestrator = ' + answers[1]);
  print('token = ' + answers[2]);

  if (!await confirmation()) return;

  // Update new values
  put(ns + 'name', answers[0]);
  put(ns + 'orchestrator', answers[1]);
  put(ns + 'token', answers[2]);

  cd(ns);
}

// Install profile
async function install(arg1) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const url = required(arg1);

  // Send request
  try {
    const data = await request('GET', url);
    const profile = JSON.parse(data);

    const name = profile.name || '';
    const title = profile.title || '';
    const versions = profile.versions || [];

    // Must have a name
    if (typeof name !== 'string' || name === '')
      throw new Error('Not a valid profile descriptor');

    const ns = 'cns/network/profiles/' + name + '/';

    // Purge existing
    await purge(ns + 'versions');//, false);

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
    await put(ns + 'name', title);

//    cd(ns);
  } catch(e) {
    // Failure
    throw new Error(E_INSTALL + ': ' + e.message);
  }
}

// Configure profiles
async function profiles(arg1) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const profile = argument(arg1);

  // List profiles?
  if (profile === undefined) {
    display('profiles', getDescriptors());
    return;
  }

  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  // Output help
  print('This utility will walk you through setting up a profile descriptor.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const ns = 'cns/network/profiles/' + profile + '/';

  const answers = await questions([
      'Profile Name',
      'Profile Version'
    ], [
      cache[ns + 'name'] || 'My Profile',
      '1'
    ]);

  if (answers === null) return;

  // Edit existing properties
  const version = Number(answers[1]) || 1;

  const vs = ns + 'versions/version' + version + '/';
  const keys = filter(cache, vs + 'properties/*/name');

  const properties = {};

  if (Object.keys(keys).length > 0)
    print('\nEdit Version ' + version + ' properties (leave empty to delete).');

  for (const key in keys) {
    const parts = key.split('/');
    const property = parts[7];

    const id = await input('\nProperty Identifier', property);

    if (id === null) return;
    if (id === '') continue;

    const ps = vs + 'properties/' + property + '/';

    const answers = await questions([
        'Property Name',
        'Property from Provider?',
        'Property is Required?',
        'Property can Propagate?'
      ], [
        cache[ps + 'name'] || 'My Property',
        cache[ps + 'provider'] || 'yes',
        cache[ps + 'required'] || 'no',
        cache[ps + 'propagate'] || 'yes'
      ]);

    if (answers === null) return;

    properties[id] = {
      name: answers[0],
      provider: answers[1],
      required: answers[2],
      propagate: answers[3]
    };
  }

  print('\nAdd Version ' + version + ' properties (leave empty to stop).');

  // Add properties
  while (true) {
    const id = await input('\nProperty Identifier');

    if (id === null) return;
    if (id === '') break;

    const answers = await questions([
        'Property Name',
        'Property from Provider?',
        'Property is Required?',
        'Property can Propagate?'
      ], [
        'My Property',
        'yes',
        'no',
        'yes'
      ]);

    if (answers === null) return;

    properties[id] = {
      name: answers[0],
      provider: answers[1],
      required: answers[2],
      propagate: answers[3]
    };
  }

  // Prompt to write
  print('\nAbout to publish properties:\n');

  print('name = ' + answers[0]);
  print('version = ' + version);

  for (const id in properties)
    print(id + ' = ' + properties[id].name);

  if (!await confirmation()) return;

  // Purge previous
  await purge(vs + 'properties');//, false);

  // Update new values
  await put(ns + 'name', answers[0]);
  await put(vs + 'name', 'Version ' + version);

  for (const id in properties) {
    const property = properties[id];

    const ps = vs + 'properties/' + id + '/';

    await put(ps + 'name', property.name);
    await put(ps + 'provider', property.provider);
    await put(ps + 'required', property.required);
    await put(ps + 'propagate', property.propagate);
  }

  cd(ns);
}

// Configure node
async function nodes(arg1) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1);

  // List nodes?
  if (node === undefined) {
    display('nodes', getNodes());
    return;
  }

  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  // Output help
  print('This utility will walk you through setting up a network node.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const ns = 'cns/network/nodes/' + node + '/';

  const answers = await questions([
      'Node Name',
      'Node Upstream',
      'Node Token'
    ], [
      cache[ns + 'name'] || 'My Node',
      cache[ns + 'upstream'] || '',
      cache[ns + 'token'] || ''
    ]);

  if (answers === null) return;

  // Prompt to write
  print('\nAbout to publish properties:\n');

  print('name = ' + answers[0]);
  print('upstream = ' + answers[1]);
  print('token = ' + answers[2]);

  if (!await confirmation()) return;

  // Update new values
  await put(ns + 'name', answers[0]);
  await put(ns + 'upstream', answers[1]);
  await put(ns + 'token', answers[2]);

  cd(ns);
}

// Configure context
async function contexts(arg1, arg2) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1);
  const context = argument(arg2);

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

  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  // Output help
  print('This utility will walk you through setting up a node context.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/';

  const answers = await questions([
      'Context Name',
      'Context Token'
    ], [
      cache[ns + 'name'] || 'My Context',
      cache[ns + 'token'] || ''
    ]);

  if (answers === null) return;

  // Prompt to write
  print('\nAbout to publish properties:\n');

  print('name = ' + answers[0]);
  print('token = ' + answers[1]);

  if (!await confirmation()) return;

  // Update new values
  await put(ns + 'name', answers[0]);
  await put(ns + 'token', answers[1]);

  cd(ns);
}

// Configure provider
async function provider(arg1, arg2, arg3, arg4, arg5) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1);
  const context = argument(arg2);
  const profile = argument(arg3);
  const version = argument(arg4, 1);
  const scope = argument(arg5, 'none');

  // List all providers?
  if (node === undefined) {
    const nodes = getNodes();

    for (const node in nodes) {
      const contexts = getContexts(node);

      for (const context in contexts)
        contexts[context] = getProfiles(node, context, 'provider');

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
      contexts[context] = getProfiles(node, context, 'provider');

    display('contexts', contexts);
    return;
  }

  // Context must exist
  if (cache['cns/network/nodes/' + node + '/contexts/' + context + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + context);

  // List providers?
  if (profile === undefined) {
    display('provider', getProfiles(node, context, 'provider'));
    return;
  }

  // Profile must exist
  if (cache['cns/network/profiles/' + profile + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + profile);

  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  // Output help
  print('This utility will walk you through setting up a provider capability.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/provider/' + profile + '/';
  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/';

  const prompts = [];
  const defaults = [];
  const names = [];

  const keys = filter(cache, ps + '*/name');

  for (const key in keys) {
    const parts = key.split('/');
    const property = parts[7];

    const provider = cache[ps + property + '/provider'];
    const required = cache[ps + property + '/required'];
    const propagate = cache[ps + property + '/propagate'];

    // Provider property?
    if (provider === 'yes') {
      prompts.push('(' + property + ') ' + keys[key]);
      defaults.push(cache[ns + 'properties/' + property] || '');
      names.push(property);
    }
  }

  const answers = await questions(
    prompts,
    defaults);

  if (answers === null) return;

  // Prompt to write
  print('\nAbout to publish properties:\n');

  print('version = ' + version);
  print('scope = ' + scope);

  for (var n = 0; n < names.length; n++)
    print(names[n] + ' = ' + answers[n]);

  if (!await confirmation()) return;

  // Update new values
  await put(ns + 'version', version);
  await put(ns + 'scope', scope);

  for (var n = 0; n < names.length; n++)
    await put(ns + 'properties/' + names[n], answers[n]);

  cd(ns);
}

// Configure consumer
async function consumer(arg1, arg2, arg3, arg4, arg5) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1);
  const context = argument(arg2);
  const profile = argument(arg3);
  const version = argument(arg4, 1);
  const scope = argument(arg5, 'none');

  // List all consumers?
  if (node === undefined) {
    const nodes = getNodes();

    for (const node in nodes) {
      const contexts = getContexts(node);

      for (const context in contexts)
        contexts[context] = getProfiles(node, context, 'consumer');

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
      contexts[context] = getProfiles(node, context, 'consumer');

    display('contexts', contexts);
    return;
  }

  // Context must exist
  if (cache['cns/network/nodes/' + node + '/contexts/' + context + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + context);

  // List consumers?
  if (profile === undefined) {
    display('consumer', getProfiles(node, context, 'consumer'));
    return;
  }

  // Profile must exist
  if (cache['cns/network/profiles/' + profile + '/name'] === undefined)
    throw new Error(E_FOUND + ': ' + profile);

  // Must be console
  if (pipe !== undefined)
    throw new Error(E_AVAILABLE);

  // Output help
  print('This utility will walk you through setting up a consumer capability.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/consumer/' + profile + '/';
  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/';

  const prompts = [];
  const defaults = [];
  const names = [];

  const keys = filter(cache, ps + '*/name');

  for (const key in keys) {
    const parts = key.split('/');
    const property = parts[7];

    const provider = cache[ps + property + '/provider'];
    const required = cache[ps + property + '/required'];
    const propagate = cache[ps + property + '/propagate'];

    // Consumer property?
    if (provider !== 'yes') {
      prompts.push('(' + property + ') ' + keys[key]);
      defaults.push(cache[ns + 'properties/' + property] || '');
      names.push(property);
    }
  }

  const answers = await questions(
    prompts,
    defaults);

  if (answers === null) return;

  // Prompt to write
  print('\nAbout to publish properties:\n');

  print('version = ' + version);
  print('scope = ' + scope);

  for (var n = 0; n < names.length; n++)
    print(names[n] + ' = ' + answers[n]);

  if (!await confirmation()) return;

  // Update new values
  await put(ns + 'version', version);
  await put(ns + 'scope', scope);

  for (var n = 0; n < names.length; n++)
    await put(ns + 'properties/' + names[n], answers[n]);

  cd(ns);
}

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

    const conns = {};
    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/connections/*/' + anti);

    for (const key in keys) {
      const parts = key.split('/');
      const connection = parts[9];

      conns[connection] = properties(node, context, role, profile, connection);
    }
    return conns;
  }

  // Map profiles
  function profiles(node, context, role) {
    const profiles = {};
    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/*/version');

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
    const contexts = {};
    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/*/name');

    for (const key in keys) {
      const parts = key.split('/');
      const context = parts[5];

      contexts[context] = capabilities(node, context);
    }
    return contexts;
  }

  // Map nodes
  function nodes() {
    const nodes = {};
    const keys = filter(cache, 'cns/network/nodes/*/name');

    for (const key in keys) {
      const parts = key.split('/');
      const node = parts[3];

      nodes[node] = contexts(node);
    }
    return nodes;
  }

  // Map network?
  if (node === undefined) {
    display('network', nodes());
    return;
  }

  // Map node?
  if (context === undefined) {
    display(node, contexts(node));
    return;
  }

  // Map context
  display(context, capabilities(node, context));
}

// Find matching keys
function find(arg1) {
  const filter = '*' + required(arg1) + '*';
  const keys = {};

  for (const key in cache) {
    if (match(key, filter) || match(cache[key], filter))
      keys[key] = cache[key];
  }
  display('keys', keys);
}

// Display path
function pwd() {
  display('path', namespace);
}

// Set path
function cd(arg1) {
  const loc = argument(arg1, (client === undefined)?'/':'~');
  const ns = location(loc);

  // Must be connected
  if (client === undefined && ns !== '')
    throw new Error(E_CONNECT);

  namespace = ns;

  if (terminal !== undefined)
    terminal.setPrompt(escape(options.prompt));
}

// List keys
async function ls(arg1, arg2) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const loc = argument(arg1, '');

  // Long form list?
  if (loc === '-l') {
    const loc = argument(arg2, '*');
    const prefix = wildcard(loc);

    const keys = {};

    for (const key in cache) {
      if (match(key, prefix))
        keys[key.replace(namespace + '/', '')] = cache[key];
    }
    display(namespace, keys);
    return;
  }

  // Short form list
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

  const blank = (arg1 === undefined);
  const missing = (!wild && cache[prefix] === undefined);

  if (!blank && !missing) root.pop();

  // Filter keys
  const matches = prefix + ((blank || missing)?'/*':'');
  const keys = filter(cache, matches);

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
  display(key, value);

  stats.reads++;
  broadcast();
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
  stats.writes++;
  broadcast();
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
  stats.writes++;
  broadcast();
}

// Purge keys
async function purge(arg1) {//, arg2) {
  // Must be connected
  if (client === undefined)
    throw new Error(E_CONNECT);

  const loc = required(arg1);
  const prefix = location(loc);

/*
  if (arg2 !== false) {
    // Must be console
    if (pipe !== undefined)
      throw new Error(E_AVAILABLE);

    // Ask to confirm
    if (!await confirmation('About to purge ' + prefix + '. '))
      throw new Error(E_ABORT);
  }
*/

  await client.delete()
    .prefix(prefix)
    .catch((e) => {
      // Failure
      throw new Error(E_PURGE + ': ' + e.message);
    });

  // Success
  stats.writes++;
  broadcast();
}

// Disconnect client
async function disconnect() {
  // Reset stats
  stats.reads = 0;
  stats.writes = 0;
  stats.updates = 0;
  stats.errors = 0;
  stats.connection = 'offline';

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
  }

  cd();
  broadcast();
}

// Clear screen
function cls() {
  if (pipe === undefined)
    console.clear();
}

// Echo to console
function echo() {
  const args = Array.prototype.slice.call(arguments);
  const parts = [];

  var newline = true;

  for (const arg of args) {
    // Suppress newline?
    if (parts.length === 0 && arg === '-n')
      newline = false;
    else parts.push(argument(arg));
  }

  if (newline) parts.push('\n');
  const text = parts.join(' ');

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
//  if (prompt.endsWith('?') && answer === 'no')
//    throw new Error(E_ABORT);
}

// Spawn process
async function exec() {
  const args = Array.prototype.slice.call(arguments);
  const path = argument(args.join(' '));

  // No value?
  if (path === '')
    throw new Error(E_MISSING);

  await spawn(path);
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

// Display history
function history(arg1) {
  const arg = argument(arg1);

  // Ignore this command
  terminal.history.shift();

  switch (arg) {
    case '-c':
      // Clear history
      terminal.history = [];
      return;
    case undefined:
      // Show history
      if (terminal.history.length > 0)
        print(reverse(terminal.history).join('\n'));
      return;
  }
  throw new Error(E_ARGUMENT + ': ' + arg);
}

// Save script file
function save(arg1) {
  const file = extension(required(arg1), '.cns');

  // Ignore this command
  terminal.history.shift();

  // Write file
  const data = '#!/usr/bin/env cns\n' + comment() +
    reverse(terminal.history).join('\n') + '\n';

  write(file, data);
  chmodx(file);
}

// Load script file
async function load(arg1) {
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
  const code = argument(arg1, 0) | 0;

  if (client !== undefined)
    await disconnect();

  stop();
  close();

  process.exit(code);
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

// Format output
function display(root, value) {
  // Format and display
  const text = format(root, value).trimEnd();
  if (text !== '') print(text);
}

// Format output value
function format(root, value) {
  if (value === undefined || value === null ||
    (typeof value === 'object' && Object.keys(value).length === 0))
    return '';

  // What output format?
  switch (options.format) {
    case 'text':
      return text(root, value, '');
    case 'tree':
      return tree(root, value);
    case 'table':
      return table(root, value);
    case 'json':
      return json(root, value);
    case 'xml':
      return '<?xml version="1.0" encoding="UTF-8"?>\n' + xml(root, value, '');
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

// Format bytes
function bytes(value) {
  const range = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const k = 1024;
  const p = (value === 0)?0:(Math.floor(Math.log(value) / Math.log(k)));

  return Number((value / Math.pow(k, p)).toFixed(2)) + ' ' + range[p];
}

// Print help hint
function phint(hint, text) {
  print('  ' + hint + ' '.repeat(38 - hint.length) + text);
}

// Ask for confirmation
async function confirmation(prompt) {
  if (prompt === undefined) prompt = '\n';

  const answer = await input(prompt + 'Is this OK?');
  if (answer === null) return false;

  if (answer === 'no') {
    print('Aborted.');
    return false;
  }
  return true;
}

// Ask multiple questions
async function questions(prompts, defs) {
  const answers = [];

  for (var n = 0; n < prompts.length; n++) {
    const answer = await input(prompts[n], defs[n]);
    if (answer === null) return null;

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
      print('\nAborted.');

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
      answer = answer.trim();

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

// Get net address
function getAddress() {
  // Scan interfaces
  const nets = os.networkInterfaces();

  for (const id in nets)
  for (const net of nets[id]) {
    // Probable ip address?
    if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
      system.address = net.address;
      system.mask = net.netmask;
      return;
    }
  }
}

// Get memory usage
function getMemory() {
  const memory = process.memoryUsage();

  system.memory = bytes(os.totalmem());
  system.free = bytes(os.freemem());
  system.process = bytes(memory.rss);
  system.heap = bytes(memory.heapTotal);
  system.used = bytes(memory.heapUsed);
}

// Get profile descriptors
function getDescriptors() {
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

// Get context profiles
function getProfiles(node, context, role) {
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

      if (cache2 === undefined) {
        const data = JSON.parse(await request('GET', 'https://cp.padi.io/profiles'));

        cache2 = {};

        for (const profile of data) {
          const id = profile.name;
          const name = profile.title || '';

          cache2[id] = name;
        }
      }
      broadcast(ws);
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

var cache2;

// Receive socket command
async function receive(ws, packet) {
  // Pipe to socket
  pipe = ws;
  buffer = '';    // use array and join('\n')?

  try {
    const data = JSON.parse(packet);
    await command(data.command);
  } catch(e) {
    // Failure
    stats.errors++;
    broadcast();

    error(e);
  }

// ws.send here? or if (pipe !== undefined)
  pipe.send(JSON.stringify({
    response: buffer
  }));

  pipe = undefined;
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
function broadcast(ws) {
  if (wss === undefined) return;

  try {
    // Stringify packet
    const packet = JSON.stringify({
      version: pack.version,
      config: config,
      stats: stats,
      keys: cache,
      profiles: cache2
    });

    // Single client?
    if (ws !== undefined)
      ws.send(packet);
    else {
      // Broadcast to all clients
      wss.clients.forEach((ws) => {
        ws.send(packet);
      });
    }
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

// Store config
async function store() {
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

// Add file exec attr
function chmodx(file) {
  const stat = fs.statSync(file);

  const mode = stat.mode | 64 | 8 | 1;
  if (mode === stat.mode) return;

  const base8 = mode.toString(8).slice(-3);

  debug('Chmod +x ' + file + '...');
  fs.chmodSync(file, base8);
}

// Spawn child process
function spawn(path) {
  // I promise to
  return new Promise((resolve, reject) => {
    const params = path.split(' ');
    const file = params.shift();

    debug('Spawning ' + file + '...');
    const child = cp.spawn(file, params);

    child.on('error', (e) => {
      reject(new Error(E_SPAWN + ': ' + path));
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();

      if (!transmit(text))
        process.stdout.write(text.green);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();

      if (!transmit(text))
        process.stderr.write(text.red);
    });

    child.on('exit', (code) => {
      resolve(code);
    });
  });
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

// Reverse array copy
function reverse(arr) {
  const res = [];

  for (var n = arr.length - 1; n >= 0; n--)
    res.push(arr[n]);

  return res;
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
  if (!transmit(e.message + '\n'))
    console.error(e.message.red);

  debug(e.stack);
}

// Catch terminate signal
process.on('SIGINT', () => {
  print('\rAborted.');
  exit(1);
});

// Start application
main(process.argv.slice(2));
