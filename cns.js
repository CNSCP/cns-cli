#!/usr/bin/env node

// cns.js - CNS Command line
// Copyright 2024 Padi, Inc. All Rights Reserved.

'use strict';

// Imports

const dapr = require('@dapr/dapr');

const env = require('dotenv').config();
const colours = require('colors');
const tables = require('table');
const readline = require('readline');
const fs = require('fs');

const pack = require('./package.json');

// Errors

const E_OPTION = 'Illegal option';
const E_COMMAND = 'Illegal command';
const E_MISSING = 'Missing argument';
const E_ARGUMENT = 'Invalid argument';
const E_VARIABLE = 'Invalid variable';
const E_MISSMATCH = 'Type missmatch';
const E_FORMAT = 'Invalid format';
const E_CONNETION = 'No connection';
const E_APP = 'Missing app';
const E_CONTEXT = 'Missing context';
const E_HOST = 'Missing host';
const E_PORT = 'Missing port';
const E_INVOKE = 'Invoke error';
const E_LOAD = 'Failed to load';
const E_SAVE = 'Failed to save';

// Status

const S_DISCONNECTED = 'disconnected';
const S_CONNECTED = 'connected';
const S_ONLINE = 'online';
const S_OFFLINE = 'offline';

// Defaults

const defaults = {
  CNS_CONTEXT: '',
  CNS_DAPR: 'cns-dapr',
  CNS_DAPR_HOST: 'localhost',
  CNS_DAPR_PORT: '3500',
  CNS_PUBSUB: 'cns-pubsub',
  CNS_SERVER_HOST: 'localhost',
  CNS_SERVER_PORT: '3000'
};

// Config

const config = {
  CNS_CONTEXT: process.env.CNS_CONTEXT || defaults.CNS_CONTEXT,
  CNS_DAPR: process.env.CNS_DAPR || defaults.CNS_DAPR,
  CNS_DAPR_HOST: process.env.CNS_DAPR_HOST || defaults.CNS_DAPR_HOST,
  CNS_DAPR_PORT: process.env.CNS_DAPR_PORT || defaults.CNS_DAPR_PORT,
  CNS_PUBSUB: process.env.CNS_PUBSUB || defaults.CNS_PUBSUB,
  CNS_SERVER_HOST: process.env.CNS_SERVER_HOST || defaults.CNS_SERVER_HOST,
  CNS_SERVER_PORT: process.env.CNS_SERVER_PORT || defaults.CNS_SERVER_PORT
};

// Options

const options = {
  loglevel: dapr.LogLevel.Error,
  output: 'text',
  monochrome: false,
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
  status: S_DISCONNECTED
};

// Commands

const commands = {
  'help': help,
  'version': version,
  'init': init,
  'config': configure,
  'output': output,
  'connect': connect,
  'disconnect': disconnect,
  'status': status,
  'get': get,
  'set': set,
  'list': list,
  'on': on,
  'cls': cls,
  'echo': echo,
  'history': history,
  'clear': clear,
  'save': save,
  'load': load,
  'quit': quit
};

// Shortcuts

const shortcuts = {
  'h': 'help',
  '?': 'help',
  'v': 'version',
  'i': 'init',
  'c': 'config',
  'o': 'output',
  's': 'status',
  'ls': 'list',
  'q': 'quit'
};

// Local data

var server;
var client;

var terminal;
var completions;
var signal;

// Local functions

// Main entry point
async function main(argv) {
  // Diable colours
  colours.disable();

  try {
    // Parse options
    const line = parse(argv);

    // Connect to Dapr
    await connect();

    // Process file?
    if (line.endsWith('.cns')) {
      await load(line);
      process.exit(0);
    }

    // Process command?
    if (line !== '') {
      await command(line);
      process.exit(0);
    }

    // Open terminal
    open();
  }
  // Failure
  catch(e) {
    error(e);
    process.exit(1);
  }
}

