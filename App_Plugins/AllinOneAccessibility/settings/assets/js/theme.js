/**
 * ---------------------------------------------------------------------------
 * theme.js - light / dark mode toggle
 * ---------------------------------------------------------------------------
 * Follows the system setting until the admin picks a theme with the header
 * button; the choice is saved in localStorage ("aioa-theme") and applied
 * before the first paint by theme-init.js.
 */
(function (AIOA, window, document) {
  'use strict';

  const { $ } = AIOA.util;
  const button = $('#theme-toggle');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  /** The theme currently on screen: the explicit choice, otherwise the system setting */
  function effectiveTheme() {
    return document.documentElement.getAttribute('data-theme') || (darkQuery.matches ? 'dark' : 'light');
  }

  /** Update the button icon and its accessible label */
  function syncButton() {
    const theme = effectiveTheme();
    const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    button.dataset.mode = theme;
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  button.addEventListener('click', () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    AIOA.storage.set('aioa-theme', next);
    syncButton();
  });

  // Keep the icon right when the system theme changes
  if (darkQuery.addEventListener) {
    darkQuery.addEventListener('change', syncButton);
  }

  syncButton();
})(window.AIOA, window, document);
