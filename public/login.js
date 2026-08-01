// login.js - CNS Dashboard Login
// Copyright 2025 Padi, Inc. All Rights Reserved.

// Externalised from an inline <script> so the dashboard can enforce a strict
// Content-Security-Policy (script-src 'self') with no inline execution.
if (new URLSearchParams(location.search).has('error'))
  document.getElementById('error').style.display = 'block';
