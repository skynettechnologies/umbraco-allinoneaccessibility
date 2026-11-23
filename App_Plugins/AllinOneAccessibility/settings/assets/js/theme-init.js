/**
 * ---------------------------------------------------------------------------
 * theme-init.js - runs in <head>, before the first paint
 * ---------------------------------------------------------------------------
 * Applies the light / dark choice saved by the theme toggle (theme.js), so
 * the page never flashes in the wrong theme.
 * Priority: saved choice > ?theme= (data-theme set on <html> by the page) > system setting.
 */
(function () {
  'use strict';

  try {
    var saved = localStorage.getItem('aioa-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {
    // Storage is blocked (e.g. private mode): keep the default theme
  }
})();
