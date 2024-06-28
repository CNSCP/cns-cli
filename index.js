#!/usr/bin/env node

// index.js - CNS Command line
// Copyright 2024 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const dapr = require('@dapr/dapr');

const env = require('dotenv').config();
const express = require('express');
const expressws = require('express-ws');
const compression = require('compression');
const merge = require('object-merge');
const colours = require('colors');
const readline = require('readline');
const tables = require('table');
const jstoxml = require('jstoxml');
const jwt = require('jsonwebtoken');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const os = require('os');

const pack = require('./package.json');

// Errors

const E_OPTION = 'Illegal option';
const E_COMMAND = 'Illegal command';
const E_ARGUMENT = 'Invalid argument';
const E_MISSING = 'Missing argument';
const E_VARIABLE = 'Invalid variable';
const E_MISSMATCH = 'Type missmatch';
const E_CONNETION = 'No connection';
const E_CONTEXT = 'No context';
const E_TOKEN = 'Invalid token';
const E_CONNECT = 'Connect error';
const E_INVOKE = 'Invoke error';
const E_PUBSUB = 'Pubsub error';
const E_SPAWN = 'Failed to spawn';
const E_READ = 'Failed to read';
const E_WRITE = 'Failed to write';

// Defaults

const defaults = {
  CNS_BROKER: 'padi',
  CNS_CONTEXT: '',
  CNS_TOKEN: '',
  CNS_DAPR: 'cns-dapr',
  CNS_DAPR_HOST: 'localhost',
  CNS_DAPR_PORT: '3500',
  CNS_PUBSUB: 'cns-pubsub',
  CNS_SERVER_HOST: 'localhost',
  CNS_SERVER_PORT: '3200'
};

// Config

const config = {
  CNS_BROKER: process.env.CNS_BROKER || defaults.CNS_BROKER,
  CNS_CONTEXT: process.env.CNS_CONTEXT || defaults.CNS_CONTEXT,
  CNS_TOKEN: process.env.CNS_TOKEN || defaults.CNS_TOKEN,
  CNS_DAPR: process.env.CNS_DAPR || defaults.CNS_DAPR,
  CNS_DAPR_HOST: process.env.CNS_DAPR_HOST || defaults.CNS_DAPR_HOST,
  CNS_DAPR_PORT: process.env.CNS_DAPR_PORT || defaults.CNS_DAPR_PORT,
  CNS_PUBSUB: process.env.CNS_PUBSUB || defaults.CNS_PUBSUB,
  CNS_SERVER_HOST: process.env.CNS_SERVER_HOST || defaults.CNS_SERVER_HOST,
  CNS_SERVER_PORT: process.env.CNS_SERVER_PORT || defaults.CNS_SERVER_PORT
};

// System

const system = {
  loglevel: dapr.LogLevel.Error,
  path: home(),
  data: ''
};

// Options

const options = {
  format: 'tree',
  indent: 2,
  columns: 0,
  rows: 0,
  monochrome: false,
  silent: false,
  debug: false
};

// Stats
/*
const stats = {
  started: new Date().toISOString(),
  reads: 0,
  writes: 0,
  updates: 0,
  errors: 0,
  connection: 'offline'
};*/

// Commands

const commands = {
  'help': help,
  'version': version,
  'init': init,
  'config': configure,
  'output': output,
  'memory': memory,
  'network': network,
  'status': status,
  'whoami': whoami,
  'token': token,
  'dashboard': dashboard,
  'connect': connect,
  'disconnect': disconnect,
  'top': top,
  'map': map,
  'pwd': pwd,
  'cd': cd,
  'ls': ls,
  'invoke': invoke,
  'profile': profile,
  'add': add,
  'remove': remove,
  'get': get,
  'set': set,
  'subscribe': subscribe,
  'unsubscribe': unsubscribe,
  'publish': publish,
  'on': on,
//  'exec': exec,
  'curl': curl,
  'wait': wait,
  'cls': cls,
  'cat': cat,
  'echo': echo,
  'history': history,
  'save': save,
  'load': load,
  'exit': exit,
  'quit': exit
};

// Shortcuts

