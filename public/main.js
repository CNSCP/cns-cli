// main.js - CNS Dashboard
// Copyright 2024 Padi, Inc. All Rights Reserved.

// Application

const app = (function() {

// Event handlers

// Handle app init
function init() {
  // Connect host
//  connect();

console.log('init');
}

// Handle app exit
function exit() {
  // Disconnect host
//  disconnect();
console.log('exit');
}

// Handle click
function click(e) {
  const element = target(e);
  if (element === null) return;

  switch (element.id) {
    case 'expand':
      attribute('nav', 'state', 'collapse');
      break;
    case 'collapse':
      attribute('nav', 'state', 'expand');
      break;
    case 'home':
    case 'apps':
    case 'config':
    case 'about':
      attribute('article', 'nav', element.id);
      break;
    case 'light':
      attribute('body', 'scheme', 'dark');
      break;
    case 'dark':
      attribute('body', 'scheme', 'light');
      break;
  }
}

// Find target for event
function target(e) {
  var element = e.target;

  // Valid if has id
  while (element !== null && element.id === '')
   element = element.parentElement;

  return element;
}

// Get or set element attribute
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

// Exports

return {
  $: $,
  $$: $$
};

}());