// Show usage
function usage() {
  print('Usage: cns [options] [ script.cns ] [commands]\n');

  print('Options:');
  print('  -h, --help                  Output usage information');
  print('  -v, --version               Output version information');
  print('  -c, --context id            Set CNS context id');
  print('  -a, --app-id name           Set Dapr CNS app id');
  print('  -dh, --dapr-host name       Set Dapr CNS host');
  print('  -dp, --dapr-port number     Set Dapr CNS port');
  print('  -p, --pubsub name           Set Dapr pubsub component');
  print('  -sh, --server-host name     Set Dapr client host');
  print('  -sp, --server-port number   Set Dapr client port');
  print('  -l, --log-level level       Set Dapr log level');
  print('  -o, --output format         Set output format');
  print('  -m, --monochrome            Disable console colours');
  print('  -s, --silent                Disable console output');
  print('  -d, --debug                 Enable debug output\n');

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

    switch(arg) {
      case '-h':
      case '-?':
      case '--help':
        // Show usage
        usage();
        process.exit(0);
        break;
      case '-v':
      case '--version':
        // Show version
        version();
        process.exit(0);
        break;
      case '-c':
      case '--context':
        // Context id
        config.CNS_CONTEXT = next(args);
        break;
      case '-a':
      case '--app-id':
        // Set Dapr CNS app id
        config.CNS_DAPR = next(args);
        break;
      case '-dh':
      case '--dapr-host':
        // Set Dapr CNS host
        config.CNS_DAPR_HOST = next(args);
        break;
      case '-dp':
      case '--dapr-port':
        // Set Dapr CNS port
        config.CNS_DAPR_PORT = next(args);
        break;
      case '-p':
      case '--pubsub':
        // Set Dapr pubsub component
        config.CNS_PUBSUB = next(args);
        break;
      case '-sh':
      case '--server-host':
        // Set Dapr server host
        config.CNS_SERVER_HOST = next(args);
        break;
      case '-sp':
      case '--server-port':
        // Set Dapr server port
        config.CNS_SERVER_PORT = next(args);
        break;
      case '-l':
      case '--log-level':
        // Set Dapr log level
        options.loglevel = next(args) | 0;
        break;
      case '-o':
      case '--output':
        // Set output type
        options.output = next(args);
        break;
      case '-m':
      case '--monochrome':
        // No colour mode
        options.monochrome = true;
        break;
      case '-s':
      case '--silent':
        // Silent mode
        options.loglevel = dapr.LogLevel.Error;
        options.silent = true;
        break;
      case '-d':
      case '--debug':
        // Debug mode
        options.loglevel = dapr.LogLevel.Debug;
        options.debug = true;
        break;
      default:
        // Bad option?
        if (arg.startsWith('-'))
          throw new Error(E_OPTION + ': ' + arg);

        // Add to line
        line.push(arg);
        break;
    }
  }
  return line.join(' ');
}

// Get next arg
function next(args) {
  // No more args?
  if (args.length === 0)
    throw new Error(E_MISSING);

  // Get next arg
  return args.shift();
}

// Open terminal
function open() {
  // Enable colours?
  if (!options.monochrome)
    colours.enable();

  // Output welcome
  print('Welcome to CNS v' + pack.version + '.');
  print('Type "help" for more information.');

  // Make completions
  completions = Object.keys(commands).sort();
  signal = false;

  // Create interface
  terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completer,
    prompt: '> ',
    terminal: true
  })
    // Input line
  .on('line', async (line) => {
    // Ignore terminate signal
    signal = false;
    pause();

    try {
      // Parse line
      await command(line);
    }
    // Failure
    catch (e) {
      error(e);
    }

    // Output prompt
    resume();
    prompt();
  })
  // Ctrl+C
  .on('SIGINT', () => {
    // Are you sure?
    if (!signal) {
      print('\n(To quit, press Ctrl+C again or type "quit")');
      prompt();

      signal = true;
      return;
    }

    // Close terminal
    print('\r');
    close();
  });

  // Output prompt
  prompt();
}

// Tab completer
function completer(line) {
  const hits = completions.filter((c) => c.startsWith(line));
  return [hits.length?hits:completions, line];
}

// Output terminal prompt
function prompt() {
  // Terminal exists?
  if (terminal !== undefined &&
    !options.silent)
    terminal.prompt();
}

// Pause terminal input
function pause() {
  // Terminal exists?
  if (terminal !== undefined)
    terminal.pause();
}

// Resume terminal input
function resume() {
  // Terminal exists?
  if (terminal !== undefined)
    terminal.resume();
}

// Close terminal
function close() {
  // Terminal exists?
  if (terminal !== undefined) {
    terminal.close();
    terminal = undefined;
  }
}

