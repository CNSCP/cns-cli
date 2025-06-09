#!/usr/bin/env node

// index.js - CNS Command line
// Copyright 2025 Padi, Inc. All Rights Reserved.

// display obj with child._name as value (ignore if not list?)

'use strict';

// Imports

const env = require('dotenv').config();

const etcd = require('etcd3');
const readline = require('readline');
const tables = require('table');
const colours = require('colors');
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
const E_MISSMATCH = 'Type missmatch';
const E_CONFIG = 'Not configured';
const E_CONNECT = 'Not connected';
const E_WATCH = 'Failed to watch';
const E_LIST = 'Failed to list';
const E_GET = 'Failed to get';
const E_PUT = 'Failed to put';
const E_DEL = 'Failed to del';
const E_PURGE = 'Failed to purge';
const E_SPAWN = 'Failed to spawn';
const E_READ = 'Failed to read';
const E_WRITE = 'Failed to write';

// Defaults

const defaults = {
  CNS_HOST: '127.0.0.1',
  CNS_PORT: '2379',
  CNS_USERNAME: 'root',
  CNS_PASSWORD: ''
};

// Configuration

const config = {
  CNS_HOST: process.env.CNS_HOST || defaults.CNS_HOST,
  CNS_PORT: process.env.CNS_PORT || defaults.CNS_PORT,
  CNS_USERNAME: process.env.CNS_USERNAME || defaults.CNS_USERNAME,
  CNS_PASSWORD: process.env.CNS_PASSWORD || defaults.CNS_PASSWORD
};

// Options

const options = {
  format: 'tree',
  indent: 2,
  columns: 0,
  rows: 0,
  silent: false,
  debug: false
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
  'output': output,
//  'device': device,
  'init': init,
  'config': configure,
  'status': status,
  'connect': connect,
  'network': network,       // [name] [value]
  'profiles': profiles,
  'nodes': nodes,           // [node] [name] [value]
  'contexts': contexts,     // node [context] [name] [value]
  'provider': provider,
  'consumer': consumer,
  'connections': connections,
  // users
  // roles
  'map': map,       // [node] [context] [profile]
  // top (changes)
  'namespace': namespace,
  'list': list,
  'get': get,
  'put': put,
  'del': del,
  'purge': purge,
  // push (nodes to etcd server)
  // pull (nodes from etcd server)
  'disconnect': disconnect,
  'dashboard': dashboard,
  'cls': cls,
  'echo': echo,
  'exec': exec,
  'curl': curl,
  'wait': wait,
  'history': history,
  'save': save,
  'load': load,
  'exit': exit,
  'quit': exit
};

//
/*
const CONNECTED = 0x01;
const SINGLE = 0x02;
const DOUBLE = 0x04;

const flags = {
  'network': CONNECTED,
  'profiles': CONNECTED,
  'nodes': CONNECTED,
  'connections': CONNECTED,
// etc
  'echo': SINGLE,
  'exec': SINGLE,
  'curl': DOUBLE
};
*/

// Shortcuts

