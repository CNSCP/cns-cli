// main.js - CNS Dashboard
// Copyright 2025 Padi, Inc. All Rights Reserved.

// open if name = new something
// caps dialog / list version drop down
// cancel dialog on disconnect

// Application

const app = (function() {

// Constants

const WAIT = 500;

// Local data

var socket;
var cache;
var messages;

var expanded;
var focused;

var dialog;

// Event handlers

// Handle app init
function init() {
  // Initialize
  messages = [];
  expanded = {};

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

// Handle focus
function focusin(e) {
  const element = focus();
  if (!element) return;

  const key = attribute(element, 'data-key');
  focused = key?('[data-key="' + key + '"]'):undefined;   // elsewhere?

//  console.log('focus', focus().id);
}

// Handle click
function click(e) {
  // Focus input on label click
  if (e.target.tagName === 'LABEL') {
    focus(e.target.nextElementSibling);
    return;
  }

  // Get target
  const element = target(e);
  if (element === null) return;

  const id = element.id;

  const val = value(element);
  const key = attribute(element, 'data-key');

focused = key?('[data-key="' + key + '"]'):undefined;   // elsewhere?

console.log('clicked', id, val, key, focused);

  // Clicked what?
  switch (id) {
    case 'list':
      // Toggle menu
      setList(toggle('nav', 'list', 'collapse', 'expand'));
      break;
    case 'overview':
    case 'config':
    case 'network':
    case 'profiles':
    case 'nodes':
    case 'keys':
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
      setHelp(element);
      break;
    case 'profiles-expand':
    case 'versions-expand':
    case 'properties-expand':
    case 'nodes-expand':
    case 'contexts-expand':
    case 'caps-expand':
    case 'conns-expand':
    case 'keys-expand':
      // Expand list
      expand(element, key);
      break;
    case 'profiles-view':
      // View profile
      window.open(key);
      break;
    case 'profiles-install':
      // Install profile
      install(element, val, key);
      break;
    case 'profiles-add':
      // Add profile
      profiles();
      break;
    case 'profiles-remove':
      // Remove profile
      purge(element, 'Profile', val, key);
      break;
    case 'versions-add':
      // Add version
      versions(key);
      break;
    case 'versions-remove':
      // Remove version
      purge(element, 'Version', val, key);
      break;
    case 'properties-add':
      // Add version property
      properties(val, key);
      break;
    case 'properties-remove':
      // Remove version property
      purge(element, 'Property', val, key);
      break;
    case 'nodes-add':
      // Add new node
      nodes();
      break;
    case 'nodes-remove':
      // Remove node
      purge(element, 'Node', val, key);
      break;
    case 'contexts-add':
      // Add new context
      contexts(key);
      break;
    case 'contexts-remove':
      // Remove context
      purge(element, 'Context', val, key);
      break;
    case 'caps-add':
      // Add capability
      capability(val, key);
      break;
    case 'caps-remove':
      // Remove capability
      purge(element, 'Capability', val, key);
      break;
    case 'keys-add':
      //
      break;
    case 'keys-remove':
      // Remove key
      purge(element, 'Key', val, key);
      break;
    case 'confirm-dialog-close':
    case 'profiles-dialog-close':
    case 'versions-dialog-close':
    case 'properties-dialog-close':
    case 'nodes-dialog-close':
    case 'contexts-dialog-close':
    case 'caps-dialog-close':
      // Dialog close
      close(false);
      break;
    case 'confirm-dialog-ok':
    case 'profiles-dialog-ok':
    case 'versions-dialog-ok':
    case 'properties-dialog-ok':
    case 'nodes-dialog-ok':
    case 'contexts-dialog-ok':
    case 'caps-dialog-ok':
      // Dialog ok
      close(true);
      break;
    case 'confirm-dialog-cancel':
    case 'profiles-dialog-cancel':
    case 'versions-dialog-cancel':
    case 'properties-dialog-cancel':
    case 'nodes-dialog-cancel':
    case 'contexts-dialog-cancel':
    case 'caps-dialog-cancel':
      // Dialog cancel
      close(false);
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
  const key = attribute(element, 'data-key');

console.log('change', id, val, key);

// validate input

  // Changed what?
  switch (id) {
    case 'config-host':
    case 'config-port':
    case 'config-username':
    case 'config-password':
      // Config change
      command('config', key, val);
      break;
    case 'network-name':
    case 'network-orchestrator':
    case 'network-token':
    case 'profile-name':
    case 'property-name':
    case 'property-provider':
    case 'property-required':
    case 'property-propagate':
    case 'node-name':
    case 'node-upstream':
//    case 'node-token':
    case 'context-name':
//    case 'context-token':
    case 'cap-version':
    case 'cap-scope':
    case 'cap-default':
    case 'conn-property':
    case 'key-value':
      // Key change
      command('put', key, val);
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
      //
      html('#profiles-list', listProfiles());
      focus('#profiles-search');
      break;
    case 'nodes-form':
      //
      html('#nodes-list', listNodes());
      focus('#nodes-search');
      break;
    case 'keys-form':
      //
      html('#keys-list', listKeys());
      focus('#keys-search');
      break;
    case 'command-form':
      //
      const cmd = value('#command-line');
      if (cmd !== '') command(cmd);

      value('#command-line', '');
      html('#command-response', '');
      focus('#command-line');
      break;
  }
  return false;
}

// User interface

// Set list type
function setList(value) {
  if (value !== undefined) store('nav', value);
  else value = fetch('nav', 'collapse');

  attribute('nav', 'list', value);

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
  radio('nav button', 'selected', 'id', value);
  radio('section', 'hidden', 'view', value);

  focus('section[view="' + value + '"] input:first-of-type');
}

//
function setHelp(selector) {
  const element = selector.parentElement.nextElementSibling;
  attribute(element, 'hidden', toggle(element, 'hidden', '', null));
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

//
function expand(selector, key) {
  const element = selector.parentElement.parentElement.nextElementSibling;
  const state = toggle(element, 'hidden', '', null);

  if (state === null) expanded[key] = true;
  else delete expanded[key];

//  const icon = (state === null)?'expand_more':'chevron_right';

  attribute(element, 'hidden', state);
  text(selector.firstElementChild, isExpanded(key));
}

//
function isExpanded(key) {
  return expanded[key]?'expand_more':'chevron_right';
}

//
function isHidden(key) {
  return expanded[key]?'':' hidden';
}

//
function isChecked(value) {
  return (value === 'yes')?'Yes':'No';
  // '<i>check</i>':'<i>clear</i>';
}

//
function isSelected(value, selected) {
  return (value === selected)?' selected':'';
}

//
function install(element, profile, url) {
  // Confirm action
  return confirm('About To Install Profile', profile)
  .then((result) => {
    // Confirmed?
    if (result) {
      disabled(element, true);
      command('install', url);
    }
  });
}

// Show profiles dialog
function profiles() {
  //
  show('#profiles-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const profile = value('#profiles-dialog-profile');
      const ns = 'cns/network/profiles/' + profile + '/';

      command('put', ns + 'name', 'New Profile');
    }
  });
}

// Show versions dialog
function versions(profile) {
  //
  show('#versions-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const version = value('#versions-dialog-version');
      const ns = 'cns/network/profiles/' + profile + '/versions/version' + version + '/';

      command('put', ns + 'name', 'Version ' + version);
    }
  });
}

//
function properties(profile, version) {
  //
  show('#properties-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const id = value('#properties-dialog-property');
      const ns = 'cns/network/profiles/' + profile + '/versions/' + version + '/properties/' + id + '/';

      command('put', ns + 'name', 'New Property');
    }
  });
}

