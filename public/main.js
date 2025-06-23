// main.js - CNS Dashboard
// Copyright 2025 Padi, Inc. All Rights Reserved.

// Application

const app = (function() {

// Constants

const WAIT = 500;

// Local data

var socket;
var cache;

// Event handlers

// Handle app init
function init() {
  // Get settings
  setList();
  setTheme();

  // Connect host
  connect();
}

// Handle app exit
function exit() {
  // Disconnect host
  disconnect();
}

// Handle click
function click(e) {
  // Get target
  const element = target(e);
  if (element === null) return;

  const id = element.id;
  const val = value(element);

console.log('clicked', id, val);

  // Clicked what?
  switch (id) {
    case 'list':
      // Toggle menu
      setList(toggle('#online nav', 'list', 'collapse', 'expand'));
      break;
    case 'overview':
    case 'config':
    case 'network':
    case 'profiles':
    case 'nodes':
    case 'console':
    case 'about':
      // Change view
      setView(id);
      break;
    case 'theme':
      // Toggle theme
      setTheme(toggle('body', 'theme', 'light', 'dark'));
      break;
    case 'help':
      // Toggle help
      const help = element.parentElement.nextElementSibling;
      attribute(help, 'hidden', toggle(help, 'hidden', '', null));
      break;
    case 'profiles-view':
      // View profile
      window.open('https://cp.padi.io/profiles/' + val);
      break;
    case 'profiles-expand':
      const p1 = element.parentElement.parentElement.nextElementSibling;
      const t1 = toggle(p1, 'hidden', '', null);
      attribute(p1, 'hidden', t1);
      text(element.firstElementChild, (t1 === null)?'expand_more':'chevron_right');
      break;
    case 'profiles-install':
      // Install profile
      disabled(element, true);
      command('install "https://cp.padi.io/profiles/' + val + '"');
      break;
    case 'profiles-remove':
      // Remove profile
      disabled(element, true);
      command('purge "cns/network/profiles/' + val + '"');
      break;
    case 'nodes-expand':
      const node = element.parentElement.parentElement.nextElementSibling;
      const tog = toggle(node, 'hidden', '', null);
      attribute(node, 'hidden', tog);
      text(element.firstElementChild, (tog === null)?'expand_more':'chevron_right');
      break;
  }
}

// Handle input change
function change(e) {
  // Get target
  const element = target(e);
  if (element === null) return;

  const id = element.id;
  const val = value(element);

console.log('change', id, val);

  // Changed what?
  switch (id) {
    case 'config-host':
      command('config host "' + val + '"');
      break;
    case 'config-port':
      command('config port "' + val + '"');
      break;
    case 'config-username':
      command('config username "' + val + '"');
      break;
    case 'config-password':
      command('config password "' + val + '"');
      break;
    case 'network-name':
      command('put cns/network/name "' + val + '"');
      break;
    case 'network-orchestrator':
      command('put cns/network/orchestrator "' + val + '"');
      break;
    case 'network-token':
      command('put cns/network/token "' + val + '"');
      break;
  }
}

// Handle form submit
function submit(e) {
  // Get target
  const element = target(e);
  if (element === null) return;

  const id = element.id;

console.log('submit', id);

  // Submit what?
  switch (id) {
    case 'profiles-form':
      html('#profiles-list', profiles());
      focus('#profiles-search');
      break;
    case 'nodes-form':
      html('#nodes-list', nodes());
      focus('#nodes-search');
      break;
    case 'command-form':
      const cmd = value('#command-line');

      if (cmd === '') focus('#command-line');
      else command(cmd);

      value('#command-line', '');
      html('#command-response', '');
      break;
  }
  return false;
}

// User interface

// Set list type
function setList(value) {
  if (value !== undefined) store('nav', value);
  else value = fetch('nav', 'collapse');

  attribute('#online nav', 'list', value);

  text('#list i', (value === 'collapse')?'chevron_right':'chevron_left');
}

// Set theme
function setTheme(value) {
  if (value !== undefined) store('theme', value);
  else value = fetch('theme', 'light');

  attribute('body', 'theme', value);

  text('#theme i', (value === 'light')?'dark_mode':'light_mode');
  text('#theme span', (value === 'light')?'Dark Theme':'Light Theme');
}

// Set current view
function setView(value) {
  radio('#online article nav button', 'selected', 'id', value);
  radio('#online article section', 'hidden', 'view', value);

  focus('#online section[view="' + value + '"] input:first-of-type');
}

// Find target for event
function target(e) {
  var element = e.target;

  while (element !== null && element.id === '')
    element = element.parentElement;

  return element;
}

// Toggle attribute
function toggle(selector, attr, on, off) {
  return (attribute(selector, attr) === on)?off:on;
}

// Set radio attribute
function radio(selector, attr, name, value) {
  const elements = $$(selector);

  for (const e of elements) {
    const id = attribute(e, name);

    switch (attr) {
      case 'selected': selected(e, (id === value)); break;
      case 'hidden': hidden(e, (id !== value)); break;
    }
  }
}

// Update with changes
async function update() {
  const c = cache || {};

  const version = c.version || '';
  const config = c.config || {};
  const stats = c.stats || {};
  const keys = c.keys || {};

  const isOnline = (stats.connection === 'online');

  const online = $$('[online]');
  const offline = $$('[offline]');

  for (const e of online)
    hidden(e, !isOnline);

  for (const e of offline)
    hidden(e, isOnline);

  var list1 = '';
  var list2 = '';
  var list3 = '';
  var list4 = '';

  const state = isOnline?'Online':'<span error>Offline</span>';
  const network = keys['cns/network/name'];

  list1 =
    '<table>' +
      '<tr>' +
        '<th>Version</th>' +
        '<th>Network</th>' +
        '<th>Started</th>' +
        '<th>Reads</th>' +
        '<th>Writes</th>' +
        '<th>Updates</th>' +
        '<th>Errors</th>' +
        '<th>Connection</th>' +
      '</tr>' +
      '<tr>' +
        '<td>' + sanitize(version) + '</td>' +
        '<td>' + sanitize(network) + '</td>' +
        '<td>' + sanitize(stats.started) + '</td>' +
        '<td>' + sanitize(stats.reads) + '</td>' +
        '<td>' + sanitize(stats.writes) + '</td>' +
        '<td>' + sanitize(stats.updates) + '</td>' +
        '<td>' + sanitize(stats.errors) + '</td>' +
        '<td>' + sanitize(state) + '</td>' +
      '</tr>' +
    '</table>';

  if (isOnline) {
    list3 = profiles();
    list4 = nodes();
  }

  text('#version', sanitize(version));
  html('#path', isOnline?sanitize(network):state);

  html('#overview-status', list1);
  html('#overview-notifications', list2);

  value('#config-host', config.host || '');
  value('#config-port', config.port || '');
  value('#config-username', config.username || '');
  value('#config-password', config.password || '');

  value('#network-name', keys['cns/network/name'] || '');
  value('#network-orchestrator', keys['cns/network/orchestrator'] || '');
  value('#network-token', keys['cns/network/token'] || '');

  html('#profiles-list', list3);
  html('#nodes-list', list4);
}

//
function profiles() {
  const c = cache || {};

  const keys = c.keys || {};
  const defs = c.profiles || {};

  const search = '*' + value('#profiles-search') + '*';

  const profiles = {};

  if (search !== '**') {
    for (const id in defs) {
      const name = defs[id];

      if (match(id, search) || match(name, search)) {
        const versions = 'v1';

        profiles[id] = {
          name: name,
          install: 'http://cp.padi.io/profiles/' + id,
          versions: versions
        };
      }
    }
  }

  // Get installed profiles
  const installed = filter(keys, 'cns/network/profiles/*/name');

  for (const profile in installed) {
    const parts = profile.split('/');

    const id = parts[3];
    const name = installed[profile];

    if (match(id, search) || match(name, search)) {

const versions = 'v1';

      profiles[id] = {
        name: name,
        install: null,
        versions: versions
      };
    }
  }

  var list = '';
  var total = 0;

  const order = Object.keys(profiles).sort();

  for (const id of order) {
    const profile = profiles[id];

    const name = profile.name;
    const install = profile.install;
    const vers = profile.versions;

    const expand = install?
      '<button id="profiles-view" value="' + id + '" icon primary><i>visibility</i></button>':
      '<button id="profiles-expand" value="' + id + '" icon primary><i>chevron_right</i></button>';

    const action = install?
      '<button id="profiles-install" value="' + id + '" data-tip="Install Profile" data-pos="left" icon primary><i>download</i></button>':
      '<button id="profiles-remove" value="' + id + '" data-tip="Remove Profile" data-pos="left"  icon primary><i>delete</i></button>';

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + id + '</td>' +
        '<td>' + name + '</td>' +
        '<td>' + vers + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>';

    if (!install) {
      const form =
        '<form id="profile-form">' +
          '<label>Profile name</label>' +
          '<input id="profile-name" type="text" value="' + name + '" placeholder="My Node"/>' +
        '</form>';

      const content = versions(id);

      list +=
        '<tr expand hidden>' +
          '<td></td>' +
          '<td colspan="4">' +
            form +
            content +
          '</td>' +
        '</tr>';
    }
    total++;
  }

  var attr = ' width="100%"';

  if (total > 0) {
    list =
      '<tr>' +
        '<th></th>' +
        '<th>Profile</th>' +
        '<th>Name</th>' +
        '<th width="100%">Versions</th>' +
        '<th></th>' +
      '</tr>' +
      list;

    attr = ' colspan="4"';
  }
  return '<table>' +
      list +
      '<tr>' +
        '<td' + attr + '">' + total + ' Profiles found</td>' +
        '<td><button id="profiles-add" data-tip="Add Profile" data-pos="left" icon primary><i>add</i></button></th>' +
      '</tr>' +
    '</table>';
}

//
function versions(profile) {
  const c = cache || {};
  const keys = c.keys || {};

  var list = '';
  var total = 0;

  const versions = filter(keys, 'cns/network/profiles/' + profile + '/versions/*/name');
  const order = Object.keys(versions).sort();

  for (const version of order) {
    const parts = version.split('/');

    const id = parts[5];
    const name = versions[version];

    const expand = '<button id="versions-expand" value="' + id + '" icon primary><i>chevron_right</i></button>';
    const action = '<button id="versions-remove" value="' + id + '" data-tip="Remove Version" data-pos="left" icon primary><i>delete</i></button>';

const content='';

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + name + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>' +
      '<tr expand hidden>' +
        '<td></td>' +
        '<td colspan="2">' +
          content +
        '</td>' +
      '</tr>';

    total++;
  }

  var attr = ' width="100%"';

  if (total > 0) {
    list =
      '<tr>' +
        '<th></th>' +
        '<th width="100%">Version</th>' +
        '<th></th>' +
      '</tr>' +
      list;

    attr = ' colspan="2"';
  }
  return '<table>' +
      list +
      '<tr>' +
        '<td' + attr + '>' + total + ' Versions found</td>' +
        '<td><button id="versions-add" data-tip="Add Version" data-pos="left" icon primary><i>add</i></button></td>' +
      '</tr>' +
    '</table>';
}

//
function nodes() {
  const c = cache || {};

  const keys = c.keys || {};
  const search = '*' + value('#nodes-search') + '*';

  var list = '';
  var total = 0;

  const nodes = filter(keys, 'cns/network/nodes/*/name');
  const order = Object.keys(nodes).sort();

  for (const node of order) {
    const parts = node.split('/');

    const id = parts[3];
    const name = nodes[node];

    if (match(id, search) || match(name, search)) {
      const expand = '<button id="nodes-expand" icon primary><i>chevron_right</i></button>';
      const action = '<button id="nodes-remove" value="' + id + '" data-tip="Remove Node" data-pos="left" icon primary><i>delete</i></button>';

      const ns = 'cns/network/nodes/' + id + '/';

      const upstream = keys[ns + 'upstream'];
      const token = keys[ns + 'token'];
//      const status = keys[ns + 'status'];

      const form =
        '<form id="node-form">' +
          '<label>Node name</label>' +
          '<input id="node-name" type="text" value="' + name + '" placeholder="My Node"/>' +
          '<label>Node upstream</label>' +
          '<input id="node-upstream" type="text" value="' + upstream + '" placeholder="no"/>' +
          '<label>Node token</label>' +
          '<input id="node-token" type="text" value="' + token + '" placeholder=""/>' +
        '</form>';

      const content = contexts(id);

      list +=
        '<tr>' +
          '<td>' + expand + '</td>' +
          '<td>' + id + '</td>' +
          '<td>' + name + '</td>' +
          '<td>' + upstream + '</td>' +
//          '<td>' + status + '</td>' +
          '<td>' + action + '</td>' +
        '</tr>' +
        '<tr expand hidden>' +
          '<td></td>' +
          '<td colspan="4">' +
            form +
            content +
          '</td>' +
        '</tr>';

      total++;
    }
  }

  var attr = ' width="100%"';

  if (total > 0) {
    list =
      '<tr>' +
        '<th></th>' +
        '<th>Node</th>' +
        '<th>Name</th>' +
        '<th width="100%">Upstream</th>' +
//        '<th width="100%">Status</th>' +
        '<th></th>' +
      '</tr>' +
      list;

    attr = ' colspan="4"';
  }
  return '<table>' +
      list +
      '<tr>' +
        '<td' + attr + '>' + total + ' Nodes found</td>' +
        '<td><button id="profiles-add" data-tip="Add Node" data-pos="left" icon primary><i>add</i></button></td>' +
      '</tr>' +
    '</table>';
}

//
function contexts(node) {
  const c = cache || {};

  const keys = c.keys || {};
  const search = '*' + value('#nodes-search') + '*';

  var list = '';
  var total = 0;

  const contexts = filter(keys, 'cns/network/nodes/' + node + '/contexts/*/name');
  const order = Object.keys(contexts).sort();

  for (const context of order) {
    const parts = context.split('/');

    const id = parts[5];
    const name = contexts[context];

    if (match(id, search) || match(name, search)) {


      total++;
    }
  }

  var attr = ' width="100%"';


  return '<table>' +
      list +
      '<tr>' +
        '<td' + attr + '>' + total + ' Contexts found</td>' +
        '<td><button id="contexts-add" data-tip="Add Context" data-pos="left" icon primary><i>add</i></button></td>' +
      '</tr>' +
    '</table>';
}

/*
// Build table from data
function table(name, data) {
  var table = '';

  var head = '';
  var body = '';

  for (const id in data) {
    const value = data[id];

    if (typeof value !== 'object') {
      head += '<th>' + id + '</th>';
      body += '<td>' + sanitize(value) + '</td>';
    }
  }

  if (head !== '') {
    table =
      '<h2>' + name + '</h2>' +
      '<table>' +
        '<tr>' + head + '</tr>' +
        '<tr>' + body + '</tr>' +
      '</table>';
  }
  return table;
}

// Get total count
function total(data, label) {
  const count = Object.keys(data).length;
  const text = count + ' ' + label;

  return (count > 0)?text:('<span error>' + text + '</span>');
}
*/

// Capitalize text value
//function capitalize(value) {
//  return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
//}

// Sanitize text value
function sanitize(value) {
  return (value === undefined)?'-':value;
}

// Escape html characters
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// Socket connection

// Connect to host
function connect(e) {
  // Closed ok?
  if (e !== undefined && e.wasClean) return;

  // Disconnect current
  disconnect();

  // Listen for new
  text('#offline footer', 'Connecting...');
  setTimeout(listen, WAIT);
}

// Listen for connection
function listen() {
  try {
    // Create socket
    socket = new WebSocket('ws://' + location.host);

    // Set handlers
    socket.onopen = establish;
    socket.onmessage = receive;
    socket.onclose = connect;
    socket.onerror = broken;
  } catch(e) {
    // Failure
    broken(e);
  }
}

// Connection established
function establish(e) {
  // Now online
  hidden('#offline', true);
  hidden('#online', false);
}

// Receive from host
function receive(packet) {
  // Convert data
  const changes = JSON.parse(packet.data);
  const response = changes.response;

console.log('received', changes);

  if (response !== undefined) {
    const res = escapeHtml(response);
    if (res !== '') html('#command-response', '<pre>' + res + '</pre>');

    return;
  }

  cache = changes;
  // Merge changes with current
//  if (cache === undefined) cache = {};
//  merge(cache, changes);

  // Update changes
  update();
}

// Send to host
function send(packet) {
  // Socket exists?
  if (socket === undefined ||
    socket.readyState !== WebSocket.OPEN)
    return;

  // Send packet
  socket.send(packet);
}

// Send command to host
function command(cmd) {
console.log('sending', cmd);

  // Create packet
  send(JSON.stringify({
    command: cmd
  }));
}

// Broken connection
function broken(e) {
  // Show error and disconnect
  text('#offline footer', 'Error: ' + e.message);
  disconnect();
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

// Close connection
function disconnect() {
  // Now offline
  hidden('#online', true);
  hidden('#offline', false);

  // Socket exists?
  if (socket !== undefined) {
    // Close it
    socket.close();
    socket = undefined;
  }

  // Clear cache
  reset();
}

// Clear node cache
function reset() {
  cache = undefined;
  update();
}

// Object functions

// Check object type
//function isObject(obj, type = 'Object') {
//  return Object.prototype.toString.call(obj) === '[object ' + type + ']';
//}

// Merge source into target
/*
function merge(target, source) {
  // Must be objects
  if (!isObject(target) || !isObject(source))
    return;

  // Merge source object
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      // Merging an object?
      if (isObject(source[key])) {
        // Create if missing?
        if (!isObject(target[key]))
          target[key] = {};

        // Merge objects
        merge(target[key], source[key]);
      } else {
        if (source[key] === null) delete target[key];
        else target[key] = source[key];
      }
    }
  }
}
*/


// Storage functions

// Set storage item value
function store(name, value) {
  if (value === undefined) remove(name);
  else window.localStorage.setItem(name, value);
}

// Get storage item value
function fetch(name, value) {
  const data = window.localStorage.getItem(name);
  return (data === null)?(value || null):data;
}

// Remove storage item value
function remove(name) {
  window.localStorage.removeItem(name);
}

// Dom functions

// Show or hide element
function hidden(selector, value) {
  return attribute(selector, 'hidden', state(value));
}

// Enable or disable element
function disabled(selector, value) {
  return attribute(selector, 'disabled', state(value));
}

// Selet or deselect element
function selected(selector, value) {
  return attribute(selector, 'selected', state(value));
}

// Get state attribute value
function state(value) {
  return (value !== undefined)?(value?'':null):value;
}

// Access element style
function style(selector, value) {
  return attribute(selector, 'style', value);
}

// Access element text
function text(selector, value) {
  return property(selector, 'textContent', value);
}

// Access element value
function value(selector, value) {
  return property(selector, 'value', value);
}

// Access element html
function html(selector, value) {
  return property(selector, 'innerHTML', value);
}

// Access element focus
function focus(selector) {
  // Get focus
  if (selector === undefined)
    return document.activeElement;

  // Get element
  const element = query(selector);
  if (element === null) return null;

  // Set focus
  element.focus();
}

// Access element attribute
function attribute(selector, name, value) {
  // Get element
  const element = query(selector);
  if (element === null) return null;

  // Get value
  if (value === undefined)
    return element.getAttribute(name);

  // Remove attribute
  if (value === null)
    return element.removeAttribute(name);

  // Set attribute
  element.setAttribute(name, value);
}

// Access element property
function property(selector, name, value) {
  // Get element
  const element = query(selector);
  if (element === null) return null;

  // Get property
  if (value === undefined)
    return element[name];

  // Set property
  element[name] = value;
}

// Run seletor query
function query(parent, selector, all = false) {
  // No parent?
  if (selector === undefined) {
    selector = parent;
    parent = document;
  }

  // Already found?
  if (typeof selector === 'object')
    return selector;

  // Get all?
  return all?
    parent.querySelectorAll(selector):
    parent.querySelector(selector);
}

// Query helper
function $(parent, selector) {
  return query(parent, selector);
}

// Query all helper
function $$(parent, selector) {
  return query(parent, selector, true);
}

// Bind event handlers

window.onload = init;
window.onunload = exit;

document.onclick = click;
document.onchange = change;
document.onsubmit = submit;

// Exports
// debug
return {
  get cache() {
    return cache;
  },
  toggle: toggle,
  attribute: attribute,
  reset: reset,
  command: command,
  $: $,
  $$: $$
};

}());
