// main.js - CNS Dashboard
// Copyright 2025 Padi, Inc. All Rights Reserved.

// user login
// add hilight attribute on change
// open if name = new something (also stick at top)
// do some help
// node search (contexts etc...) (add big list, then filter + expand)
// capability version change remove watch?

// Application

const app = (function() {

// Message icons

const INFO = 'info';
const WARN = 'warning';
const ERROR = 'error';

// Messages

const M_CONNECTED = 'Dashboard connected';
const M_DISCONNECTED = 'Dashboard disconnected';
const M_ONLINE = 'Network online';
const M_OFFLINE = 'Network offline';
const M_EXECUTE = 'Console command';
const M_COMMAND = 'Command error';

// Constants

const PALETTE = [
  '#66c5cc',
  '#f6cf71',
  '#f89c74',
  '#dcb0f2',
  '#87c55f',
  '#9eb9f3',
  '#fe88b1',
  '#b3b3b3'
];

const MAX_MESSAGES = 32;

// Local data

var client;

var descriptors;
var messages;
var expanded;

var dialog;

// Event handlers

// Handle app init
function oninit() {
  // Initialize
  messages = [];
  expanded = {};

  // Settings
  theme();
  compact();

  // Create client
  client = new cns.Client()
  // Client open
  .on('open', () => {
    // Switch to connected state
    message(INFO, M_CONNECTED);

    hidden('#disconnected', true);
    hidden('#connected', false);

    // Fetch profile descriptors
    getDescriptors();
  })
  // Client update
  .on('update', (data) => {
    // Update changes
    update(data);
  })
  // Client close
  .on('close', () => {
    // Switch to disconnected state
    message(ERROR, M_DISCONNECTED);

    hidden('#connected', true);
    hidden('#disconnected', false);

    // Close any dialogs
    close(false);

    // Back to connecting
    text('footer', 'Connecting...');
  })
  // Client error
  .on('error', (e) => {
    // Failure
    message(ERROR, e.message);
    text('footer', 'Error: ' + e.message);
  });
}

// Handle app exit
function onexit() {
  // Close client
  client.close();
}

// Handle key up
function onkeyup(e) {
  // Get target
  const element = target(e);
  if (element === null) return;

  const id = element.id;

  // Key where?
  switch (id) {
    case 'profiles-search':
      // Search profiles
      html('#profiles-list', listProfiles());
      break;
    case 'nodes-search':
      // Search nodes
      html('#nodes-list', listNodes());
      break;
    case 'keys-search':
      // Search keys
      html('#keys-list', listKeys());
      break;
  }
}

// Handle mouse click
function onclick(e) {
  // Focus input on label click
  if (tag(e.target) === 'label') {
    focus(e.target.nextElementSibling);
    return;
  }

  // Get target
  const element = target(e);
  if (element === null) return;

  const id = element.id;

  // Dialog ok?
  if (id.endsWith('-dialog-ok')) {
    close(true);
    return;
  }

  // Dialog close?
  if (id.endsWith('-dialog-cancel') ||
    id.endsWith('-dialog-close')) {
    close(false);
    return;
  }

  const key = attribute(element, 'data-key');
  const val = attribute(element, 'data-val');

  // Expand branch?
  if (id.endsWith('-expand')) {
    expand(element, key);
    return;
  }

  // Clicked what?
  switch (id) {
    case 'list':
      // Toggle menu
      compact(toggle('nav', 'list', 'collapse', 'expand'));
      break;
    case 'overview':
    case 'network':
    case 'profiles':
    case 'nodes':
    case 'keys':
    case 'console':
    case 'about':
      // Change view
      view(id);
      break;
    case 'theme':
      // Toggle theme
      theme(toggle('body', 'theme', 'light', 'dark'));
      break;
    case 'help':
      // Toggle help
      help();
      break;
    case 'messages-clear':
      // Message list
      message();
      break;
    case 'profiles-link':
      // View profile
      window.open(key);
      break;
    case 'profiles-install':
    case 'profiles-remove':
      // Profiles list
      install(element, key, val);
      break;
    case 'nodes-add':
    case 'nodes-remove':
      // Nodes list
      nodes(element, key, val);
      break;
    case 'contexts-add':
    case 'contexts-remove':
      // Contexts list
      contexts(element, key, val);
      break;
    case 'caps-add':
    case 'caps-remove':
      // Capability list
      capability(element, key, val);
      break;
    case 'emulators-add':
    case 'emulators-remove':
      // Emulation list
      emulator(element, key, val);
      break;
    case 'watchers-add':
    case 'watchers-remove':
      // Watch list
      watcher(element, key, val);
      break;
    case 'keys-add':
    case 'keys-remove':
      // Keys list
      keys(element, key, val);
      break;
  }
}

// Handle input change
function onchange(e) {
  // Get target
  const element = target(e);
  if (element === null) return;

  const id = element.id;

  const key = attribute(element, 'data-key');
  const val = value(element);

  // Changed what?
  switch (id) {
    case 'network-name':
    case 'network-orchestrator':
    case 'node-name':
    case 'node-upstream':
    case 'context-name':
    case 'cap-version':
    case 'cap-scope':
    case 'cap-default':
    case 'conn-property':
    case 'key-value':
      // Key change
      if (element.checkValidity())
        command('put', key, val);
      break;
    case 'caps-dialog-profile':
      // Caps profile change
      html('#caps-dialog-version', selectVersions(value('#caps-dialog-version'), val));
      break;
  }
}

// Handle form submit
function onsubmit(e) {
  // Get target
  const element = target(e);
  if (element === null) return;

  const id = element.id;

  // Submit what?
  switch (id) {
    case 'profiles-form':
      // Profiles search
      focus('#profiles-search');
      break;
    case 'nodes-form':
      // Nodes search
      focus('#nodes-search');
      break;
    case 'keys-form':
      // Keys search
      focus('#keys-search');
      break;
    case 'command-form':
      // Command execute
      const cmd = value('#command-line');
      if (cmd !== '') execute(cmd);

      value('#command-line', '');
      html('#command-response', '');

      focus('#command-line');
      break;
  }
  return false;
}

// User interface

// Set current theme
function theme(value) {
  if (value !== undefined) store('theme', value);
  else value = fetch('theme', 'light');

  attribute('body', 'theme', value);

  text('#theme i', (value === 'light')?'dark_mode':'light_mode');
  text('#theme span', (value === 'light')?'Dark Theme':'Light Theme');
}

// Set list compact type
function compact(value) {
  if (value !== undefined) store('nav', value);
  else value = fetch('nav', 'collapse');

  attribute('nav', 'list', value);

  text('#list i', (value === 'collapse')?'chevron_right':'chevron_left');
}

// Set current view
function view(value) {
  radio('nav button', 'selected', 'id', value);
  radio('section', 'hidden', 'view', value);

  focus('section[view="' + value + '"] input:first-of-type');
}

// Toggle help elements
function help() {
  const elements = $$('section aside:first-of-type');

  for (const element of elements)
    attribute(element, 'hidden', toggle(element, 'hidden', '', null));
}

// Expand tree branch
function expand(selector, key) {
  const element = selector.parentElement.parentElement.nextElementSibling;
  const state = toggle(element, 'hidden', '', null);

  if (state === null) expanded[key] = true;
  else delete expanded[key];

  attribute(element, 'hidden', state);
  text(selector.firstElementChild, isExpanded(key));
}

// Is branch expanded
function isExpanded(key) {
  return expanded[key]?'expand_more':'chevron_right';
}

// Is branch hidden
function isHidden(key) {
  return expanded[key]?'':' hidden';
}

// Is emulated
function isEmulator(value) {
  return (value === null)?'flash_on':'flash_off';
}

// Is watching
function isWatcher(value) {
  return (value === null)?'visibility':'visibility_off';
}

// Is option selected
function isSelected(value, selected) {
  return (value === selected)?' selected':'';
}

// Add overview message
function message(icon, text) {
  // Clear messages
  if (icon === undefined) {
    messages = [];
    html('#messages-list', '');
    return;
  }

  // Add new message
  messages.unshift({
    icon: icon,
    time: new Date(),
    text: text
  });

  // Keep to max
  if (messages.length > MAX_MESSAGES)
    messages.pop();

  // List messages
  html('#messages-list', listMessages());
}

// Update changes
function update(data) {
  const stats = client.stats;
  const isOnline = (stats.connection === 'online');

  // Stats changed?
  if (data.stats !== undefined) {
    // Connection state changed?
    if (data.stats.connection !== undefined) {
      // Remove dialogs
      if (!isOnline) close(false);

      const online = $$('[online]');
      const offline = $$('[offline]');

      for (const e of online)
        hidden(e, !isOnline);

      for (const e of offline)
        hidden(e, isOnline);

      message(isOnline?INFO:ERROR, isOnline?M_ONLINE:M_OFFLINE);
    }

    const started = stats.started?toDateTime(new Date(stats.started)):'-';

    const version = sanitize(client.version);
    const reads = sanitize(stats.reads);
    const writes = sanitize(stats.writes);
    const updates = sanitize(stats.updates);
    const errors = sanitize(stats.errors);

    const key = 'cns/network/name';

    const network = sanitize(client.get(key));
    const connection = isOnline?('<span data-key="' + key + '">' + network + '</span>'):'<span error>Offline</span>';

    const list =
      '<table>' +
        '<tr>' +
          '<th><i>home</i></th>' +
          '<th>Started</th>' +
          '<th>Version</th>' +
          '<th>Reads</th>' +
          '<th>Writes</th>' +
          '<th>Updates</th>' +
          '<th>Errors</th>' +
          '<th></th>' +
        '</tr>' +
        '<tr>' +
          '<td><i>info</i></td>' +
          '<td>' + started + '</td>' +
          '<td align="center">' + version + '</td>' +
          '<td align="center">' + reads + '</td>' +
          '<td align="center">' + writes + '</td>' +
          '<td align="center">' + updates + '</td>' +
          '<td align="center">' + errors + '</td>' +
          '<td></td>' +
        '</tr>' +
      '</table>';

    html('#overview-status', list);

    text('#version', version);
    html('footer', connection);
  }

  // Keys changed?
  if (data.keys !== undefined) {
    // Generate lists
    var list1 = '';
    var list2 = '';
    var list3 = '';
    var list4 = '';

    if (isOnline) {
      // Needs to rebuild?
      var rebuild = false;

      for (const key in data.keys) {
        // Key deleted?
        const change = data.keys[key];

        if (change === null) {
          rebuild = true;
          break;
        }

        // Capability version change?
        if (key.startsWith('cns/network/nodes/') && key.endsWith('/version')) {
          rebuild = true;
//          break;
        }

        // Element exists?
        const elements = $$('[data-key="' + key + '"]');

        if (elements.length === 0) {
          rebuild = true;
//          break;
        }

        // Update elements
        for (const element of elements) {
          // What type?
          switch (tag(element)) {
            case 'button':
              break;
            case 'input':
            case 'select':
              value(element, change);
              break;
            default:
              text(element, change);
              break;
          }
        }
      }

      // Rebuild lists?
      if (!rebuild) return;

      list1 = listWatchers();
      list2 = listProfiles();
      list3 = listNodes();
      list4 = listKeys();
    }

    // Keep focused element
    const element = focus();

    const key = element?attribute(element, 'data-key'):null;
    const focused = key?('[data-key="' + key + '"]'):undefined;

    // Update lists
    html('#watchers-list', list1);
    html('#profiles-list', list2);
    html('#nodes-list', list3);
    html('#keys-list', list4);

    // Re-focus
    if (focused) focus(focused);
  }
}

// Generate watchers list
function listWatchers() {
  var list = '';
  var total = 0;

  const watchers = client.select('cns/network/nodes/*/contexts/*/consumer/*/watch');
  const order = Object.keys(watchers).sort();

  for (const watcher of order) {
    const parts = watcher.split('/');

    const node = parts[3];
    const context = parts[5];
    const profile = parts[7];

    const watch = watchers[watcher];
    const from = watcher.replace('/watch', '');

    const ns = 'cns/network/nodes/' + node + '/contexts/' + context;
    const cs = ns + '/consumer/' + profile;

    const options = watch.split(':');

    const property = options[0];
    const display = options[1];

    const consumer = client.get(ns + '/name', context);

    const conns = client.select(cs + '/connections/*/provider');
    const order = Object.keys(conns).sort();

    for (const conn of order) {
      const parts = conn.split('/');

      parts.pop();
      parts.push('properties');
      parts.push(property);

      const style = ' style="border-color: ' + PALETTE[total % PALETTE.length] + ';"';

      const key = parts.join('/');
      const ps = conns[conn];

      const provider = client.get(ps + '/name', parts[5]);
      const value = client.get(key, property);

      list +=
        '<dd id="watchers-add" data-type="' + display + '" data-key="' + from + '" data-val="on"' + style + '>' +
          '<button id="watchers-remove" data-key="' + cs + '" data-val="off" icon primary><i>clear</i></button>' +
          '<h1 data-key="' + ns + '/name">' + consumer + '</h1>' +
          '<p data-key="' + key + '">' + value + '</p>' +
          '<h2 data-key="' + ps + '/name">' + provider + '</h2>' +
          '<h2>' + profile + '</h2>' +
        '</dd>';
    }
    total++;
  }

  if (total > 0) {
    const caption = '<caption>' + pluralize(total, 'Watcher', 'Watchers') + ' found</caption>';

    list =
      '<table>' +
        '<tr>' +
          '<th><i>visibility</i></th>' +
          '<th>Watchers</th>' +
          '<th></th>' +
        '</tr>' +
      '</table>' +
      '<dl>' +
        list +
      '</dl>' +
      '<table>' + caption + '</table>';
  }
  return list;
}

// Generate message list
function listMessages() {
  var list = '';
  var total = 0;

  for (const msg of messages) {
    const icon = msg.icon;
    const time = msg.time;
    const text = msg.text;

    list +=
      '<tr>' +
        '<td><i ' + icon + '>' + icon + '</i></td>' +
        '<td>' + toDateTime(time) + '</td>' +
        '<td>' + text + '</td>' +
        '<td></td>' +
      '</tr>';

    total++;
  }

  if (total > 0) {
    const clear = '<button id="messages-clear" data-tip="Clear Messages" data-pos="left" icon primary><i>clear</i></button>';
    const caption = '<caption>' + pluralize(total, 'Message', 'Messages') + ' found</caption>';

    list =
      '<table>' +
        '<tr>' +
          '<th><i>message</i></th>' +
          '<th>Time</th>' +
          '<th>Message</th>' +
          '<th>' + clear + '</th>' +
        '</tr>' +
        list +
        caption +
      '</table>';
  }
  return list;
}

// Generate profiles list
function listProfiles() {
  const ns = 'cns/network/profiles/';

  var list = '';
  var total = 0;

  const search = value('#profiles-search');
  const wildcard = '*' + search + '*';

  const profiles = {};

  // Add profile descriptors
  if (search !== '' && descriptors) {
    for (const id in descriptors) {
      const name = descriptors[id];

      if (match(id, wildcard) || match(name, wildcard)) {
        profiles[id] = {
          install: true,
          name: name
        };
      }
    }
  }

  // Add installed profiles
  const installed = client.select(ns + '*/name');

  for (const profile in installed) {
    const parts = profile.split('/');

    const id = parts[3];
    const name = installed[profile];

    if (match(id, wildcard) || match(name, wildcard)) {
      profiles[id] = {
        install: false,
        name: name
      };
    }
  }

  const order = Object.keys(profiles).sort();

  for (const id of order) {
    const profile = profiles[id];

    const install = profile.install;
    const name = profile.name;

    const key = ns + id;
    const readonly = install?' readonly':'';

    const expand = install?
      '<button id="profiles-link" data-key="https://cp.padi.io/profiles/' + id + '" data-tip="View Profile" data-pos="right" icon primary><i>link</i></button>':
      '<button id="profiles-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';

    const action = install?
      '<button id="profiles-install" data-val="' + id + '" data-tip="Install Profile" data-pos="left" icon primary><i>download</i></button>':
      '<button id="profiles-remove" data-key="' + key + '" data-val="' + id + '" data-tip="Remove Profile" data-pos="left" icon primary><i>delete</i></button>';

    list +=
      '<tr ' + readonly + '>' +
        '<td>' + expand + '</td>' +
        '<td>' + id + '</td>' +
        '<td' + (install?'':' data-key="' + key + '/name"') + '>' + name + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>';

    if (!install) {
      list +=
        '<tr expand' + isHidden(key) + '>' +
          '<td></td>' +
          '<td colspan="3">' +
            listVersions(id) +
          '</td>' +
        '</tr>';
    }
    total++;
  }

  const caption = '<caption>' + pluralize(total, 'Profile', 'Profiles') + ' found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>extension</i></th>' +
        '<th>Profile</th>' +
        '<th>Name</th>' +
        '<th></th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate profile versions
function listVersions(profile) {
  const ns = 'cns/network/profiles/' + profile + '/versions/';

  var list = '';
  var total = 0;

  const versions = client.select(ns + '*/name');
  const order = Object.keys(versions).sort();

  for (const version of order) {
    const parts = version.split('/');

    const id = parts[5];
    const name = versions[version];

    const key = ns + id;
    const expand = '<button id="versions-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + name + '</td>' +
        '<td></td>' +
      '</tr>' +
      '<tr expand' + isHidden(key) + '>' +
        '<td></td>' +
        '<td colspan="2">' +
          listProperties(profile, id) +
        '</td>' +
      '</tr>';

    total++;
  }

  const caption = '<caption>' + pluralize(total, 'Version', 'Versions') + ' found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>style</i></th>' +
        '<th>Version</th>' +
        '<th></th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate profile properties
function listProperties(profile, version) {
  const ns = 'cns/network/profiles/' + profile + '/versions/' + version + '/properties/';

  var list = '';
  var total = 0;

  const properties = client.select(ns + '*/name');
  const order = Object.keys(properties).sort();

  for (const property of order) {
    const parts = property.split('/');

    const id = parts[7];
    const name = properties[property];

    const key = ns + id;

    const provider = client.get(key + '/provider', 'no');
    const required = client.get(key + '/required', 'no');
    const propagate = client.get(key + '/propagate', 'no');

    list +=
      '<tr>' +
        '<td><i>label</i></td>' +
        '<td>' + id + '</td>' +
        '<td data-key="' + key + '/name">' + name + '</td>' +
        '<td data-key="' + key + '/provider" align="center" capitalize>' + provider + '</td>' +
        '<td data-key="' + key + '/required" align="center" capitalize>' + required + '</td>' +
        '<td data-key="' + key + '/propagate" align="center" capitalize>' + propagate + '</td>' +
        '<td></td>' +
      '</tr>';

    total++;
  }

  const caption = '<caption>' + pluralize(total, 'Property', 'Properties') + ' found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>dataset</i></th>' +
        '<th>Property</th>' +
        '<th>Name</th>' +
        '<th>Provider</th>' +
        '<th>Required</th>' +
        '<th>Propagate</th>' +
        '<th></th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate nodes list
function listNodes() {
  const ns = 'cns/network/nodes/';

  var list = '';
  var total = 0;

  const search = value('#nodes-search');
  const wildcard = '*' + search + '*';

  const nodes = client.select(ns + '*/name');
  const order = Object.keys(nodes).sort();

  for (const node of order) {
    const parts = node.split('/');

    const id = parts[3];
    const name = nodes[node];

    if (match(id, wildcard) || match(name, wildcard)) {
      const key = ns + id;

      const expand = '<button id="nodes-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
      const action = '<button id="nodes-remove" data-key="' + key + '" data-val="' + id + '" data-tip="Remove Node" data-pos="left" icon primary><i>delete</i></button>';

      const upstream = client.get(key + '/upstream', 'no');
      const token = client.get(key + '/token', '');

      list +=
        '<tr>' +
          '<td>' + expand + '</td>' +
          '<td>' + id + '</td>' +
          '<td data-key="' + key + '/name">' + name + '</td>' +
          '<td data-key="' + key + '/upstream" align="center" capitalize>' + upstream + '</td>' +
          '<td>' + action + '</td>' +
        '</tr>' +
        '<tr expand' + isHidden(key) + '>' +
          '<td></td>' +
          '<td colspan="4">' +
            '<form id="node-form">' +
              '<label>Node name</label>' +
              '<input id="node-name" type="text" value="' + name + '" maxlength="128" data-key="' + key + '/name" placeholder="New Node"/>' +
              '<label>Node upstream</label>' +
              '<select id="node-upstream" data-key="' + key + '/upstream">' +
                '<option value="yes"' + isSelected(upstream, 'yes') + '>Yes</option>' +
                '<option value="no"' + isSelected(upstream, 'no') + '>No</option>' +
              '</select>' +
              '<label>Node token</label>' +
              '<input id="node-token" type="text" value="' + token + '" maxlength="128" data-key="' + key + '/token" placeholder="" readonly/>' +
            '</form>' +
            listContexts(id) +
          '</td>' +
        '</tr>';

      total++;
    }
  }

  const add = '<button id="nodes-add" data-tip="Add Node" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + pluralize(total, 'Node', 'Nodes') + ' found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>real_estate_agent</i></th>' +
        '<th>Node</th>' +
        '<th>Name</th>' +
        '<th>Upstream</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate contexts list
function listContexts(node) {
  const ns = 'cns/network/nodes/' + node + '/contexts/';

  var list = '';
  var total = 0;

  const contexts = client.select(ns + '*/name');
  const order = Object.keys(contexts).sort();

  for (const context of order) {
    const parts = context.split('/');

    const id = parts[5];
    const name = contexts[context];

    const key = ns + id;

    const expand = '<button id="contexts-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
    const action = '<button id="contexts-remove" data-key="' + key + '" data-val="' + id + '" data-tip="Remove Context" data-pos="left" icon primary><i>delete</i></button>';

    const token = client.get(key + '/token', '');

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + id + '</td>' +
        '<td data-key="' + key + '/name">' + name + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>' +
      '<tr expand' + isHidden(key) + '>' +
        '<td></td>' +
        '<td colspan="3">' +
          '<form id="context-form">' +
            '<label>Context name</label>' +
            '<input id="context-name" type="text" value="' + name + '" maxlength="128" data-key="' + key + '/name" placeholder="New Context"/>' +
            '<label>Context token</label>' +
            '<input id="context-token" type="text" value="' + token + '" maxlength="128" data-key="' + key + '/token" placeholder="" readonly/>' +
          '</form>' +
          listCaps(node, id) +
        '</td>' +
      '</tr>';

    total++;
  }

  const add = '<button id="contexts-add" data-val="' + node + '" data-tip="Add Context" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + pluralize(total, 'Context', 'Contexts') + ' found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>sensor_door</i></th>' +
        '<th>Context</th>' +
        '<th>Name</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate capability list
function listCaps(node, context) {
  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/';

  var list = '';
  var total = 0;

  const caps = client.select(ns + '*/*/version');

  for (const cap in caps) {
    const parts = cap.split('/');

    const role = parts[6];
    const id = parts[7];
    const version = caps[cap];

    const key = ns + role + '/' + id;

    const expand = '<button id="caps-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
    const action = '<button id="caps-remove" data-key="' + key + '" data-val="' + id + '" data-tip="Remove Capability" data-pos="left" icon primary><i>delete</i></button>';

    const scope = client.get(key + '/scope', '');

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td capitalize>' + role + '</td>' +
        '<td>' + id + '</td>' +
        '<td data-key="' + key + '/version" align="center">' + version + '</td>' +
        '<td data-key="' + key + '/scope">' + scope + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>' +
      '<tr expand' + isHidden(key) + '>' +
        '<td></td>' +
        '<td colspan="5">' +
          '<form id="cap-form">' +
            '<label>Capability version</label>' +
            '<select id="cap-version" value="' + version + '" data-key="' + key + '/version">' +
              selectVersions(version, id) +
            '</select>' +
            '<label>Capability scope</label>' +
            '<input id="cap-scope" type="text" value="' + scope + '" maxlength="128" data-key="' + key + '/scope" placeholder=""/>' +
            formDefaults(node, context, role, id, version) +
          '</form>' +
          listConns(node, context, role, id, version) +
        '</td>' +
      '</tr>';

    total++;
  }

  const add = '<button id="caps-add" data-val="' + node + ':' + context + '" data-tip="Add Capability" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + pluralize(total, 'Capability', 'Capabilities') + ' found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>outlet</i></th>' +
        '<th>Capability</th>' +
        '<th>Profile</th>' +
        '<th>Version</th>' +
        '<th>Scope</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate connections list
function listConns(node, context, role, profile, version) {
  const ps = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile;
  const ns = ps + '/connections/';

  var list = '';
  var total = 0;

  const anti = (role === 'provider')?'consumer':'provider';
  const conns = client.select(ns + '*/' + anti);

  for (const conn in conns) {
    const parts = conn.split('/');

    const id = parts[9];
    const other = conns[conn] || '';
    const name = client.get(other + '/name', '');

    const otherParts = other.split('/');
    const otherNode = otherParts[3] || '';
    const otherContext = otherParts[5] || '';

    const key = ns + id;
    const otherKey = 'cns/network/nodes/' + otherNode + '/contexts/' + otherContext;

    const expand = '<button id="conns-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + id + '</td>' +
        '<td>' + otherNode + '</td>' +
        '<td>' + otherContext + '</td>' +
        '<td data-key="' + otherKey + '/name">' + name + '</td>' +
        '<td></td>' +
      '</tr>' +
      '<tr expand' + isHidden(key) + '>' +
        formProperties(node, context, role, profile, version, id) +
      '</tr>';

    total++;
  }

  const emulate = client.get(ps + '/emulate');
  const watch = client.get(ps + '/watch');

  const emulator = '<button id="emulators-add" data-key="' + ps + '" data-val="' + (emulate?'off':'on') + '" data-tip="Emulate Capability" data-pos="left" icon primary><i>' + isEmulator(emulate) + '</i></button>';
  const watcher = '<button id="watchers-add" data-key="' + ps + '" data-val="' + (watch?'off':'on') + '" data-tip="Watch Capability" data-pos="left" icon primary><i>' + isWatcher(watch) + '</i></button>';

  const caption = '<caption>' + pluralize(total, 'Connection', 'Connections') + ' found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>power</i></th>' +
        '<th>Connection</th>' +
        '<th>Node</th>' +
        '<th>Context</th>' +
        '<th>Name</th>' +
        '<th>' + ((role === 'provider')?emulator:watcher) + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate keys list
function listKeys() {
  var list = '';
  var total = 0;

  var keys = client.keys;
  var wildcard;

  const search = value('#keys-search');

  if (search !== '') {
    if (search.includes('*'))
      keys = client.select(search);
    else wildcard = '*' + search + '*';
  }

  const order = Object.keys(keys).sort();

  for (const key of order) {
    if (key.startsWith('cns/network/profiles/')) continue;

    const parts = key.split('/');
    const value = keys[key];

    if (!wildcard || match(key, wildcard) || match(value, wildcard)) {
      const id = parts[parts.length - 1];

      const expand = '<button id="keys-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
      const action = '<button id="keys-remove" data-key="' + key + '" data-val="' + id + '" data-tip="Remove Key" data-pos="left" icon primary><i>delete</i></button>';

      list +=
        '<tr>' +
          '<td>' + expand + '</td>' +
          '<td>' + key + '</td>' +
          '<td>' + action + '</td>' +
        '</tr>' +
        '<tr expand' + isHidden(key) + '>' +
          '<td></td>' +
          '<td colspan="2">' +
            '<form id="node-form">' +
              '<label>Key value</label>' +
              '<input id="key-value" type="text" value="' + value + '" data-key="' + key + '" placeholder=""/>' +
            '</form>' +
          '</td>' +
        '</tr>';

      total++;
    }
  }

  const add = '<button id="keys-add" data-tip="Add Key" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + pluralize(total, 'Key', 'Keys') + ' found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>dns</i></th>' +
        '<th>Key</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate defaults form
function formDefaults(node, context, role, profile, version) {
  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/properties/';
  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/';

  var form = '';

  const properties = client.select(ps + '*/name');
  const order = Object.keys(properties).sort();

  for (const property of order) {
    const parts = property.split('/');

    const id = parts[7];
    const name = properties[property];

    const provider = client.get(ps + id + '/provider', '');

    switch (role) {
      case 'provider': if (provider !== 'yes') continue; break;
      case 'consumer': if (provider !== 'no') continue; break;
    }

    const key = ns + id;
    const value = client.get(key, '');

    form +=
      '<label>Capability ' + id + '</label>' +
      '<input id="cap-default" type="text" value="' + value + '" data-key="' + key + '" placeholder="' + name + '"/>';
  }
  return form;
}
// combine these two
// Generate properties form
function formProperties(node, context, role, profile, version, conn) {
  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/connections/' + conn + '/properties/';
  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/';

  var form = '';

  const properties = client.select(ps + '*/name');
  const order = Object.keys(properties).sort();

  for (const property of order) {
    const parts = property.split('/');

    const id = parts[7];
    const name = properties[property];

    const provider = client.get(ps + id + '/provider', '');
    var readonly = '';

    switch (role) {
      case 'provider': if (provider !== 'yes') readonly = ' readonly'; break;
      case 'consumer': if (provider !== 'no') readonly = ' readonly'; break;
    }

    const key = ns + id;
    const value = client.get(key, '');

    form +=
      '<label>Connection ' + id + '</label>' +
      '<input id="conn-property" type="text" value="' + value + '" data-key="' + key + '" placeholder="' + name + '"' + readonly + '/>';
  }

  if (form !== '') {
    form =
      '<td></td>' +
      '<td colspan="5">' +
      '<form id="conn-form">' +
        form +
      '</form>' +
      '</td>';
  }
  return form;
}

// Set profile select items
function selectProfiles(current) {
  var options = '';

  const profiles = client.select('cns/network/profiles/*/name');
  const order = Object.keys(profiles).sort();

  for (const profile of order) {
    const parts = profile.split('/');
    const id = parts[3];

    const selected = ((current === '' && options === '') || id === current)?' selected':'';
    options += '<option value="' + id + '"' + selected + '>' + id + '</option>';
  }
  return options;
}

// Set version select items
function selectVersions(current, profile) {
  var options = '';

  const versions = client.select('cns/network/profiles/' + profile + '/versions/*/name');
  const order = Object.keys(versions).sort();

  for (const version of order) {
    const parts = version.split('/');
    const id = parts[5].replace('version', '');

    const selected = ((current === '' && options === '') || id === current)?' selected':'';
    options += '<option value="' + id + '"' + selected + '>' + id + '</option>';
  }
  return options;
}

// Set property select items
function selectProperties(current, key) {
  const parts = key.split('/');

  const profile = parts[7];
  const version = client.get(key + '/version');

  var options = '';

  const properties = client.select('cns/network/profiles/' + profile + '/versions/version' + version + '/properties/*/name');
  const order = Object.keys(properties).sort();

  for (const property of order) {
    const parts = property.split('/');
    const id = parts[7];

    const selected = ((current === '' && options === '') || id === current)?' selected':'';
    options += '<option value="' + id + '"' + selected + '>' + id + '</option>';
  }
  return options;
}

// Show install dialog
function install(element, key, val) {
  // Remove profile
  if (key) return purge(element, 'Profile', key, val);

  // Confirm install
  return confirm('About To Install Profile', val)
  .then((result) => {
    // Confirmed?
    if (result) {
      disabled(element, true);
      return command('profiles', '-i', val);
    }
  });
}

// Show nodes dialog
function nodes(element, key, val) {
  // Remove node
  if (key) return purge(element, 'Node', key, val);

  // Show dialog
  return show('#nodes-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const id = value('#nodes-dialog-id') || '$new';
      return command('nodes', id);
    }
  });
}

// Show contexts dialog
function contexts(element, key, val) {
  // Remove context
  if (key) return purge(element, 'Context', key, val);

  // Show dialog
  return show('#contexts-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const id = value('#contexts-dialog-id') || '$new';
      return command('contexts', val, id);
    }
  });
}

// Show capability dialog
function capability(element, key, val) {
  // Remove capability
  if (key) return purge(element, 'Capability', key, val);

  // Fill profiles list
  html('#caps-dialog-profile', selectProfiles(value('#caps-dialog-profile')));
  html('#caps-dialog-version', selectVersions(value('#caps-dialog-version'), value('#caps-dialog-profile')));

  // Show dialog
  return show('#caps-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const parts = val.split(':');

      const node = parts[0];
      const context = parts[1];

      const role = value('#caps-dialog-role');
      const profile = value('#caps-dialog-profile');
      const version = value('#caps-dialog-version');
      const scope = value('#caps-dialog-scope');

      return command(role, node, context, profile, version, scope);
    }
  });
}

// Show enumation dialog
function emulator(element, key, val) {
  // Remove emulator?
  if (val === 'off') return command('del', key + '/emulate');

  // Add emulator
  return command('put', key + '/emulate', 'on');
}

// Show watchers dialog
function watcher(element, key, val) {
  // Remove watcher?
  if (val === 'off') return command('del', key + '/watch');

  // Fill properties list
  const watch = client.get(key + '/watch', '');
  const parts = watch.split(':');

  const property = parts[0];
  const display = parts[1];

  html('#watcher-dialog-property', selectProperties(property, key));
  value('#watcher-dialog-display', display);

  // Show dialog
  return show('#watcher-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const property = value('#watcher-dialog-property');
      const display = value('#watcher-dialog-display');

      return command('put', key + '/watch', property + ':' + display);
    }
    return null;
  })
  .then((result) => {
    html('#watchers-list', listWatchers());
  });
}

// Show key dialog
function keys(element, key, val) {
  // Remove key?
  if (key) return purge(element, 'Key', key, val);

  // Show dialog
  return show('#keys-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const key = value('#keys-dialog-key');
      const val = value('#keys-dialog-value');

      return command('put', key, val);
    }
  });
}