const shortcuts = {
  'h': 'help',
  '?': 'help',
  'v': 'version',
  'i': 'init',
  's': 'status',
  'cd': 'namespace',
  'ls': 'list',
  'o': 'output',
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
var response;

var terminal;
var completions;
var confirm;
var signal;

var ns;

// Local functions

// Main entry point
async function main(argv) {
  try {
    // Parse options
    const cmds = parse(argv);

    try {
      // Connect to key store?
      await connect();
    } catch(e) {
      // Ignore
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
  print('  -h, --help                    Output usage information');
  print('  -v, --version                 Output version information');
  print('  -H, --host                    Set network host');
  print('  -P, --port                    Set network port');
  print('  -u, --username                Set network username');
  print('  -p, --password                Set network password');
  print('  -o, --output format           Set output format');
  print('  -i, --indent size             Set output indent size');
  print('  -c, --columns size            Set output column limit');
  print('  -r, --rows size               Set output row limit');
  print('  -m, --monochrome              Disable console colours');
  print('  -s, --silent                  Disable console output');
  print('  -d, --debug                   Enable debug output\n');

  print('Commands:');
  help();

  print('\nEnvironment:');
  print('  CNS_HOST                      Default network host');
  print('  CNS_PORT                      Default network port');
  print('  CNS_USERNAME                  Default network username');
  print('  CNS_PASSWORD                  Default network password\n');

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
        config.CNS_HOST = next(arg, args);
        break;
      case '-P':
      case '--port':
        // Network port
        config.CNS_PORT = next(arg, args);
        break;
      case '-u':
      case '--username':
        // Network user
        config.CNS_USERNAME = next(arg, args);
        break;
      case '-p':
      case '--password':
        // Network password
        config.CNS_PASSWORD = next(arg, args);
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
  return cmds.join(' ');
}

// Get next arg
function next(arg, args) {
  // No more args?
  if (args.length === 0)
    throw new Error(E_MISSING + ': ' + arg);

  return args.shift();
}

// Open console
function open() {
  // Make completions
  completions = Object.keys(commands).sort();
  confirm = false;

  // Create console
  terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer,
    prompt: cwd()
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
  if (terminal !== undefined &&
    !options.silent)
    terminal.prompt();
}

// Suspend console
function suspend() {
  // Console open?
  var history;

  if (terminal !== undefined) {
    // Keep history
    history = terminal.history;
    close();
  }
  return history;
}

// Resume from suspend
function resume(rl, history) {
  // Close readline
  rl.close();

  // Re-open terminal?
  if (history !== undefined) {
    open();
    terminal.history = history;
  }
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
  if (line.startsWith('!')) {
    console.log(eval(line.substr(1)));
    return;
  }

  // Remove comments
  line = line.split(/\s\/\/+(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)[0];

  // Split statements
  const statements = line.split(/;+(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);

  for (const statement of statements) {
    // Empty statement?
    const part = statement.trim();
    if (part === '') continue;

    // Split args and remove quotes
    const args = (part.match(/[^\s"]+|"([^"]*)"/g) || [])
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
// check flags
    if (cmd !== 'echo' && len > fn.length)
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

// Get path argument
function location(arg) {
  var loc = argument(arg, '');

  // Add current path
  if (!loc.startsWith('~'))
    loc = ns + '/' + loc;//((ns === '/')?'':'/') + loc;

  // Squiggle for home
  if (loc.startsWith('~'))
    loc = home() + loc.substr(1);

  // Normalize path
  loc = path.normalize(loc);

  // Remove trailing slash
  if (loc.length > 1)
    loc = loc.replace(/\/$/, '');

  return loc;
}

// Get working path
function cwd() {
  return shorten(ns) + '> ';
}

// Get home path
function home() {
  return 'cns/network';
}

// Expand home path
function expand(path) {
  return path.replace('~', home());
}

// Shorten home path
function shorten(path) {
  return path.replace(home(), '~');
}

// Variable substitution
function variable(value) {
  var match;

  // Found match?
  while (match = value.match(/\$([\d\w_\/]+)/)) {
    // Find variable
    const found = match[0];
    const name = match[1];

    var data = config[name];

    if (data === undefined) data = options[name];
    if (data === undefined) data = stats[name];
    if (data === undefined) data = cache[name];
    if (data === undefined) data = process.env[name];

    // Not found?
    if (data === undefined)
      throw new Error(E_VARIABLE + ': ' + name);

    // Replace with value
    value = value.replace(found, data);
  }
  return value;
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
  print('  help                          Output help information');
  print('  version                       Output version information');
  print('  init                          Initialize config file');
  print('  config [name] [value]         Display or set config properties');
  print('  output [name] [value]         Display or set output properties');
  print('  status [name]                 Display status properties');
  print('  connect                       Connect to network');
  print('  network                       Configure network properties');
  print('  profiles [profile]            Configure profile properties');
  print('  nodes [node]                  Configure node properties');
  print('  contexts node [context]       Configure context properties');
  print('  provider node context [profile]   Configure provider properties');
  print('  consumer node context [profile]   Configure consumer properties');
  print('  connections node context      Display context connections');
  print('  map                           Display network map');
  print('  list [key]                    List key values');
  print('  get key                       Get value of key');
  print('  set key value                 Set value of key');
  print('  del key                       Delete key entry');
  print('  purge prefix                  Delete all keys');
  print('  disconnect                    Disconnect from network');
  print('  cls                           Clear the screen');
  print('  echo [-n] [string]            Write to the standard output');
  print('  exec file                     Spawn process');
  print('  curl method url [value]       Send http request to url');
  print('  wait [ms]                     Wait for specified milliseconds');
  print('  history [clear]               Display terminal history');
  print('  save file                     Save history to script file');
  print('  load file                     Load and execute script file');
  print('  exit [code]                   Exit the console with code');
  print('  quit                          Quit the console');

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
  // Output help
  print('This utility will walk you through creating a .env environment file.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const answers = await questions([
    'CNS Host',
    'CNS Port',
    'Username',
    'Password'
  ], [
    config.CNS_HOST,
    config.CNS_PORT,
    config.CNS_USERNAME,
    config.CNS_PASSWORD
  ]);

  if (answers === null) return;

  // Update new values
  config.CNS_HOST = answers[0];
  config.CNS_PORT = answers[1];
  config.CNS_USERNAME = answers[2];
  config.CNS_PASSWORD = answers[3];

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
}

//
async function network() {
  if (client === undefined)
    throw new Error(E_CONNECT);

  await setup('cns/network', 'your network properties', [
      'Network Name',
      'Orchestrator Scope',
      'Access Token'
    ], [
      'My Network',
      'contexts',
      ''
    ], [
      'name',
      'orchestrator',
      'token'
    ]);
}

//
async function profiles(arg1, arg2) {
  if (client === undefined)
    throw new Error(E_CONNECT);

  const profile = argument(arg1);

  if (profile === undefined) {

// properties profile         <-- command
    // List profiles
//    function properties(profile, version) {
//      const props = {};
//      const keys = filter(cache, 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/*/name');

//      for (const key in keys) {
//        const parts = key.split('/');
//        const property = parts[7];

//        props[property] = keys[key];
//      }
//      return props;
//    }

    const prefix = 'cns/network/profiles/*/name';
    const keys = filter(cache, prefix);

    const profiles = {};

    for (const key in keys) {
      const parts = key.split('/');

      const profile = parts[3];
//      const name = keys[key];

      profiles[profile] = keys[key];//properties(profile, 1);
    }

    display('profiles', profiles);
    return;
  }

  // Pull profile from server?
  if (profile === 'pull') {
    await pull(required(arg2));
    return;
  }

//  await setup('cns/network/profiles/' + profile, 'setting up a connection profile', [

  // Output help
  print('This utility will walk you through setting up a connection profile.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  const ns = 'cns/network/profiles/' + profile + '/';

  // Ask questions
  const answers = await questions([
    'Profile Name',
    'Profile Version'
  ], [
    cache[ns + 'name'] || 'My Profile',
    ''
  ]);

  if (answers === null) return;

  const version = Number(answers[1]) || 1;

  // Prompt to write
  print('\nAbout to publish ' + profile + ' v' + version + ' properties:\n');

  print('name = ' + answers[0]);
  print('version = ' + answers[1] + '\n');

  if (!await question()) return;

  // Update new values
  await put(ns + 'name', answers[0]);
//  await put(ns + 'versions/' + , answers[1]);
//  await put(ns + 'comment', answers[2]);
}

//
async function nodes(arg1) {
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = argument(arg1);

  if (node === undefined) {
    // List nodes
    const prefix = 'cns/network/nodes/*/name';
    const keys = filter(cache, prefix);

    const nodes = {};

    for (const key in keys) {
      const parts = key.split('/');

      const node = parts[3];
      const name = keys[key];

      nodes[node] = name;
    }

    display('nodes', nodes);
    return;
  }

  await setup('cns/network/nodes/' + node, 'a network node', [
      'Node Name',
      'Upstream Network',
      'Access Token'
    ], [
      'My Node',
      '',
      ''
    ], [
      'name',
      'upstream',
      'token'
    ]);

// switch namespace?
}

//
async function contexts(arg1, arg2) {
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = required(arg1);        // prompt for node?
  const context = argument(arg2);

// node exists?

  if (context === undefined) {
    // List contexts
    const prefix = 'cns/network/nodes/' + node + '/contexts/*/name';
    const keys = filter(cache, prefix);

    const contexts = {};

    for (const key in keys) {
      const parts = key.split('/');

      const context = parts[5];
      const name = keys[key];

      contexts[context] = name;
    }

    display(node, contexts);
    return;
  }

  await setup('cns/network/nodes/' + node + '/contexts/' + context, 'a node context', [
    'Context Name',
    'Access Token'
  ], [
    'My Context',
    ''
  ], [
    'name',
    'token'
  ]);
}

//
async function provider(arg1, arg2, arg3, arg4, arg5) {
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = required(arg1);
  const context = required(arg2);
  const profile = argument(arg3);

  if (profile === undefined) {
    const prefix = 'cns/network/nodes/' + node + '/contexts/' + context + '/provider/*/version';
    const keys = filter(cache, prefix);

    const providers = {};

    for (const key in keys) {
      const parts = key.split('/');
      const profile = parts[7];

      providers[profile] = 'Version ' + (Number(keys[key]) + 1);
    }

    display('provider', providers);
    return;
  }

  const version = argument(arg4, 1);
  const scope = argument(arg5);

  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties';

  const properties = filter(cache, ps + '/*/name');

  const prompts = [];
  const defaults = [];
  const names = [];

  for (const key in properties) {
    const parts = key.split('/');
    const property = parts[7];

    const propagate = cache[ps + '/' + property + '/propagate'];
    const provider = cache[ps + '/' + property + '/provider'];
    const required = cache[ps + '/' + property + '/required'];

    if (provider === 'yes') {
      prompts.push(properties[key]);
      defaults.push('');
      names.push(property);
    }
  }

  const cs = 'cns/network/nodes/' + node + '/contexts/' + context + '/provider/' + profile;
  var ok = true;

  if (prompts.length > 0) {
    ok = await setup(cs + '/properties', 'a provider profile',
      prompts,
      defaults,
      names);
  }

  if (ok) {
    await put(cs + '/version', version);
    if (scope !== undefined) await put(cs + '/scope', scope);
  }
}

//
async function consumer(arg1, arg2, arg3, arg4, arg5) {
  if (client === undefined)
    throw new Error(E_CONNECT);

  const node = required(arg1);
  const context = required(arg2);
  const profile = argument(arg3);

  if (profile === undefined) {


    return;
  }

  const version = argument(arg4, 1);
  const scope = argument(arg5);

  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties';

  const properties = filter(cache, ps + '/*/name');

  const prompts = [];
  const defaults = [];
  const names = [];

  for (const key in properties) {
    const parts = key.split('/');
    const property = parts[7];

    const propagate = cache[ps + '/' + property + '/propagate'];
    const provider = cache[ps + '/' + property + '/provider'];
    const required = cache[ps + '/' + property + '/required'];

    if (provider !== 'yes') {
      prompts.push(properties[key]);
      defaults.push('');
      names.push(property);
    }
  }

  const cs = 'cns/network/nodes/' + node + '/contexts/' + context + '/consumer/' + profile;
  var ok = true;

  if (prompts.length > 0) {
    ok = await setup(cs + '/properties', 'a consumer profile',
      prompts,
      defaults,
      names);
  }

  if (ok) {
    await put(cs + '/version', version);
    if (scope !== undefined) await put(cs + '/scope', scope);
  }
}

//
async function connections(arg1, arg2) {
  if (client === undefined)
    throw new Error(E_CONNECT);



}

// Display status
function status(arg1) {
  const name = argument(arg1);
  property('status', stats, name);
}

// Connect client
async function connect() {
  // Disconnect previous
  await disconnect();

  const host = config.CNS_HOST;
  const port = config.CNS_PORT;

  if (!host) throw new Error(E_CONFIG);

  const username = config.CNS_USERNAME;
  const password = config.CNS_PASSWORD;

  // Client options
  const options = {
    hosts: host + (port?(':' + port):'')
  };

  // Using auth?
  if (username !== '' && password !== '') {
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
      stats.errors++;
      broadcast();

      throw new Error(E_CONNECT + ': ' + e.message);
    });

  // Start watching
  debug('Watching...');

  watcher = await client.watch()
    .prefix('cns/network')
    .create()
    .catch((e) => {
      // Failure
      stats.errors++
      broadcast();

      throw new Error(E_WATCH + ': ' + e.message);
    });

  watcher
    .on('connected', () => {
      debug('Connected...');
    })
    .on('put', (result) => {
      const key = result.key.toString();
      const value = result.value.toString();

      debug('PUT ' + key + ' = ' + value);

      cache[key] = value;
      stats.updates++;

      broadcast();
    })
    .on('delete', (result) => {
      const key = result.key.toString();
      const value = result.value.toString();

      debug('DEL ' + key);

      delete cache[key];
      stats.updates++;

      broadcast();
    })
    .on('disconnected', () => {
      debug('Disconnected...');
    });

  // Success
  debug('Network on ' + host + (username?(' as ' + username):''));
  stats.connection = 'online';

  namespace('cns/network');
  broadcast();
}

// Set namespace
function namespace(arg1) {
  const loc = argument(arg1);

  if (loc === undefined) {
    display('namespace', ns);
    return;
  }

  // Remove trailing slashes
  ns = expand(loc);
  ns = ns.replace(/\/+$/, '');

  // Set console prompt
  if (terminal !== undefined)
    terminal.setPrompt(cwd());
}

//
async function map() {
  if (client === undefined)
    throw new Error(E_CONNECT);

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

  function capabilities(node, context, role) {
    const caps = {};
    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/*/version');

    for (const key in keys) {
      const parts = key.split('/');
      const profile = parts[7];

      caps[profile] = connections(node, context, role, profile);
    }
    return caps;
  }

  function contexts(node) {
    const contexts = {};
    const keys = filter(cache, 'cns/network/nodes/' + node + '/contexts/*/name');

    for (const key in keys) {
      const parts = key.split('/');
      const context = parts[5];

      const provider = capabilities(node, context, 'provider');
      const consumer = capabilities(node, context, 'consumer');

      const obj = {};

      if (Object.keys(provider).length > 0) obj.provider = provider;
      if (Object.keys(consumer).length > 0) obj.consumer = consumer;

      contexts[context] = obj;
    }
    return contexts;
  }

  const nodes = {};
  const keys = filter(cache, 'cns/network/nodes/*/name');

  for (const key in keys) {
    const parts = key.split('/');
    const node = parts[3];

    nodes[node] = contexts(node);
  }

  display('network', nodes);
}


// List keys
async function list(arg1) {
  const prefix = location(arg1);

  if (client === undefined)
    throw new Error(E_CONNECT);

/*
  const keys = await client.getAll()
    .prefix(prefix)
    .strings()
    .catch((e) => {
      // Failure
      stats.errors++;
      broadcast();

      throw new Error(E_LIST + ': ' + e.message);
    });

  // Success
  display(prefix, keys);

  stats.reads++;
  broadcast();
*/

  var from = [];
  var wild = false;

  const parts = prefix.split('/');

  for (const part of parts) {
    if (part.includes('*')) {
      wild = true;
      break;
    }
    from.push(part);
  }
  from = from.join('/');

  var match = prefix;

  if (arg1 === undefined || (!wild && cache[match] === undefined))
    match += '/*';

  const reduce = [];
  const keys = filter(cache, match);

  for (const key in keys) {
    const name = key.replace(from + '/', '');
    reduce[name] = keys[key];
  }
  display(from, reduce);
}

// Get key value
async function get(arg1) {
  const key = required(arg1);

  if (client === undefined)
    throw new Error(E_CONNECT);

  const value = await client.get(key)
    .string()
    .catch((e) => {
      // Failure
      stats.errors++;
      broadcast();

      throw new Error(E_GET + ': ' + e.message);
    });

  // Success
  display(key, value);

  stats.reads++;
  broadcast();
}

// Put key value
async function put(arg1, arg2) {
  const key = required(arg1);
  const value = required(arg2);

  if (client === undefined)
    throw new Error(E_CONNECT);

  await client.put(key)
    .value(value)
    .catch((e) => {
      // Failure
      stats.errors++;
      broadcast();

      throw new Error(E_PUT + ': ' + e.message);
    });

  // Success
  stats.writes++;
  broadcast();
}

// Delete key
async function del(arg1) {
  const key = required(arg1);

  if (client === undefined)
    throw new Error(E_CONNECT);

  await client.delete()
    .key(key)
    .catch((e) => {
      // Failure
      stats.errors++;
      broadcast();

      throw new Error(E_DEL + ': ' + e.message);
    });

  // Success
  stats.writes++;
  broadcast();
}

// Purge keys
async function purge(arg1) {
  const prefix = required(arg1);

  if (client === undefined)
    throw new Error(E_CONNECT);

  await client.delete()
    .prefix(prefix)
    .catch((e) => {
      // Failure
      stats.errors++;
      broadcast();

      throw new Error(E_PURGE + ': ' + e.message);
    });

  // Success
  stats.writes++;
  broadcast();
}

// Disconnect client
async function disconnect() {
  // Reset cache
  cache = {};

  // Reset stats
  stats.reads = 0;
  stats.writes = 0;
  stats.updates = 0;
  stats.errors = 0;
  stats.connection = 'offline';

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

  namespace('');
  broadcast();
}

// Start dashboard
function dashboard(arg1) {
  const host = 'localhost';
  const port = argument(arg1, '8080');

  // Cease previous
  cease();

  // I promise to
  return new Promise((resolve, reject) => {
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
      app.ws('/', (ws, req) => {
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
        broadcast(ws);
      });

      // All other requests
      app.use((req, res) => {
        res.status(404).send('<h1>Page not found</h1>');
      });

      print('CNS Dashboard running on http://' + host + ':' + port);
      if (terminal !== undefined) resolve();
    })
    // Failure
    .on('error', (e) => {
      reject(e);
    });

    // Start listening
    server.listen(port);
  });
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

// Spawn process
async function exec(arg1) {
  const path = required(arg1);
  await spawn(path);
}

// Issue http request
async function curl(arg1, arg2, arg3) {
  const method = required(arg1).toUpperCase();
  const url = required(arg2);
  const data = argument(arg3);

  // Send request
  var result = await getRequest(method, url, data);
  if (!result.endsWith('\n')) result += '\n';

  if (!transmit(result))
    process.stdout.write(result.green);
}

// Wait some time
async function wait(arg1) {
  const ms = argument(arg1);
  await sleep(ms);
}

// Display history
function history(arg1) {
  const arg = argument(arg1);

  // Ignore last command
  terminal.history.shift();

  switch (arg) {
    case 'clear':
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
  const file = extension(argument(arg1), '.cns');

  // Ignore last command
  terminal.history.shift();

  // Write file
  const data = '#!/usr/bin/env cns\n' + comment() +
    reverse(terminal.history).join('\n') + '\n';

  write(file, data);
  chmodx(file);
}

// Load script file
async function load(arg1) {
  const file = extension(argument(arg1), '.cns');

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

  cease();
  close();

  process.exit(code);
}




















// Format output
function display(root, value) {
//  const parts = path.split('/');

  // Pipe to socket
/*
  if (pipe !== undefined) {
    const data = JSON.stringify({
      response: value
    });

    debug('Websocket response: ' + data);
    pipe.send(data);

    return;
  }
*/

//  if (pipe !== undefined) fmt = 'json';


  // Format and display
//  const root = block;//parts.pop();
  const text = format(root, value).trimEnd();

/*
  if (pipe !== undefined) {
    debug('Websocket response: ' + text);

    const data = JSON.stringify({
      response: text
    });

    pipe.send(data);
  } else {*/
  if (text !== '') print(text);
//  }
}

// Format output value
function format(root, value) {
  if (typeof value === 'object' &&
    Object.keys(value).length === 0)
    return '';

  // What output format?
  switch (options.format) {
    case 'text':
      return text(value, '');
    case 'tree':
      return tree(root, value);
    case 'table':
      return table(root, value);
    case 'json':
      return json(root, value);
    case 'xml':
      return xml(root, value);
  }
}

// Format as text
function text(value, level) {
  if (typeof value === 'object') {
    var t = '';

    for (const name in value) {
      const v = value[name];

      if (typeof v === 'object')
        t += level + name + ':\n' + text(v, level + indent(' '));
      else t += level + name + '=' + sanitize(v) + '\n';
    }
    return t;
  }
  return sanitize(value);
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
  return value.toString();//justify(root, value.toString());
}

// Format as table
function table(root, value) {
  const t = [];

  if (typeof value === 'object') {
    for (const name in value) {
      var v = value[name];

      if (typeof v === 'object')
        v = Object.keys(v).join(', ');  // '\n');

      t.push([name, v]);
    }

    if (t.length === 0) return '';
  }
  else t.push([root, value]);

  var col1 = 0;
  var col2 = 0;

  for (const row of t) {
    col1 = Math.max(col1, row[0].toString().length);
    col2 = Math.max(col2, row[1].toString().length);
  }

  col2 = Math.min(col2, columns() - (col1 + 7));
  if (col1 < 1 || col2 < 1) return '';

  try {
    return tables.table(t, {
      columns: [
        {width: col1},
        {width: col2, wrapWord: true}
      ]
    });
  } catch(e) {
    // Failure
    return '';
  }
}

// Forat as json
function json(root, value) {
  const data = {};
  data[root] = value;

  const indent = Math.min(Math.max(options.indent, 0), 8);
  return JSON.stringify(data, null, indent);
}

// Format as xml
function xml(root, value) {
/*  const data = {};
  data[root] = value;

  const opt = {
    header: true
  };

  if (options.indent > 0)
    opt.indent = indent(' ');

  return jstoxml.toXML(data, opt);*/
  return '<group name="nodes"><item name="version" value="0.1.0"/></group>';
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
    else item.value = sanitize(value);

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
  name += '    ';

  const cols = columns();
  const span = cols - name.length - value.length;

  if (span > 0) {
    if (value === '') return name;
    return name + ' '.repeat(span) + value;
  }
  return (name + value).substr(0, cols - 1) + '…';
}

/*
// Output
function directory(data) {
  // Something to list?
  if (typeof data !== 'object') return;

  // Get column width
  var max = 0;

  for (const name in data)
    max = Math.max(max, name.length);

  max += 4;

  const width = Math.max((columns() / max) | 0, 0);
  if (width === 0) return;

  // Output each name
  var s = '';
  var w = 0;

  for (const name in data) {
    // Next row?
    if (w++ >= width) {
      s += '\n';
      w = 0;
    }

    // Add column
    s += name.padEnd(max);
  }

  print(s);
}
*/




//
async function setup(ns, prompt, prompts, defs, keys) {
  // Output help
  print('This utility will walk you through setting up ' + prompt + '.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  //
  for (var n = 0; n < keys.length; n++) {
    const key = keys[n];
    const value = cache[ns + '/' + key];

    if (value !== undefined) defs[n] = value;
  }

  // Ask questions
  const answers = await questions(prompts, defs);
  if (answers === null) return false;

  // Prompt to write
  print('\nAbout to publish properties:\n');

  for (var n = 0; n < keys.length; n++)
    print(keys[n] + ' = ' + answers[n]);

  print('');

  if (!await question()) return false;

  // Update new values
  await publish(ns, keys, answers);
  return true;
}

// Ask multiple questions
async function questions(prompts, defs) {
  // Get answers
  const answers = [];

  for (var n = 0; n < prompts.length; n++) {
    const answer = await input(prompts[n], defs[n]);
    if (answer === null) return null;

    answers.push(answer);
  }
  return answers;
}

// Ask question
async function question(prompt) {
  // Async question
  if (prompt === undefined) prompt = '';
  else prompt += '. ';

  const answer = await input(prompt + 'Is this OK? (yes/no)');

  // Decode response
  if (answer !== null) {
    switch (answer.toLowerCase()) {
      case 'y':
      case 'yes':
        return true;
    }
    print('Aborted.');
  }
  return false;
}

// Ask for input
async function input(prompt, def) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Suspend console
    var history = suspend();

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

    if (def) prompt += ' (' + def + ')';
    prompt += ': ';

    rl.question(prompt, (answer) => {
      resume(rl, history);
      resolve(answer.trim() || def || '');
    });
  });
}

//
async function publish(ns, keys, values) {
  for (var n = 0; n < keys.length; n++)
    await put(ns + '/' + keys[n], values[n]);
}









//
function filter(keys, filter) {
  const result = {};

/*
if (filter.includes('*')) {

  for (const key in keys) {
    if (match(key, filters))
      result[key] = keys[key];
  }
} else {
  for (const key in keys) {
    if (key.startsWith(filter))
      result[key] = keys[key];
  }
}
*/

  const filters = filter.split('/');

  for (const key in keys) {
//    if (wildcard(key, filter))
    if (match(key, filters))
      result[key] = keys[key];
  }
  return result;
}

//
function match(key, filters) {
  const keys = key.split('/');

  if (keys.length === filters.length) {
    for (var n = 0; n < keys.length; n++)
      if (!wildcard(keys[n], filters[n])) return false;

    return true;
  }
  return false;
}

//
function wildcard(match, filter) {
  var esc = (s) => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
  return new RegExp('^' + filter.split('*').map(esc).join('.*') + '$').test(match);
}



// Broadcast to sockets
function broadcast(ws) {
  if (wss === undefined) return;

  try {
    // Stringify packet
    const packet = JSON.stringify({
      version: pack.version,
      config: config,
      stats: stats,
      keys: cache
    });

    // Single socket?
    if (ws !== undefined)
      ws.send(packet);
    else {
      // Broadcast to all sockets
      wss.clients.forEach((ws) => {
        ws.send(packet);
      });
    }
  } catch(e) {
    // Failure
    debug(e.message);
  }
}

// Receive socket command
async function receive(ws, packet) {
  // Pipe to socket
  pipe = ws;
  response = '';

  try {
    const data = JSON.parse(packet);
    await command(data.command);
  } catch(e) {
    // Failure
    error(e);
  }

  pipe.send(JSON.stringify({
    response: response
  }));

  pipe = undefined;
}

// Buffer pipe response
function transmit(text) {
  if (pipe !== undefined) {
    response += text;
    return true;
  }
  return false;
}

// Close dashboard server
function cease() {
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

// Pull profile from server
async function pull(url) {
  const data = await getRequest('GET', url);
  const profile = JSON.parse(data);

  const name = profile.name;
  const title = profile.title;
  const versions = profile.versions || [];

  const ns = 'cns/network/profiles/' + name + '/';

  await put(ns + 'name', title || '');

  for (var n = 0; n < versions.length; n++) {
    const version = versions[n];
    const properties = version.properties;

    const vs = ns + 'versions/version' + (n + 1) + '/';

    for (const property of properties) {
      const ps = vs + 'properties/' + property.name + '/';

      await put(ps + 'name', property.description || '');
      await put(ps + 'provider', (property.server === null)?'yes':'no');
      await put(ps + 'propagate', (property.propagate === null)?'yes':'no');
      await put(ps + 'required', (property.required === null)?'yes':'no');
    }
  }
}

// Get http request
function getRequest(method, url, data) {
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
    debug('Fetching ' + url + '...');

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
    // Get result
    return getResponse(result);
  });
}

// Get http response
function getResponse(res) {
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
  return '// Generated by ' + pack.name + ' on ' + new Date().toISOString() + '\n';
}

// Ensure extension
function extension(file, ext) {
  return file.endsWith(ext)?file:(file + ext);
}

// Store config
async function store() {
  const file = path.resolve(process.cwd(), '.env');
  const data = {};

  // Copy config settings
  for (const name in config) {
    const value = config[name];

    if (value !== '')
      data[name] = value;
  }

  // Keep user settings
  for (const name in env.parsed) {
    const value = config[name];

    if (value === undefined)
      data[name] = env.parsed[name];
  }

  // Construct env file
  var text = '';

  for (const name in data)
    text += name + '=' + data[name] + '\n';

  // Prompt to write
  print('\nAbout to write to ' + file + ':\n\n' + text);
  if (!await question()) return;

  // Write file
  write(file, comment() + text);
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
    if (ms !== undefined) {
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

// Sanitize text value
function sanitize(value) {
  return value.toString().replaceAll('\n', ' ').trim();
}

// Get indent
function indent(char) {
  return char.repeat(Math.min(Math.max(options.indent, 0), 8));
}

// Get column count
function columns() {
  return options.columns || process.stdout.columns || 80;
}

// Get row count
function rows() {
  return options.rows || process.stdout.rows || 25;
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
process.on('SIGINT', async () => {
  print('\rAborted.');

//  if (signal !== undefined) {
//    signal();
//    signal = undefined;
//  }
  exit(1);
});

// Start application
main(process.argv.slice(2));
