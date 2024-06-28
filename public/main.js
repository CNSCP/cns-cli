// main.js - CNS Dashboard
// Copyright 2024 Padi, Inc. All Rights Reserved.

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
  const parts = target(e).split('-');

  const name = parts[0];
  const id = parts[1];

  switch (name) {
    case 'list':
      setList(toggle('#online nav', 'list', 'collapse', 'expand'));
      break;
    case 'overview':
    case 'contexts':
    case 'apps':
    case 'config':
    case 'about':
      setView(name);
      break;
    case 'theme':
      setTheme(toggle('body', 'theme', 'light', 'dark'));
      break;
/*
    case 'context':
      setView('capabilities');
      break;
    case 'capability':
      setView('connections');
      break;
    case 'properties':
      setView('properties');
      break;
*/
  }
}

// Handle form submit
function submit(e) {
  const id = target(e);

  switch (id) {
    case 'profiles-form':
      const name = value('#profile');
      if (name === '')
        focus('#profile');
      else {
        command('profile ' + name);
        value('#profile', '');
      }
      break;
    case 'command-form':
      const cmd = value('#command');
      if (cmd === '')
        focus('#command');
      else {
        command(cmd);
        value('#command', '');
      }
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
  text('#list span', '');
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

  // Valid if has id
  while (element !== null && element.id === '')
   element = element.parentElement;

  return (element === null)?null:element.id;
}

// Toggle attribute
function toggle(selector, attr, on, off) {
  return (attribute(selector, attr) === on)?off:on;
}

// Radio attribute
function radio(selector, attr, name, value) {
  const elements = $$(selector);

  for (const e of elements) {
    const id = attribute(e, name);

    switch (attr) {
      case 'selected':
        selected(e, (id === value));
        break;
      case 'hidden':
        hidden(e, (id !== value));
        break;
    }
  }
}

// Update with changes
function update(changes) {
  const root = cache || {};

  const node = root.node || {};
  const status = node.status || {};
  const contexts = node.contexts || {};
  const profiles = root.profiles || {};

  var state = status.connection || 'offline';

  if (state === 'offline')
    state = '<span error>offline</span>';

  var list1 = '';
  var list2 = '';
  var list3 = '';
  var list4 = '';
  var list5 = '';
  var list6 = '';
  var list7 = '';
  var list8 = '';

  var results = '';

  list1 =
    '<tr>' +
      '<td>' + sanitize(node.version) + '</td>' +
      '<td>' + sanitize(node.broker) + '</td>' +
      '<td>' + sanitize(status.started) + '</td>' +
      '<td>' + sanitize(status.reads) + '</td>' +
      '<td>' + sanitize(status.writes) + '</td>' +
      '<td>' + sanitize(status.updates) + '</td>' +
      '<td>' + sanitize(status.errors) + '</td>' +
      '<td>' + state + '</td>' +
    '</tr>';

  if (state === 'online') {
    list3 =
      '<tr>' +
        '<td style="width:100%">node</td>' +
        '<td align="right">' + total(contexts, 'Contexts') + '</td>' +
      '</tr>';

    for (const id in contexts) {
      const context = contexts[id];
      const caps = context.capabilities || {};

      list3 +=
        '<tr>' +
          '<td indent="1">' + context.name + '</td>' +
          '<td align="right"><pre>' + id + '</pre></td>' +
        '</tr>';

      list4 +=
        '<tr>' +
          '<td>' + context.name + '</td>' +
          '<td>' + context.title + '</td>' +
          '<td>' + context.comment + '</td>' +
          '<td><pre>' + id + '</pre></td>' +
          '<td align="right">' +
//              '<button icon><i>edit</i></button>' +
//              '<button id="context-' + id + '" icon><i>chevron_right</i></button>' +
          '</td>' +
        '</tr>';

      for (const name in caps) {
        const cap = caps[name];
        const conns = cap.connections;

        list3 +=
          '<tr>' +
            '<td indent="2">' + name + '</td>' +
            '<td align="right">' + total(conns, 'Connections') + '</td>' +
          '</tr>';

        list5 +=
          '<tr>' +
            '<td>' + name + '</td>' +
            '<td>' + cap.scope + '</td>' +
            '<td>' + cap.required + '</td>' +
            '<td align="right">' +
              '<button icon><i>delete</i></button>' +
              '<button icon><i>edit</i></button>' +
              '<button id="capability-' + name + '" icon><i>chevron_right</i></button>' +
            '</td>' +
          '</tr>';

        for (const id in conns) {
          const con = conns[id];
          const props = con.properties;

          list3 +=
            '<tr>' +
              '<td indent="3">' + con.consumer + '</td>' +
              '<td align="right"><pre>' + id + '</pre></td>' +
            '</tr>';

          list6 +=
            '<tr>' +
              '<td>' + con.provider + '</td>' +
              '<td>' + con.consumer + '</td>' +
              '<td>' + con.status + '</td>' +
              '<td><pre>' + id + '</pre></td>' +
              '<td align="right">' +
                '<button icon><i>edit</i></button>' +
                '<button id="properties-' + id + '" icon><i>chevron_right</i></button>' +
              '</td>' +
            '</tr>';

          for (const name in props) {
            const value = props[name];

            list7 +=
              '<label>' + name + '</label>' +
              '<input type="text" value="' + value + '"/>';
          }
        }
      }
    }

    for (const name in profiles) {
      const profile = profiles[name];
      const url = profile.definition;

      list8 +=
        '<tr>' +
          '<td>' + name + '</td>' +
          '<td>' + profile.title + '</td>' +
          '<td>' + profile.comment + '</td>' +
          '<td><a href="' + url + '" target="_blank">' + url + '</a></td>' +
        '</tr>';
    }
  }

    //
    /*
    for (const name in cache) {
      if (name !== 'node') {
        const item = cache[name];

        if (typeof item === 'object')
          list2 += table(name, item);
      }
    }
    */

    text('#version', sanitize(root.version));
    text('#path', sanitize(root.pwd));
//  }

  if (changes !== undefined)
    results = JSON.stringify(changes, null, 2);

  if (list1 !== '') {
    list1 =
      '<h2>Status</h2>' +
      '<table>' +
        '<tr>' +
          '<th>Version</th>' +
          '<th>Broker</th>' +
          '<th>Started</th>' +
          '<th>Reads</th>' +
          '<th>Writes</th>' +
          '<th>Updates</th>' +
          '<th>Errors</th>' +
          '<th>Connection</th>' +
        '</tr>' +
        list1 +
      '</table>';
  }

  if (list3 !== '') {
    list3 =
      '<h2>Map</h2>' +
      '<table>' +
        list3 +
      '</table>';
  }

  if (list4 !== '') {
    list4 =
      '<h2>Contexts</h2>' +
      '<table>' +
        '<tr>' +
          '<th>Name</th>' +
          '<th>Title</th>' +
          '<th>Comment</th>' +
          '<th>Context ID</th>' +
          '<th></th>' +
        '</tr>' +
        list4 +
      '</table>';
  }

  if (list5 !== '') {
    list5 =
      '<h2>' +
        '<button id="contexts" ripple>Contexts</button>' +
        'Capabilities' +
      '</h2>' +
      '<table>' +
        '<tr>' +
          '<th>Name</th>' +
          '<th>Scope</th>' +
          '<th>Required</th>' +
          '<th></th>' +
        '</tr>' +
        list5 +
      '</table>';
  }

  if (list6 !== '') {
    list6 =
      '<h2>' +
        '<button id="contexts" ripple>Contexts</button>' +
        '<button id="capability" ripple>Capabilities</button>' +
        'Connections' +
      '</h2>' +
      '<table>' +
        '<tr>' +
          '<th>Provider</th>' +
          '<th>Consumer</th>' +
          '<th>Status</th>' +
          '<th>Connection ID</th>' +
          '<th></th>' +
        '</tr>' +
        list6 +
      '</table>';
  }

  if (list7 !== '') {
    list7 =
      '<h2>' +
        '<button id="contexts" ripple>Contexts</button>' +
        '<button id="capabilities" ripple>Capabilities</button>' +
        '<button id="connections" ripple>Connections</button>' +
        'Properties' +
      '</h2>' +
      '<form id="crap-form">' +
        list7 +
      '</form>';
  }

  if (list8 !== '') {
    list8 =
      '<h2>Found</h2>' +
      '<table>' +
        '<tr>' +
          '<th>Name</th>' +
          '<th>Title</th>' +
          '<th>Comment</th>' +
          '<th>Definition</th>' +
        '</tr>' +
        list8 +
      '</table>';
  }

  if (results !== '') {
    results =
      '<h2>Result</h2>' +
      '<aside>' +
        '<pre>' + results + '</pre>' +
      '</aside>';
  }

  html('section[view="overview"] div', list1 + list2 + list3);
  html('section[view="contexts"] div', list4);
  html('section[view="capabilities"] div', list5);
  html('section[view="connections"] div', list6);
  html('section[view="properties"] div', list7);
  html('section[view="profiles"] div', list8);

  html('section[view="config"]:not([hidden]) div', results);
}

// Clear node cache
function reset() {
  cache = undefined;
  update();
}

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

// Capitalize text value
function capitalize(value) {
  return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

// Sanitize text value
function sanitize(value) {
  return (value === undefined)?'-':value;
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

  command('version; pwd; get /node');
}

// Receive from host
function receive(packet) {
  // Convert data
  const changes = JSON.parse(packet.data);

  // Merge changes with current
  if (cache === undefined) cache = {};
  merge(cache, changes);

  // Update changes
  update(changes);
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

// Object functions

// Check object type
function isObject(obj, type = 'Object') {
  return Object.prototype.toString.call(obj) === '[object ' + type + ']';
}

// Merge source into target
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

onload = init;
onunload = exit;

onclick = click;
onsubmit = submit;

// Exports

return {
  get cache() {
    return cache;
  },
  reset: reset,
  command: command,
  $: $,
  $$: $$
};

}());