// Show purge dialog
function purge(element, type, key, val) {
  // Confirm action
  return confirm('About To Remove ' + type, val)
  .then((result) => {
    // Confirmed?
    if (result) {
      disabled(element, true);
      return command('purge', key);
    }
  });
}

// Show confirm dialog
function confirm(prompt, val) {
  text('#confirm-dialog h1 span', prompt);
  text('#confirm-dialog p', val);

  return show('#confirm-dialog');
}

// Show dialog
function show(selector) {
  // Get element
  const element = query(selector);

  if (element === null)
    return Promise.resolve(false);

  element.showModal();

  // I promise to
  return new Promise((resolve, reject) => {
    dialog = {
      element: element,
      resolve: resolve,
      reject: reject
    };
  });
}

// Close dialog
function close(result) {
  if (dialog) {
    // Check form valid
    if (result) {
      const form = $(dialog.element, 'form');
      if (!form.checkValidity()) return;
    }

    // Resolve promise
    dialog.element.close(result);
    dialog.resolve(result);

    dialog = undefined;
  }
}

// Execute console command
async function execute(cmd) {
  message(INFO, M_EXECUTE + ': ' + cmd);

  const packet = await client.execute(cmd);

  const format = packet.format;
  const response = packet.response;

  var text = response;

  if (format === 'json')
      text = JSON.stringify(text, null, 2);

  text = escapeHtml(text);

  if (text !== '') html('#command-response', '<pre>' + text + '</pre>');
}