const shortcuts = {
  'h': 'help',
  '?': 'help',
  'v': 'version',
  'i': 'init',
  'c': 'config',
  'o': 'output',
  'm': 'memory',
  'mem': 'memory',
  'n': 'network',
  'net': 'network',
  's': 'status',
  'e': 'exit',
  'q': 'quit'
};

// Local data

var client;
var server;

var terminal;
var completions;
var again;
var signal;

var change;
var pipe;

var sockets = [];
var events = {};

// Local functions

// Main entry point
async function main(argv) {
  colours.disable();

  try {
    // Parse options
    const line = parse(argv);

    // Create client
    await create();

    // Process command?
    if (line !== '') {
      await command(line);

      if (server === undefined)
        await exit();
      return;
    }

    // Open console
    colourize();

    print('Welcome to CNS v' + pack.version + '.');
    print('Type "help" for more information.');

    open();
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
  print('  -c, --context string          Set CNS Broker context');
  print('  -t, --token string            Set CNS Broker token');
  print('  -a, --app-id name             Set CNS Dapr app');
  print('  -dh, --dapr-host name         Set CNS Dapr host');
  print('  -dp, --dapr-port number       Set CNS Dapr port');
  print('  -p, --pubsub name             Set CNS Dapr pubsub component');
  print('  -sh, --server-host name       Set Dapr client host');
  print('  -sp, --server-port number     Set Dapr client port');
  print('  -l, --log-level level         Set Dapr log level');
  print('  -o, --output format           Set output format');
  print('  -i, --indent size             Set output indent size');
  print('  -m, --monochrome              Disable console colours');
  print('  -s, --silent                  Disable console output');
  print('  -d, --debug                   Enable debug output\n');

  print('Commands:');
  help();

  print('\nDocumentation can be found at https://github.com/cnscp/cns-cli/');
}

// Parse arguments
function parse(args) {
  // Process args array
  const line = [];

  while (args.length > 0) {
    // Pop next arg
    const arg = args.shift();

    if (line.length > 0) {
      // Belongs to command
      line.push(arg);
      continue;
    }

    // Not option?
    if (!arg.startsWith('-')) {
      // Process file or command?
      if (arg.endsWith('.cns'))
        line.push('load \"' + arg + '\";');
      else line.push(arg);
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
      case '-c':
      case '--context':
        // Context id
        config.CNS_CONTEXT = next(arg, args);
        break;
      case '-t':
      case '--token':
        // Token
        config.CNS_TOKEN = next(arg, args);
        break;
      case '-a':
      case '--app-id':
        // Set CNS Dapr app id
        config.CNS_DAPR = next(arg, args);
        break;
      case '-dh':
      case '--dapr-host':
        // Set CNS Dapr host
        config.CNS_DAPR_HOST = next(arg, args);
        break;
      case '-dp':
      case '--dapr-port':
        // Set CNS Dapr port
        config.CNS_DAPR_PORT = next(arg, args);
        break;
      case '-p':
      case '--pubsub':
        // Set Dapr pubsub component
        config.CNS_PUBSUB = next(arg, args);
        break;
      case '-sh':
      case '--server-host':
        // Set Dapr server host
        config.CNS_SERVER_HOST = next(arg, args);
        break;
      case '-sp':
      case '--server-port':
        // Set Dapr server port
        config.CNS_SERVER_PORT = next(arg, args);
        break;
      case '-l':
      case '--log-level':
        // Set Dapr log level
        system.loglevel = next(arg, args) | 0;
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
      case '-m':
      case '--monochrome':
        // No colour mode
        options.monochrome = true;
        break;
      case '-s':
      case '--silent':
        // Silent mode
        system.loglevel = dapr.LogLevel.Error;
        options.silent = true;
        break;
      case '-d':
      case '--debug':
        // Debug mode
        system.loglevel = dapr.LogLevel.Debug;
        options.debug = true;
        break;
      case '--':
        // Options done
        line.push('');
        break;
      default:
        // Bad option
        throw new Error(E_OPTION + ': ' + arg);
    }
  }
  return line.join(' ');
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
  again = false;

  // Create console
  terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer,
    prompt: cwd()
  })
  // Input line
  .on('line', async (line) => {
    //
    if (signal !== undefined) return;

    // Ignore terminate
    again = false;
//    terminal.pause();

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
  // Enter foreground
//  .on('SIGCONT', () => {
//    // Resume input
//    prompt();
//  })
  // Ctrl+C
  .on('SIGINT', () => {
    // Catch signal
    if (signal !== undefined) {
      signal();
      signal = undefined;
//      again = false;
      return;
    }

    // Are you sure?
    if (!again) {
      print('\n(To exit, press Ctrl+C again or Ctrl+D or type exit)');
      prompt();

      again = true;
      return;
    }

    // Close console
    print('\r');
    exit();
  });

  // Initial prompt
  prompt();
}

// Get working path
function cwd() {
  return shorten(system.path) + '> ';
}

// Tab completer
function completer(line) {
  const hits = completions.filter((c) => c.startsWith(line));
  return [(hits.length > 0)?hits:completions, line];
}

// Output terminal prompt
function prompt() {
  if (terminal !== undefined &&
    !options.silent)
    terminal.prompt();
}

// Close terminal
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

  // Remove comment
  line = line.split(/\/\/+(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)[0];

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

    if (cmd !== 'echo' && cmd !== 'on' && len > fn.length)
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

  // Squiggle for home
  if (loc.startsWith('~'))
    loc = home() + loc.substr(1);

  // Add current path
  if (!loc.startsWith('/'))
    loc = system.path + ((system.path === '/')?'':'/') + loc;

  // Normalize path
  loc = path.normalize(loc);

  // Remove trailing slash
  if (loc.length > 1)
    loc = loc.replace(/\/$/, '');

  return loc;
}

// Get home path
function home() {
  return '/node/contexts/' + config.CNS_CONTEXT;
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
  while(match = value.match(/\$([\d\w_]+)/)) {
    // Find variable
    const found = match[0];
    const name = match[1];

    var data = config[name];

    if (data === undefined) data = system[name];
    if (data === undefined) data = options[name];
//    if (data === undefined) data = stats[name];
    if (data === undefined) data = process.env[name];

    // Not found
    if (data === undefined)
      throw new Error(E_VARIABLE + ': ' + name);

    // Replace value
    value = value.replace(found, data);
  }
  return value;
}

// Get or set property
function property(path, obj, name, value) {
  // Output all properties?
  if (name === undefined)
    display(path, 'data', obj);
  else {
    // Property must exist
    const current = obj[name];

    if (current === undefined)
      throw new Error(E_ARGUMENT + ': ' + name);

    // Output or set property?
    if (value === undefined)
      display(path + '/' + name, 'data', current);
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
  print('  init                          Initialize .env config file');
  print('  config [name] [value]         Display or set config properties');
  print('  output [name] [value]         Display or set output properties');
  print('  memory [name]                 Display memory properties');
  print('  network [-l] [name]           Display network properties');
  print('  status [name]                 Display status properties');
  print('  whoami                        Display current context');
  print('  token [text]                  Display token properties');
  print('  dashboard [port]              Start dashboard server');
  print('  serve [path] [port]           Start http server');
  print('  connect                       Connect to CNS Dapr');
  print('  disconnect                    Disconnect from CNS Dapr');
  print('  top                           Monitor node changes');
  print('  map [-l] [name]               Display node map');
  print('  pwd                           Display current path');
  print('  cd [path]                     Set current path');
  print('  ls [path]                     List current path');
  print('  invoke method [path] [value]  Invoke CNS Dapr request');
  print('  profile name                  Invoke CNS Dapr profile request');
  print('  add [capability] [context]    Add capability to context');
  print('  remove [capability]           Remove capability from context');
  print('  get [path]                    Invoke CNS Dapr GET request');
  print('  set path value                Invoke CNS Dapr POST request');
  print('  subscribe                     Subscribe to current context');
  print('  unsubscribe                   Un-subscribe to current context');
  print('  publish value                 Publish to current context');
  print('  on [name] [command]           Execute command on change');
//  print('  exec file                     ');
  print('  curl method url [value]       Send http request to url');
  print('  wait [ms]                     Wait for specified milliseconds');
  print('  cls                           Clear the screen');
  print('  cat file                      Write file to the standard output');
  print('  echo [-n] [string]            Write to the standard output');
  print('  history [clear]               Display terminal history');
  print('  save file                     Save history to script file');
  print('  load file                     Load and execute script file');
  print('  exit [code]                   Exit the console with code');
  print('  quit                          Quit the console');

  // Console mode?
  if (terminal !== undefined)
    print('\nPress Ctrl+C to abort current command, Ctrl+D to exit the console');
}

// Show version
function version() {
  display('version', 'data', pack.version);
}

// Init env
async function init() {
  // Close console
  var history;

  if (terminal !== undefined) {
    history = terminal.history;
    close();
  }

  // Output help
  print('This utility will walk you through creating a .env environment file.');
  print('It only covers the most common items, and tries to guess sensible defaults.\n');

  print('Press ^C at any time to quit.\n');

  // Ask questions
  const answers = await questions([
    'CNS context:',
    'CNS token:'
  ], [
    config.CNS_CONTEXT,
    ''
  ]);

  if (answers !== null) {
    // Create new env data
    const data = {};

    for (const name in env.parsed)
      data[name] = env.parsed[name];

    if (answers[0] !== '') data.CNS_CONTEXT = answers[0];
    if (answers[1] !== '') data.CNS_TOKEN = answers[1];

    // Construct env file
    var text = '';

    for (const name in data)
      text += name + '=' + data[name] + '\n';

    // Ok to write?
    const file = path.resolve(process.cwd(), '.env');

    print('\nAbout to write to ' + file + ':\n\n' + text);
    const commit = await questions(['Is this OK?'], ['yes']);

    if (commit !== null) {
      const ok = commit[0].toLowerCase();

      if (ok === 'y' || ok === 'yes') {
        // Update config
        config.CNS_CONTEXT = answers[0];
        config.CNS_TOKEN = answers[1];

        write(file, comment() + text);
      } else print('Aborted.');
    }
  }

  // Reopen console?
  if (history !== undefined) {
    open();
    terminal.history = history;
  }
}

// Configure env
function configure(arg1, arg2) {
  const name = argument(arg1);
  const value = argument(arg2);

  property('config', config, name, value);
}

// Set output format
function output(arg1, arg2) {
  const name = argument(arg1);
  const value = argument(arg2);

  property('output', options, name, value);

  // Setting colour?
  if (name === 'monochrome') colourize();
}

// Display status
async function status(arg1) {
  const name = argument(arg1);

  // Get node
  const res = await request(
    dapr.HttpMethod.GET,
    '/node/status');

  property('status', res, name);
}

// Display memory
function memory(arg1) {
  const name = argument(arg1);
  const memory = process.memoryUsage();

  property('memory', memory, name);
}

// Display nework
function network(arg1) {
  const name = argument(arg1);
  const nets = os.networkInterfaces();

  // Display all?
  if (name === '-l') {
    display('network', 'network', nets);
    return;
  }

  // Look for ip
  for (const id in nets) {
    for (const net of nets[id]) {
      // Probably ip address
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal)
        property('network', net, name);
    }
  }
}

// Display context
function whoami() {
  // Must have context
  if (config.CNS_CONTEXT === '')
    throw new Error(E_CONTEXT);

  display('context', 'context', config.CNS_CONTEXT);
}

//
function token(arg1) {
  const token = argument(arg1, config.CNS_TOKEN);

  try {
    // Decode payload
    const parts = token.split('.');

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    const signature = parts[2];

    display('token', 'token', {
      header: header,
      payload: payload,
      signature: signature
    });
  } catch(e) {
    // Failure
    throw new Error(E_TOKEN);
  }
}

// Start dashboard
function dashboard(arg1) {
  const host = 'localhost';
  const port = argument(arg1, '8080');

  // I promise to
  return new Promise((resolve, reject) => {
    // Initialize express
    const app = new express();

    app.use(compression());
    app.use(express.static(path.join(__dirname, '/public')));

    debug('create webserver');

    // Create server
    const server = http.createServer(app)
    // Started
    .on('listening', () => {
      // Create web socket
      debug('create websocket');
      sockets.push(expressws(app, server).getWss());

      // Web socket request
      app.ws('/', (ws, req) => {
        // Receive
        ws.on('message', async (packet) => {
          // Pipe to socket
          pipe = ws;

          try {
            debug('websocket message: ' + packet);

            const data = JSON.parse(packet);
            await command(data.command);
          } catch(e) {
            debug('websocket error: ' + e.message);

            pipe.send(JSON.stringify({
              error: e.message
            }));
          }
          pipe = undefined;
        })
        // Closed
        .on('close', () => {
          debug('websocket disconnect');
        })
        // Failure
        .on('error', (e) => {
          debug('websocket error: ' + e.message);
        });

        debug('websocket connect');
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

// Open connection
async function connect() {
  // Disconnect current
  await disconnect();

  // Create client
  await create();
  await start();
}

// Close connection
async function disconnect() {
  // Not connected?
  if (client === undefined &&
    server === undefined)
    return;

  // Stop server
  await unsubscribe();

  // Stop client
  await stop();
}

// Show top changes
async function top() {
  // Get node
  const node = await request(
    dapr.HttpMethod.GET,
    '/node');

  var status = node.status;
  var changes = {};

  // Draw changes
  change = async (data) => {
    try {
      // Get node status
      status = await request(
        dapr.HttpMethod.GET,
        '/node/status');
    } catch(e) {
      // Failure
      status.connection = 'offline';
      changes = {};
    }

    const cols = columns();
    const lins = rows();

    const lines = [];

    lines.push('Node: ' + node.version + ', ' + node.broker + ' broker, connection ' + status.connection + '.');
    lines.push('Status: ' + status.reads + ' reads, ' + status.writes + ' writes, ' + status.updates + ' updates, ' + status.errors + ' errors.');
    lines.push('');

    // Display changes
    if (data !== undefined) {
      // Merge changes
      changes = merge(changes, data);

      // Format result
      const result = format('data', changes).split('\n');

      for (const line of result) {
        if (lines.length >= lins - 1) break;
        lines.push(line);
      }
    }

    if (Object.keys(changes).length === 0) {
      if (status.connection === 'offline')
        lines.push('OFFLINE'.red);
      else lines.push('NO CHANGE');

      cls();
    }

    process.stdout.write('\u001b[0;0H');

    for (const line of lines) {
      var l = line.substr(0, cols);
      if (l.length < cols) l += '\u001b[K';

      process.stdout.write(l + '\n');
    }

    // Output time
    const time = new Date().toLocaleTimeString();
    process.stdout.write('\u001b[0;' + (cols - 7) + 'H' + time + '\r');
  };

  // Initial display
  change();

  // Subscribe to context
  await subscribe();

  // Set draw timer
  const timer = setInterval(change, 1000);

  // Break signal handler
  signal = () => {
    change = undefined;

    clearInterval(timer);
    cls();

    prompt();
  };
}

// Show node map
async function map(arg1) {
  var all = (argument(arg1) === '-l');

  // Get node
  const res = await request(
    dapr.HttpMethod.GET,
    '/node');

  // Show contexts
  const node = {};
  const cons = res.contexts;

  for (const id in cons) {
    const con = cons[id];

    const name = con.name + (all?(' (' + id + ')'):'');
    const caps = cons[id].capabilities;

    // Show capabilities
    const context = {};

    for (const profile in caps) {
      const cap = con.capabilities[profile];

      const role = profile.endsWith(':provider')?'consumer':'provider';
      const conns = caps[profile].connections;

      // Show connections
      const capability = {};

      for (const id in conns) {
        const conn = cap.connections[id];

        const alias = conn[role] + (all?(' (' + id + ')'):'');
        const props = conns[id].properties;

        // Show properties
        const properties = {};

        if (all) {
          for (const name in props)
            properties[name] = props[name];
        }
        capability[alias] = properties;
      }
      context[profile] = capability;
    }
    node[name] = context;
  }

  // Output result
  display('map/node', 'node', node);
}

// Show current path
function pwd() {
  display('pwd', 'pwd', system.path);
}

// Change working path
function cd(arg1) {
  const path = argument(arg1, '~');
  system.path = location(path);

  // Set console prompt
  if (terminal !== undefined)
    terminal.setPrompt(cwd());
}

// List context
async function ls(arg1) {
  const path = location(arg1);

  if (path === '/') {
    directory({node: {}, profiles: {}});
    return;
  }

  // Get result
  const res = await request(
    dapr.HttpMethod.GET,
    path);

  // Output result
  directory(res);
}

// Invoke request
async function invoke(arg1, arg2, arg3) {
  const method = argument(arg1, dapr.HttpMethod.GET);
  const path = location(arg2);
  const value = argument(arg3);

  // No value defined?
  if (method === dapr.HttpMethod.POST && value === undefined)
    throw new Error(E_MISSING);

  // Get result
  const res = await request(
    method,
    path,
    value);

  // Output result
  display(path, 'data', res);
}

// Invoke profile
async function profile(arg1) {
  const name = required(arg1);
  const path = '/profiles/' + name;

  // Get result
  const res = await request(
    dapr.HttpMethod.GET,
    path);

  // Output result
  display(path, 'data', res);
}

// Add capability
async function add(arg1, arg2, arg3) {
  const profile = required(arg1);
  const path = location('~/capabilities/' + profile);

  const data = {
    scope: argument(arg2, 'context'),
    required: (argument(arg3) === 'required')
  };

  // Send request
  const res = await request(
    dapr.HttpMethod.PUT,
    path,
    data);

  // Output result
  display(path, 'data', res);
}

// Remove capability
async function remove(arg1) {
  const profile = required(arg1);
  const path = location('~/capabilities/' + profile);

  // Send request
  const res = await request(
    dapr.HttpMethod.DELETE,
    path);

  // Output result
  display(path, 'data', res);
}

// Invoke get
async function get(arg1) {
  const path = location(arg1);

  // Get result
  const res = await request(
    dapr.HttpMethod.GET,
    path);

  // Output result
  display(path, 'data', res);
}

// Invoke post
async function set(arg1, arg2) {
  const path = location(arg1);
  const data = required(arg2);

  // Send request
  const res = await request(
    dapr.HttpMethod.POST,
    path,
    data);

  // Output result
  display(path, 'data', res);
}

// Subscribe to context
async function subscribe() {
  // Already running
  if (server !== undefined) return;

  // Must have context
  if (config.CNS_CONTEXT === '')
    throw new Error(E_CONTEXT);

  // Start dapr app
  debug('starting cns.cli dapr app');
  spawn('dapr run --app-id cns-cli --app-port ' + config.CNS_SERVER_PORT + ' --resources-path ../cns-dapr/components --log-level error');

  try {
    // Create server
    server = new dapr.DaprServer({
      serverHost: config.CNS_SERVER_HOST,
      serverPort: config.CNS_SERVER_PORT,
      clientOptions: {
        daprHost: config.CNS_DAPR_HOST,
        daprPort: config.CNS_DAPR_PORT
      },
      logger: {
        level: system.loglevel
      }
    });

    // Subscribe to context
    await server.pubsub.subscribe(
      config.CNS_PUBSUB,
      'node/contexts/' + config.CNS_CONTEXT,
      update);

    // Start Dapr server
    await server.start();
    debug('server started');
  } catch(e) {
    // Failure
    throw new Error(E_PUBSUB + ': ' + e.message);
  }
}

//
async function unsubscribe() {
  // Not running?
  if (server === undefined) return;

  // Stop Dapr server
  await server.stop();
  debug('server stopped');

  server = undefined;

  // Stop Dapr app
  debug('stopping cns-cli dapr app');
  spawn('dapr stop --app-id cns-cli');
}

// Publish to context
async function publish(arg1) {
  const data = required(arg1);

  try {
    // Publish to context
    await client.pubsub.publish(
      config.CNS_PUBSUB,
      'node/contexts/' + config.CNS_CONTEXT,
      JSON.parse(data));
  } catch(e) {
    // Failure
    throw new Error(E_BADREQUEST);
  }
}

// On change event
async function on() {
  const args = Array.prototype.slice.call(arguments);

  // List events
  if (args.length === 0) {
    if (Object.keys(events).length > 0)
      property('events', events);
    return;
  }

  // Subscribe to context
  await subscribe();

  // Get name and command
  const name = argument(args.shift());
  const command = args.join(' ');

  // Add or remove?
  if (command === '') delete events[name];
  else events[name] = command;
}

//
//async function exec(arg1) {
//  const path = required(arg1);
//  await spawn(path);
//}

//
function curl(arg1, arg2, arg3) {
  // I promise to
  return new Promise((resolve, reject) => {
    const method = required(arg1);
    const url = required(arg2);
    const value = argument(arg3);

    // Decode url
    const dest = new URL(url);

    const options = {
      protocol: dest.protocol,
      hostname: dest.hostname,
      port: dest.port,
      path: dest.pathname + dest.search,
      method: method
//      headers: headers
    };

    // Send request
    const req = https
      .request(options, (res) => resolve(res))
      .on('error', (e) => reject(e));

    // Post request?
    if (method === 'POST') {
      // No value defined?
      if (value === undefined)
        throw new Error(E_MISSING);

      req.write(value);
    }

    req.end();
  })
  .then((result) => {
    // Get result
    return getData(result);
  })
  .then((result) => {
    display('data', 'data', result);
  });




  // Get result
//  const res = fetch(url);
//   await request(
//    method,
//    path,
//    value);

  // Output result
//  display('data', res);
}


// Fetch request data
function getData(req) {
  // I promise to
  return new Promise((resolve, reject) => {
    // Collate data
    var data = '';

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => resolve(data));
    req.on('error', (e) => reject(e));
  });
}


// Wait some time
async function wait(arg1) {
  const ms = argument(arg1);
  await sleep(ms);
}

// Clear screen
function cls() {
  console.clear();
}

// Echo file to console
function cat(arg1) {
  const path = required(arg1);
  const text = read(path).blue;

  process.stdout.write(text);
}

// Echo to console
function echo() {
  const args = Array.prototype.slice.call(arguments);

  const parts = [];
  var newline = true;

  for (const arg of args) {
    if (parts.length === 0 && arg === '-n')
      newline = false;
    else parts.push(argument(arg));
  }

  const text = parts.join(' ').blue;

  if (newline) console.log(text);
  else process.stdout.write(text);
}

// Display history
async function history(arg1) {
  const arg = argument(arg1);

  // Ignore this command
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

// Load script file
async function load(arg1) {
  const file = argument(arg1);

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

// Save script file
function save(arg1) {
  const file = argument(arg1);

  // Ignore this command
  terminal.history.shift();

  // Write file
  const data = '#!/usr/bin/env cns\n' + comment() +
    reverse(terminal.history).join('\n') + '\n';

  write(file, data);
  chmodx(file);
}

// Terminate program
async function exit(arg1) {
  const code = argument(arg1, 0) | 0;

  await disconnect();
  close();

  process.exit(code);
}

// Format output
function display(path, root, value) {
  const parts = path.split('/');

  // Pipe to socket
  if (pipe !== undefined) {
    var data = value;

    if (path.startsWith('/')) parts.shift();
    if (path.endsWith('/')) parts.pop();

    while(parts.length > 0) {
      const level = {};
      level[parts.pop()] = data;
      data = level;
    }

    pipe.send(JSON.stringify(data));
    return;
  }

  // Format and display
//  const root = block;//parts.pop();
  const text = format(root, value).trimEnd();

  if (text !== '') print(text);
}

// Format output value
function format(root, value) {
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
  const data = {};
  data[root] = value;

  const opt = {
    header: true
  };

  if (options.indent > 0)
    opt.indent = indent(' ');

  return jstoxml.toXML(data, opt);
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

// Create Dapr client
async function create() {
  try {
    // Create client
    client = new dapr.DaprClient({
      daprHost: config.CNS_DAPR_HOST,
      daprPort: config.CNS_DAPR_PORT,
      logger: {
        level: system.loglevel
      }
    });
  } catch(e) {
    // Failure
    throw new Error(E_CONNECT + ': ' + e.message);
  }
}

// Start Dapr client
async function start() {
  try {
    // Start client
    await client.start();
    debug('client started');
  } catch(e) {
    // Failure
    throw new Error(E_CONNECT + ': ' + e.message);
  }

  // Now online
//  stats.connection = 'online';
}

// Stop Dapr client
async function stop() {
  // Stop client
  if (client !== undefined) {
    if (client.daprClient.isInitialized) {
      await client.stop();
      debug('client stopped');
    }
    client = undefined;
  }

  // Now offline
//  stats.connection = 'offline';
}

// Update Dapr topic
async function update(data) {
  try {
    //
    for (const socket of sockets) {

    }

    //
    if (change !== undefined)
      change(data);

    //
    for (const name in data) {
      const cmd = events[name];

      if (cmd !== undefined) {
        system.data = data[name];
        await command(cmd);
      }
    }

    display('data', 'data', data);
  } catch(e) {
    // Failure
    error(e);
  }
}

// Invoke Dapr request
async function request(method, endpoint, data) {
  var res;

  // No client connected
  if (client === undefined)
    throw new Error(E_CONNETION);

  debug('invoking ' + method + ' ' + endpoint);

  try {
    // Invoke method
    res = await client.invoker.invoke(
      config.CNS_DAPR,
      endpoint,
      method,
      data);
  } catch(e) {
    // Failure
//    stats.errors++;
    throw new Error(E_INVOKE);
  }

  // Response error?
  if (res.error !== undefined) {
//    stats.errors++;
    throw new Error(res.error);
  }

  // Update stats
/*  switch (method) {
    case dapr.HttpMethod.GET:
      stats.reads++;
      break;
    case dapr.HttpMethod.POST:
    case dapr.HttpMethod.PUT:
    case dapr.HttpMethod.DELETE:
      stats.writes++;
      break;
  }*/
  return res.data;
}

// Ask question
function question(rl, question, def) {
  // I promise to
  return new Promise((resolve) => {
    // Ask question
    if (def) question += ' (' + def + ')';

    rl.question(question + ' ', (answer) => {
      resolve(answer || def);
    });
  });
}

// Ask multiple questions
function questions(questions, defaults) {
  // I promise to
  return new Promise(async (resolve) => {
    // Open console
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    // Ctrl+C
    .on('SIGINT', () => {
      // Abort input
      rl.close();

      print('\nAborted.');
      resolve(null);
    });

    // Get answers
    const answers = [];

    for (var n = 0; n < questions.length; n++)
      answers.push(await question(rl, questions[n], defaults[n]));

    // Close console
    rl.close();
    resolve(answers);
  });
}

// Generation comment
function comment() {
  return '// Generated by ' + pack.name + ' on ' + new Date().toISOString() + '\n';
}

// Read from file
function read(file) {
  // Missing file name?
  if (file === undefined)
    throw new Error(E_MISSING);

  try {
    // Read file
    debug('reading ' + file);
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
    debug('writing ' + file);
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
  fs.chmodSync(file, base8);

  debug('chmod +x ' + file);
}

// Spawn child process
function spawn(path) {
  return cp.exec(path, (e, stdout, stderr) => {
    if (e) error(new Error(E_SPAWN + ': ' + path.split(' ')[0]));
  });

/*
  const child = cp.spawn(path, {shell: true})
  // Failure
  .on('error', (e) => {
    error(new Error(E_SPAWN + ': ' + path.split(' ')[0]));
  });
*/
/*
  child.stdout.on('data', (data) => {
    console.log(data.toString().yellow);
  });

  child.stderr.on('data', (data) => {
    console.error(data.toString().red);
  });

  child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });
*/
}

// Go to sleep
function sleep(ms) {
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
      // Wait for ever
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

// Get column count
function columns() {
  return options.columns || process.stdout.columns || 80;
}

// Get row count
function rows() {
  return options.rows || process.stdout.rows || 25;
}

// Get indent
function indent(char) {
  return char.repeat(Math.min(Math.max(options.indent, 0), 8));
}

// Sanitize text value
function sanitize(value) {
  return value.toString().replaceAll('\n', ' ').trim();
}

// Colourize text output
function colourize() {
  if (options.monochrome)
    colours.disable();
  else colours.enable();
}

// Log text to console
function print(text) {
  if (!options.silent)
    console.log(text.green);
}

// Log debug to console
function debug(text) {
  if (options.debug)
    console.debug(text.magenta);
}

// Log error to console
function error(e) {
  console.error(options.debug?
    e.stack.red:format('error', e.message).red);
}

// Catch terminate signal
process.on('SIGINT', async () => {
  print('\rAborted.');

  if (signal !== undefined) {
    signal();
    signal = undefined;
  }

  await stop();

  exit(1);
});

// Start application
main(process.argv.slice(2));