//
function nodes() {
  //
  show('#nodes-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const id = value('#nodes-dialog-id') || '$new';
      command('nodes', id);
    }
  });
}

//
function contexts(node) {
  //
  show('#contexts-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const id = value('#contexts-dialog-id') || '$new';
      command('contexts', node, id);
    }
  });
}

//
function capability(node, context) {
  // Fill profiles list
  selectProfiles('#caps-dialog-profile');

  //
  show('#caps-dialog')
  .then((result) => {
    // Confirmed?
    if (result) {
      const role = value('#caps-dialog-role');
      const profile = value('#caps-dialog-profile');
      const version = value('#caps-dialog-version');
      const scope = value('#caps-dialog-scope');

      command(role, node, context, profile, version, scope);
    }
  });
}

//
function purge(element, type, id, key) {
  // Confirm action
  return confirm('About To Remove ' + type, id)
  .then((result) => {
    // Confirmed?
    if (result) {
      disabled(element, true);
      command('purge', key);
    }
  });
}

//
function confirm(prompt, value) {
  text('#confirm-dialog h1 span', prompt);// + '<button id="dialog-cancel" icon primary><i>close</i></button>');
  text('#confirm-dialog p', value);

  return show('#confirm-dialog');
}

//
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
      resolve: resolve
    };
  });
}