// Parse command
async function command(line) {
  // Trim start
  line = line.trimStart();

  // Remove comments
  line = line.split('//')[0];
  line = line.split(';')[0];

  // Empty line?
  line = line.trimEnd().replace(/\s\s+/g, ' ');
  if (line === '') return;

  // Split args
  const args = (line.match(/[^\s"]+|"([^"]*)"/g) || [])
    .map((word) => word.replace(/^"(.*)"$/, '$1'));

//split semi colons

  // Get command arg
  const cmd = args.shift();

  // Process command
  const c = cmd.toLowerCase();
  const fn = commands[shortcuts[c] || c];

  // Command not found?
  if (fn === undefined)
    throw new Error(E_COMMAND);

  // Too many args?
  if (cmd !== 'echo' && args.length > fn.length)
    throw new Error(E_ARGUMENT);

  // Call command
  await fn.apply(this, args);
}

// Get command argument
function argument(arg, def) {
  const value = (arg === undefined)?def:arg;

  // Variable expand?
  if (typeof value === 'string' && value.startsWith('$'))
    return variable(value.substr(1));

  return value;
}

// Get variable
function variable(name) {
  // Look for name
  if (config[name] !== undefined) return config[name];
  if (options[name] !== undefined) return options[name];
  if (stats[name] !== undefined) return stats[name];

  // Not found
  throw new Error(E_VARIABLE + ': ' + name);
}

// Get invoke endpoint
function location(property) {
  var endpoint = config.CNS_CONTEXT;

  if (property !== undefined)
    endpoint += '/' + property;

  return endpoint;
}

// Get or set property
function property(obj, name, value) {
  // Output properties
  if (name === undefined)
    display('', obj);
  else {
    // Property must exist
    const current = obj[name];

    if (current === undefined)
      throw new Error(E_ARGUMENT + ': ' + name);

    // Output property
    if (value === undefined)
      display(name, current);
    else {
      // Set value
      obj[name] = cast(current, value);
      return true;
    }
  }
  return false;
}

// Cast property value
function cast(current, value) {
  // What type?
  switch (typeof current) {
    case 'string':
      return value;
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
async function help() {
  // Output help
  print('  h, help                     Output help information');
  print('  v, version                  Output version information');
  print('  i, init                     Initialize .env with current config');
  print('  c, config [name [value]]    Display or set config properties');
  print('  o, output [format]          Display or set output format');
  print('  s, status [name]            Display status properties');
//  print('  connect [host [port]]       Connect to Dapr CNS app');
//  print('  disconnect                  Disconnect from Dapr CNS app');
  print('  get [name]                  Invoke Dapr CNS get request');
  print('  set name value              Invoke Dapr CNS post request');
  print('  ls, list                    ');
  print('  on event [name] command     ');
  print('  cls                         Clear the screen');
  print('  echo string                 Write to the standard output');
  print('  history                     Display terminal history');
  print('  clear                       Clear terminal history');
  print('  save file                   Save history to script file');
  print('  load file                   Load and execute script file');
  print('  q, quit                     Quit the interpreter');

  // Terminal mode?
  if (terminal !== undefined)
    print('\nPress Ctrl+C to quit the interpreter');
}

// Show version
async function version() {
  print(pack.version);
}

// Init env
async function init() {
  // Construct env file
  var env = generated();

  for (const name in config) {
    const value = config[name];

    // Dont add defaults
    if (value !== defaults[name])
      env += name + '=' + value + '\n';
  }

  // Write file
  write('.env', env);
}

// Configure env
async function configure(arg1, arg2) {
  // Get arguments
  const name = argument(arg1);
  const value = argument(arg2);

  if (property(config, name, value))
    await connect();
}

// Set output format
async function output(arg1) {
  // Get arguments
  const format = argument(arg1);
  property(options, 'output', format);
}

// Open connection
async function connect(arg1, arg2) {
  // Disconnect current
  await disconnect();

  // Get arguments
  const host = argument(arg1, config.CNS_DAPR_HOST);
  const port = argument(arg2, config.CNS_DAPR_PORT);

  const serverHost = config.CNS_SERVER_HOST;
  const serverPort = config.CNS_SERVER_PORT;

  // Start connection
  await start(host, port, serverHost, serverPort, options.loglevel);
  debug('client connected');
}

// Close connection
async function disconnect() {
  // Not connected
  if (client === undefined &&
    server === undefined)
    return;

  // Stop connection
  await stop();
  debug('client disconnected');
}

// Display status
async function status(arg1) {
  // Get arguments
  const name = argument(arg1);
  property(stats, name);
}

// Invoke get
async function get(arg1) {
  // Get arguments
  const property = argument(arg1);
  const endpoint = location(property);

  // Get current
  const result = await invoke(
    config.CNS_DAPR,
    endpoint,
    dapr.HttpMethod.GET);

  // Output result
  const parts = endpoint.split('/');
  const name = parts[parts.length - 1];

  display(name, result.data);
}

// Invoke post
async function set(arg1, arg2) {
  // Get arguments
  const property = argument(arg1);
  const value = argument(arg2);

  const endpoint = location(property);

  // Post to context
  await invoke(
    config.CNS_DAPR,
    endpoint,
    dapr.HttpMethod.POST,
    value);
}

// List context
async function list(arg1, arg2, arg3, arg4) {
  // Get arguments
  const context = argument(arg1);
  const capability = argument(arg2);
  const connection = argument(arg3);
  const property = argument(arg4);

  // Get context
  const result = await invoke(
    config.CNS_DAPR,
    config.CNS_CONTEXT,
    dapr.HttpMethod.GET);

  // Restructure result
  const caps = [];

  const data = result.data;
  const conns = data.connections;

  // Has any connections?
  if (conns !== undefined) {
    // Add connections
    for (const id in conns) {
      // Get details
      const conn = conns[id];

      const profile = conn.profile;
      const version = conn.version || '';
      const role = conn.role;
      const reverse = (role === 'server')?'client':'server';
      const alias = conn[reverse] || id;
      const properties = conn.properties || [];

      // Work out capability
      var name = 'cp:' + conn.profile;

      if (version !== '')
        name += ':v' + version;

      name += '/' + ((role === 'server')?'provider':'consumer');

      var cap;

      for (const c of caps) {
        // Already added?
        if (c.name === name) {
          cap = c;
          break;
        }
      }

      if (cap === undefined) {
        // Add new capability
        caps.push({
          name: name,
          children: [{
            name: alias
          }]
        });
      } else {
        // Add connection
        cap.children.push({
          name: alias
        });
      }
    }
  }

  // No capabilities?
  if (caps.length === 0) {
    caps.push({
      name: 'none',
      children: [{
        name: 'none',
        children: [{
          name: 'none'
        }]
      }]
    });
  }

  // No context?
  if (context === undefined) {
    // Output whole tree
    print(tree('node', [{
      name: data.name,
      children: caps
    }]));

    return;
  }

  // Context match?
  if (context === data.name || context === config.CNS_CONTEXT) {
    // No capability?
    if (capability === undefined) {
      // Output context
      print(tree(context, caps));
      return;
    }

    // Match capability
    for (const cap of caps) {
      // Found match?
      if (capability === cap.name) {
        // No connection?
        if (connection === undefined) {
          // Output capability
          print(tree(capability, cap.children));
          return;
        }

        // Match connection
        for (const id in conns) {
          // Found match?
          const conn = conns[id];

          const role = conn.role;
          const alias = conn[(role === 'server')?'client':'server'];

          if (connection === id || connection === alias) {
            // No property?
            if (property === undefined) {
              // Output properties
              display(alias, conn.properties);
              return;
            }

            // Match property?
            const value = conn.properties[property];

            if (value !== undefined) {
              // Output property
              display(property, value);
              return;
            }
          }
        }
      }
    }
  }

  // No match
  throw new Error('Not found');
}

//
async function on(arg1, arg2, arg3) {
  throw new Error('on your bike');
}

// Clear screen
async function cls() {
  console.clear();
}

// Echo to console
async function echo() {
// -n for no newline
  const args = Array.prototype.slice.call(arguments);
  const text = [];

  for (const arg of args)
    text.push(argument(arg));

  print(text.join(' '));
}

// Display history
async function history() {
  terminal.history.shift();
  print(reverse(terminal.history).join('\n'));
}

// Clear history
async function clear() {
  terminal.history = [];
}

// Load script file
async function load(arg1) {
  // Get arguments
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
    }
    // Failure
    catch (e) {
      throw new Error(e.message + ': ' + file + ', line ' + (l + 1));
    }
  }
}

// Save script file
async function save(arg1) {
  // Dont keep save
  terminal.history.shift();

  // Get arguments
  const file = argument(arg1);

  // Write file
  const data = '#!/usr/bin/env cns\n' +
    generated() +
    reverse(terminal.history).join('\n') + '\n';

  write(file, data);

  // chmod +x file
}

// Quit program
async function quit() {
  close();
}

// Format output
function display(name, value) {
  console.log(format(name, value).yellow);
}

// Format output value
function format(name, value) {
  // What output format?
  switch (options.output) {
    case 'text':
      return text(name, value, '');
    case 'table':
      return table(name, value);
    case 'json':
      return json(name, value);
  }
  throw new Error(E_FORMAT);
}

// Format as text
function text(name, value, level) {
  if (typeof value === 'object') {
    var s = '';

    for (const name in value) {
      const v = value[name];

      if (typeof v === 'object')
        s += level + name + ':\n' + text(name, v, level + '  ');
      else s += level + name + '=' + v + '\n';
    }
    return s.trimEnd();
  }
  return value;
}

// Format as table
function table(name, value) {
  if (typeof value === 'object') {
    const t = [['Property', 'Value']];

    for (const name in value) {
      const v = value[name];

      if (typeof v === 'object')
        t.push([name, table(name, v)]);
      else t.push([name, v]);
    }
    return tables.table(t, {
      drawHorizontalLine: (lineIndex, rowCount) => {
        return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount;
      }
    }).trimEnd();
  }
  return tables.table([[name, value]]).trimEnd();
}

// Forat as json
function json(name, value) {
  return JSON.stringify(value, null, 2);
}

// Format as tree
function tree(root, data) {
  const render = [];

  parseTree(data);
  renderTree(root, data, render);

  return render.join('\n');
}

// Parse tree data
function parseTree(data, parent) {
  //
  for (var i = 0; i < data.length; i++) {
    const item = data[i];
    item.last = (i === data.length - 1);

    var parents = [];

    if (parent && parent.parents) {
      //
      parents = JSON.parse(JSON.stringify(parent.parents));

      parents.push({
        last: parent.last
      });
    }
    item.parents = parents;

    if (item.children && item.children.length)
      parseTree(item.children, item);
  }
}

// Render tree
function renderTree(root, data, render) {
  if (!render.length && data.length)
    render.push(root);

  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    var row = '';

    for (var j = 0; j < item.parents.length; j++) {
      var p = item.parents[j];
      row += p.last?'    ':'│   ';
    }

    var endLabel = (item.last ? '└── ' : '├── ') + item.name;
    row += endLabel;

    render.push(row);

    if (item.children && item.children.length)
      renderTree(root, item.children, render);
  }
}

// Start Dapr connection
async function start(host, port, serverHost, serverPort, level) {
  // No host defined
  if (host === undefined)
    throw new Error(E_HOST);

  // No port defined
  if (port === undefined)
    throw new Error(E_PORT);

  // Log level
  const logger = {
    level: level
  };

  // Create client
  client = new dapr.DaprClient({
    daprHost: host,
    daprPort: port,
    logger: logger
  });

  // Start client
  await client.start();

  // Server connected?
//  if (server === undefined) {
    // Dapr server
    /*
    server = new dapr.DaprServer({
      serverHost: serverHost,
      serverPort: serverPort,
      clientOptions: {
        daprHost: host,
        daprPort: port
      }
    });
    */
//  }

  // Set status
  stats.status = S_CONNECTED;
}

// Invoke Dapr request
async function invoke(app, context, method, data) {
  // No client connected
  if (client === undefined)
    throw new Error(E_CONNETION);

  // No app defined
  if (app === undefined)
    throw new Error(E_APP);

  // No context defined
  if (context === '')
    throw new Error(E_CONTEXT);

  debug('invoke ' + context + ' ' + method);

  var result;

  try {
    // Invoke method
    result = await client.invoker.invoke(
      app,
      context,
      method,
      data);
  }
  // Failure
  catch(e) {
    problem(E_INVOKE);
  }

  // Response error?
  if (result.error !== undefined)
    problem(E_INVOKE + ': ' + result.error);

  // Update stats
  switch (method) {
    case dapr.HttpMethod.GET:
      // No data?
      if (result.data === undefined)
        problem(E_INVOKE + ': no data');

      stats.reads++;
      break;
    case dapr.HttpMethod.POST:
      stats.writes++;
      break;
  }

  // Set status
  stats.status = S_ONLINE;

  return result;
}

// Dapr problem
function problem(text) {
  stats.errors++;
  stats.status = S_OFFLINE;

  throw new Error(text);
}

// Stop Dapr connection
async function stop() {
  // Stop client
  if (client !== undefined) {
    await client.stop();
    client = undefined;
  }

  // Stop server
  if (server !== undefined) {
    await server.stop();
    server = undefined;
  }

  // Set status
  stats.status = S_DISCONNECTED;
}

// Generation comment
function generated() {
  return '// Generated by ' + pack.name + ' on ' + new Date().toISOString() + '\n';
}

// Read from file
function read(file) {
  // Missing file name?
  if (file === undefined)
    throw new Error(E_MISSING);

  try {
    // Read file
    return fs.readFileSync(file, 'utf8');
  }
  // Failure
  catch (e) {
    throw new Error(E_LOAD + ': ' + file);
  }
}

// Write to file
function write(file, data) {
  // Missing file name?
  if (file === undefined)
    throw new Error(E_MISSING);

  try {
    // Write file
    fs.writeFileSync(file, data, 'utf8');
  }
  // Failure
  catch (e) {
    throw new Error(E_SAVE + ': ' + file);
  }
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
    e.stack.red:e.message.red);
}

// Start application
main(process.argv.slice(2));