// Transmit command to host
async function command(cmd, ...args) {
  const packet = await client.command(cmd, ...args);

  const format = packet.format;
  const response = packet.response;

  if (response.error)
    message(ERROR, M_COMMAND + ': ' + response.error);

  return packet.response;
}

// Get profile descriptors
async function getDescriptors() {
  // Already fetched?
  if (descriptors !== undefined) return;

  descriptors = {};

  const response = await command('profiles', '-i');
  descriptors = response.descriptors;

  html('#profiles-list', listProfiles());
}

// String functions

// Sanitize text value
function sanitize(value) {
  return (value === null || value === undefined)?'-':value;
}

// Pluralize numeric value
function pluralize(value, singular, plural) {
  return value + ' ' + ((value === 1)?singular:plural);
}

// Escape html characters
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// Wildcard match
function match(value, filter) {
  const esc = (s) => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
  return new RegExp('^' + filter.split('*').map(esc).join('.*') + '$', 'i').test(value);
}

// Date functions

// Formatted date
function toDate(date) {
  const day = date.getDate();
  const month = date.toLocaleString('en-us', {month: 'long'});
  const year = date.getFullYear();

  return day + ' ' + month + ' ' + year;
}

// Formatted time
function toTime(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();

  const am = (hours <= 12);
  if (!am) hours -= 12;

  if (minutes < 10) minutes = '0' + minutes;
  if (seconds < 10) seconds = '0' + seconds;

  return hours + ':' + minutes + (am?'am':'pm');
}

// Formatted date and time
function toDateTime(date) {
  return toDate(date) + ' at ' + toTime(date);
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

// Get element tag name
function tag(selector) {
  return property(selector, 'tagName').toLowerCase();
}

// Access element focus
function focus(selector) {
  // Get focus?
  if (selector === undefined)
    return document.activeElement;

  // Get element
  const element = query(selector);
  if (element === null) return null;

  // Set focus
  element.focus({
    preventScroll: true
  });

  // Move cursor to end
  if (tag(element) === 'input') {
    const len = element.value.length;

    element.selectionStart = len;
    element.selectionEnd = len;
  }
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

window.onload = oninit;
window.onunload = onexit;

document.onkeyup = onkeyup;
document.onclick = onclick;
document.onchange = onchange;
document.onsubmit = onsubmit;

/*
// Exports
// debug
return {
  focus: focus,
  toggle: toggle,
  attribute: attribute,
  command: command,
  $: $,
  $$: $$
};
*/

}());