//
function close(result) {
  if (dialog) {
    //
    if (result) {
      const form = $(dialog.element, 'form');
      if (!form.checkValidity()) return;
    }

    dialog.element.close(result);
    dialog.resolve(result);

    dialog = undefined;
  }
}

//
function message(msg) {
  messages.unshift(msg);

  const list = listMessages();
  html('#overview-messages', list);
}


var wasOnline;

// Update changes
function update() {
  const c = cache || {};

  const version = c.version || '';
  const config = c.config || {};
  const stats = c.stats || {};
  const keys = c.keys || {};

  const connection = stats.connection || null;
  const isOnline = (connection === 'online');

  const state = isOnline?'Online':'<span error>Offline</span>';
  const network = keys['cns/network/name'];

  const online = $$('[online]');
  const offline = $$('[offline]');

  for (const e of online)
    hidden(e, !isOnline);

  for (const e of offline)
    hidden(e, isOnline);

  if (isOnline !== wasOnline) {
    message((isOnline?'info':'warning') + ':Network ' + (isOnline?'online':'offline'));
    wasOnline = isOnline;
  }

  var list1 = '';
  var list2 = '';
  var list3 = '';
  var list4 = '';
  var list5 = '';

//  if (connection !== null) {
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

//    list2 = listMessages();

    if (isOnline) {
      list3 = listProfiles();
      list4 = listNodes();
      list5 = listKeys();
    } else {
      close(false);
    }
//  }

  text('#version', sanitize(version));
  html('footer', isOnline?sanitize(network):state);

  html('#overview-status', list1);
//  html('#overview-messages', list2);

  value('#config-host', config.host || '');
  value('#config-port', config.port || '');
  value('#config-username', config.username || '');
  value('#config-password', config.password || '');

  value('#network-name', keys['cns/network/name'] || '');
  value('#network-orchestrator', keys['cns/network/orchestrator'] || '');
  value('#network-token', keys['cns/network/token'] || '');

  html('#profiles-list', list3);
  html('#nodes-list', list4);
  html('#keys-list', list5);

  if (focused) focus(focused);
}

//
function listMessages() {
  var list = '';
  var total = 0;

  for (const msg of messages) {
    const parts = msg.split(':');

    const icon = parts[0];
    const text = parts[1];

    list +=
      '<tr>' +
        '<td><i>' + icon + '</i></td>' +
        '<td>' + text + '</td>' +
        '<td></td>' +
      '</tr>';

    total++;
  }

  const caption = '<caption>' + total + ' Messages found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>message</i></th>' +
        '<th>Notifications</th>' +
        '<th></th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate profiles list
function listProfiles() {
  const c = cache || {};
  const keys = c.keys || {};

  const search = value('#profiles-search');
  const wildcard = '*' + search + '*';

  const profiles = {};

  if (search !== '') {
    // Get available profiles
    const defs = c.profiles || {};

    for (const id in defs) {
      const def = defs[id];
      const name = def.name;

      if (match(id, wildcard) || match(name, wildcard)) {
        const versions = def.versions || '';

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

    if (match(id, wildcard) || match(name, wildcard)) {
      const vers = filter(keys, 'cns/network/profiles/' + id + '/versions/*/name');
      const versions = Object.keys(vers).length || '';

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

    const url = 'https://cp.padi.io/profiles/' + id;
    const key = 'cns/network/profiles/' + id;

    const readonly = install?' readonly':'';

    const expand = install?
      '<button id="profiles-view" data-key="' + url + '" icon primary><i>visibility</i></button>':
      '<button id="profiles-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';

    const action = install?
      '<button id="profiles-install" value="' + id + '" data-key="' + url + '" data-tip="Install Profile" data-pos="left" icon primary><i>download</i></button>':
      '<button id="profiles-remove" value="' + id + '" data-key="' + key + '" data-tip="Remove Profile" data-pos="left" icon primary><i>delete</i></button>';

    list +=
      '<tr ' + readonly + '>' +
        '<td>' + expand + '</td>' +
        '<td>' + id + '</td>' +
        '<td>' + name + '</td>' +
        '<td align="center">' + vers + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>';

    if (!install) {
      list +=
        '<tr expand' + isHidden(key) + '>' +
          '<td></td>' +
          '<td colspan="4">' +
            '<form id="profile-form">' +
              '<label>Profile name</label>' +
              '<input id="profile-name" type="text" value="' + name + '" maxlength="128" data-key="' + key + '/name" placeholder="New Profile"/>' +
            '</form>' +
            listVersions(id) +
          '</td>' +
        '</tr>';
    }
    total++;
  }

  const add = '<button id="profiles-add" data-tip="Add Profile" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + total + ' Profiles found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>extension</i></th>' +
        '<th>Profile</th>' +
        '<th>Name</th>' +
        '<th>Versions</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate profile versions
function listVersions(profile) {
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

    const key = 'cns/network/profiles/' + profile + '/versions/' + id;

    const expand = '<button id="versions-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
    const action = '<button id="versions-remove" value="' + name + '" data-key="' + key + '" data-tip="Remove Version" data-pos="left" icon primary><i>delete</i></button>';

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + name + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>' +
      '<tr expand' + isHidden(key) + '>' +
        '<td></td>' +
        '<td colspan="2">' +
          listProperties(profile, id) +
        '</td>' +
      '</tr>';

    total++;
  }

  const add = '<button id="versions-add" data-key="' + profile + '" data-tip="Add Version" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + total + ' Versions found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>style</i></th>' +
        '<th>Version</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// Generate profile properties
function listProperties(profile, version) {
  const c = cache || {};
  const keys = c.keys || {};

  var list = '';
  var total = 0;

  const properties = filter(keys, 'cns/network/profiles/' + profile + '/versions/' + version + '/properties/*/name');
  const order = Object.keys(properties).sort();

  for (const property of order) {
    const parts = property.split('/');

    const id = parts[7];
    const name = properties[property];

    const key = 'cns/network/profiles/' + profile + '/versions/' + version + '/properties/' + id;

    const provider = keys[key + '/provider'] || 'no';
    const required = keys[key + '/required'] || 'no';
    const propagate = keys[key + '/propagate'] || 'no';

    const expand = '<button id="properties-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
    const action = '<button id="properties-remove" value="' + id + '" data-key="' + key + '" data-tip="Remove Property" data-pos="left" icon primary><i>delete</i></button>';

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + id + '</td>' +
        '<td>' + name + '</td>' +
        '<td align="center">' + isChecked(provider) + '</td>' +
        '<td align="center">' + isChecked(required) + '</td>' +
        '<td align="center">' + isChecked(propagate) + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>' +
      '<tr expand' + isHidden(key) + '>' +
        '<td></td>' +
        '<td colspan="6">' +
          '<form id="property-form">' +
            '<label>Property name</label>' +
            '<input id="property-name" type="text" value="' + name + '" maxlength="128" data-key="' + key + '/name" placeholder="New Property"/>' +
            '<label>Property provider</label>' +
            '<select id="property-provider" data-key="' + key + '/provider">' +
              '<option value="yes"' + isSelected(provider, 'yes') + '>Yes</option>' +
              '<option value="no"' + isSelected(provider, 'no') + '>No</option>' +
            '</select>' +
            '<label>Property required</label>' +
            '<select id="property-required" data-key="' + key + '/required">' +
              '<option value="yes"' + isSelected(required, 'yes') + '>Yes</option>' +
              '<option value="no"' + isSelected(required, 'no') + '>No</option>' +
            '</select>' +
            '<label>Property propagate</label>' +
            '<select id="property-propagate" data-key="' + key + '/propagate">' +
              '<option value="yes"' + isSelected(propagate, 'yes') + '>Yes</option>' +
              '<option value="no"' + isSelected(propagate, 'no') + '>No</option>' +
            '</select>' +
          '</form>' +
        '</td>' +
      '</tr>';

    total++;
  }

  const add = '<button id="properties-add" value="' + profile + '" data-key="' + version + '" data-tip="Add Property" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + total + ' Properties found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>app_registration</i></th>' +
        '<th>Property</th>' +
        '<th>Name</th>' +
        '<th>Provider</th>' +
        '<th>Required</th>' +
        '<th>Propagate</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

//
function listNodes() {
  const c = cache || {};
  const keys = c.keys || {};

  const search = value('#nodes-search');
  const wildcard = '*' + search + '*';

  var list = '';
  var total = 0;

  const nodes = filter(keys, 'cns/network/nodes/*/name');
  const order = Object.keys(nodes).sort();

  for (const node of order) {
    const parts = node.split('/');

    const id = parts[3];
    const name = nodes[node];

// || find contexts (open list)

    if (match(id, wildcard) || match(name, wildcard)) {
      const key = 'cns/network/nodes/' + id;

      const expand = '<button id="nodes-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
      const action = '<button id="nodes-remove" value="' + id + '" data-key="' + key + '" data-tip="Remove Node" data-pos="left" icon primary><i>delete</i></button>';

      const upstream = keys[key + '/upstream'] || 'no';
      const token = keys[key + '/token'] || '';
//      const status = keys[key + '/status'] || '';

      list +=
        '<tr>' +
          '<td>' + expand + '</td>' +
          '<td>' + id + '</td>' +
          '<td>' + name + '</td>' +
          '<td align="center">' + isChecked(upstream) + '</td>' +
//          '<td>' + status + '</td>' +
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
  const caption = '<caption>' + total + ' Nodes found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>real_estate_agent</i></th>' +
        '<th>Node</th>' +
        '<th>Name</th>' +
        '<th>Upstream</th>' +
//        '<th width="100%">Status</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

// find contexts

//
function listContexts(node) {
  const c = cache || {};
  const keys = c.keys || {};

//  const search = value('#nodes-search');
//  const wildcard = '*' + search + '*';
//    if (match(id, wildcard) || match(name, wildcard)) {
//    }

  var list = '';
  var total = 0;

  const contexts = filter(keys, 'cns/network/nodes/' + node + '/contexts/*/name');
  const order = Object.keys(contexts).sort();

  for (const context of order) {
    const parts = context.split('/');

    const id = parts[5];
    const name = contexts[context];

    const key = 'cns/network/nodes/' + node + '/contexts/' + id;

    const expand = '<button id="contexts-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
    const action = '<button id="contexts-remove" value="' + id + '" data-key="' + key + '" data-tip="Remove Context" data-pos="left" icon primary><i>delete</i></button>';

    const token = keys[key + '/token'] || '';
//      const status = keys[key + '/status'];

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + id + '</td>' +
        '<td>' + name + '</td>' +
//          '<td>' + status + '</td>' +
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

  const add = '<button id="contexts-add" data-key="' + node + '" data-tip="Add Context" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + total + ' Contexts found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>sensor_door</i></th>' +
        '<th>Context</th>' +
        '<th>Name</th>' +
    //        '<th width="100%">Status</th>' +
        '<th>' + add + '</th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

//
function listCaps(node, context) {
  const c = cache || {};
  const keys = c.keys || {};

  var list = '';
  var total = 0;

  const caps = filter(keys, 'cns/network/nodes/' + node + '/contexts/' + context + '/*/*/version');
//  const order = Object.keys(caps).sort();

  for (const cap in caps) {//order) {
    const parts = cap.split('/');

    const role = parts[6];
    const id = parts[7];
    const version = caps[cap];

    const key = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + id;

    const expand = '<button id="caps-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
    const action = '<button id="caps-remove" value="' + id + '" data-key="' + key + '" data-tip="Remove Capability" data-pos="left" icon primary><i>delete</i></button>';

    const scope = keys[key + '/scope'] || '';

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + capitalize(role) + '</td>' +
        '<td>' + id + '</td>' +
        '<td align="center">' + version + '</td>' +
        '<td>' + capitalize(scope) + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>' +
      '<tr expand' + isHidden(key) + '>' +
        '<td></td>' +
        '<td colspan="5">' +
          '<form id="cap-form">' +
            '<label>Capability version</label>' +
            '<input id="cap-version" type="number" value="' + version + '" min="1" max="9" step="1" data-key="' + key + '/version" placeholder=""/>' +
            '<label>Capability scope</label>' +
            '<input id="cap-scope" type="text" value="' + scope + '" maxlength="128" data-key="' + key + '/scope" placeholder=""/>' +
            formDefaults(node, context, role, id, version) +
          '</form>' +
          listConns(node, context, role, id, version) +
        '</td>' +
      '</tr>';

    total++;
  }

  const add = '<button id="caps-add" value="' + node + '" data-key="' + context + '" data-tip="Add Capability" data-pos="left" icon primary><i>add</i></button>';
  const caption = '<caption>' + total + ' Capabilities found</caption>';

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

//
function listConns(node, context, role, profile, version) {
  const c = cache || {};
  const keys = c.keys || {};

  var list = '';
  var total = 0;

  const anti = (role === 'provider')?'consumer':'provider';
  const conns = filter(keys, 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/connections/*/' + anti);

  for (const conn in conns) {
    const parts = conn.split('/');

    const id = parts[9];
    const other = conns[conn] || '';
    const name = keys[other + '/name'] || '';

    const otherParts = other.split('/');
    const otherContext = otherParts[5] || '';
    const otherNode = otherParts[3] || '';

    const key = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/connections/' + id;
    const expand = '<button id="conns-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';

    const scope = keys[key + '/scope'] || '';

    list +=
      '<tr>' +
        '<td>' + expand + '</td>' +
        '<td>' + id + '</td>' +
        '<td>' + otherNode + '</td>' +
        '<td>' + otherContext + '</td>' +
        '<td>' + name + '</td>' +
        '<td></td>' +
      '</tr>' +
      '<tr expand' + isHidden(key) + '>' +
        formProperties(node, context, role, profile, version, id) +
      '</tr>';

    total++;
  }

  const caption = '<caption>' + total + ' Connections found</caption>';

  return '<table>' +
      '<tr>' +
        '<th><i>power</i></th>' +
        '<th>Connection</th>' +
        '<th>' + capitalize(anti) + '</th>' +
        '<th>Context</th>' +
        '<th>Name</th>' +
        '<th width="100%"></th>' +
      '</tr>' +
      list +
      caption +
    '</table>';
}

//
function listKeys() {
  const c = cache || {};
  const keys = c.keys || {};

  const search = value('#keys-search');
  const wildcard = '*' + search + '*';

  var list = '';
  var total = 0;

  const order = Object.keys(keys).sort();

  for (const key of order) {
    const parts = key.split('/');
    const value = keys[key];

    if (match(key, wildcard) || match(value, wildcard)) {
      const id = parts[parts.length - 1];

      const expand = '<button id="keys-expand" data-key="' + key + '" icon primary><i>' + isExpanded(key) + '</i></button>';
      const action = '<button id="keys-remove" value="' + id + '" data-key="' + key + '" data-tip="Remove Key" data-pos="left" icon primary><i>delete</i></button>';

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
  const caption = '<caption>' + total + ' Keys found</caption>';

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

//
function formDefaults(node, context, role, profile, version) {
  const c = cache || {};
  const keys = c.keys || {};

  var list = '';

  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/properties/';
  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/';

  const properties = filter(keys, ps + '*/name');
  const order = Object.keys(properties).sort();

  for (const property of order) {
    const parts = property.split('/');

    const id = parts[7];
    const name = properties[property];

    const provider = keys[ps + id + '/provider'] || '';

    switch (role) {
      case 'provider': if (provider !== 'yes') continue; break;
      case 'consumer': if (provider !== 'no') continue; break;
    }

    const key = ns + id;
    const value = keys[key] || '';

    list +=
      '<label>Capability ' + id + '</label>' +
      '<input id="cap-default" type="text" value="' + value + '" data-key="' + key + '" placeholder="' + name + '"/>';
  }
  return list;
}

//
function formProperties(node, context, role, profile, version, conn) {
  const c = cache || {};
  const keys = c.keys || {};

  var list = '';

  const ns = 'cns/network/nodes/' + node + '/contexts/' + context + '/' + role + '/' + profile + '/connections/' + conn + '/properties/';
  const ps = 'cns/network/profiles/' + profile + '/versions/version' + version + '/properties/';

  const properties = filter(keys, ps + '*/name');
  const order = Object.keys(properties).sort();

  for (const property of order) {
    const parts = property.split('/');

    const id = parts[7];
    const name = properties[property];

    const provider = keys[ps + id + '/provider'] || '';
    var readonly = '';

    switch (role) {
      case 'provider': if (provider !== 'yes') readonly = ' readonly'; break;
      case 'consumer': if (provider !== 'no') readonly = ' readonly'; break;
    }

    const key = ns + id;
    const value = keys[key] || '';

    list +=
      '<label>Connection ' + id + '</label>' +
      '<input id="conn-property" type="text" value="' + value + '" data-key="' + key + '" placeholder="' + name + '"' + readonly + '/>';
  }

  if (list !== '') {
    list =
      '<td></td>' +
      '<td colspan="5">' +
      '<form id="conn-form">' +
        list +
      '</form>' +
      '</td>';
  }
  return list;
}

//
function selectProfiles(selector) {
  const c = cache || {};
  const keys = c.keys || {};

  const current = value(selector);
  var options = '';

  const profiles = filter(keys, 'cns/network/profiles/*/name');
  const order = Object.keys(profiles).sort();

  for (const profile of order) {
    const parts = profile.split('/');
    const id = parts[3];

    const selected = ((current === '' && list === '') || id === current)?' selected':'';
    options += '<option value="' + id + '"' + selected + '>' + id + '</option>';
  }
  html(selector, options);
}

//
function selectVersions(selector, profile) {

}

// Capitalize text value
function capitalize(value) {
  return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

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
  text('footer', 'Connecting...');
  setTimeout(listen, WAIT);
}

// Listen for connection
function listen() {
  try {
    // Create socket
    const protocol = (location.protocol === 'https:')?'wss:':'ws:';
    const host = location.host;

    socket = new WebSocket(protocol + '//' + host);

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
  // Now connected
  hidden('#disconnected', true);
  hidden('#connected', false);

  message('info:Dashboard connected');
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

// update on timer?

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
function command() {
  const args = Array.prototype.slice.call(arguments);

  var cmd = '';

  for (const arg of args)
    cmd += (cmd === '')?arg:(' "' + arg + '"');

console.log('sending', cmd);

  // Create packet
  send(JSON.stringify({
    command: cmd
  }));
}

// Broken connection
function broken(e) {
  // Show error and disconnect
  text('footer', 'Error: ' + e.message);
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
  // Close any dialog
  close(false);

  // Now disconnected
  hidden('#connected', true);
  hidden('#disconnected', false);

  // Socket exists?
  if (socket !== undefined) {
    // Close it
    socket.close();
    socket = undefined;

    message('report:Dashboard disconnected');
  }

  // Clear cache
  cache = undefined;
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
  // Get focus?
  if (selector === undefined)
    return document.activeElement;

  // Get element
  const element = query(selector);
  if (element === null) return null;

  // Set focus
  element.focus();

  // Move cursor to end
  const len = element.value.length;

  element.selectionStart = len;
  element.selectionEnd = len;
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

document.onkeyup = focusin;
document.onclick = click;
document.onchange = change;
document.onsubmit = submit;

// Exports
// debug
return {
  get cache() {
    return cache;
  },
  focus: focus,
  toggle: toggle,
  attribute: attribute,
  command: command,
  $: $,
  $$: $$
};

}());
