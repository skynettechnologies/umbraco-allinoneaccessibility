/**
 * ---------------------------------------------------------------------------
 * dashboard.js - paid plan "Dashboard" button
 * ---------------------------------------------------------------------------
 * The dashboard sign-in link ("manage_domain" from check-website, through
 * the server route, action getDashboardLink) is loaded once, as soon as the plan is
 * known to be paid (AIOA.dashboard.load, called by app.js). A click never
 * calls the API, so the dashboard opens at once:
 *   link loaded          -> opens it in a new tab
 *   link still loading   -> opens the tab at once, points it at the link when it arrives
 *   link failed to load  -> error message (reload the page to try again)
 *
 *   AIOA.dashboard.load()   load the link (once per page load)
 */
(function (AIOA, window) {
  'use strict';

  const { $$ } = AIOA.util;

  let request = null; // the one getDashboardLink request of this page load
  let link = '';      // the sign-in link once it has loaded
  let failure = null; // why it could not be loaded

  /** Load the dashboard link (paid plans, once per page load) */
  function load() {
    if (request) {
      return;
    }
    request = AIOA.api.route('getDashboardLink', { url: AIOA.state.activeDomain })
      .then((result) => {
        const value = result && result.link;
        // Only ever open an https link
        if (!value || !/^https:\/\//i.test(value)) {
          throw new Error((result && result.error) || 'Unable to load the dashboard link.');
        }
        link = value;
        return value;
      });
    request.catch((err) => {
      failure = err;
    });
  }

  /** Point a tab at the link; when the browser blocked the tab, offer the link in a toast */
  function openIn(win, url) {
    if (win && !win.closed) {
      win.opener = null;
      win.location.href = url;
    } else {
      AIOA.ui.toast('success', 'Your dashboard link is ready', 'Your browser blocked the new tab.', { href: url, label: 'Open dashboard' });
    }
  }

  function showError(err) {
    const reason = err instanceof TypeError ? 'Please check your connection.' : (err && err.message) || '';
    AIOA.ui.toast('error', 'Could not open the dashboard', (reason ? reason + ' ' : '') + 'Reload the page to try again.');
  }

  function openDashboard(button) {
    if (link) {
      openIn(window.open('', '_blank'), link);
      return;
    }
    if (failure || !request) {
      showError(failure);
      return;
    }

    // Still loading: open the tab now (inside the click, so popup blockers allow it)
    // and point it at the link when the request that is already running finishes
    const win = window.open('', '_blank');
    if (win) {
      try {
        win.document.title = 'Opening dashboard…';
        win.document.body.style.cssText = 'font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;color:#420083';
        win.document.body.textContent = 'Opening your All in One Accessibility dashboard…';
      } catch (e) { /* the new tab is not scriptable, the link still works */ }
    }
    AIOA.ui.setBusy(button, true, 'Opening…');

    request
      .then((url) => openIn(win, url))
      .catch((err) => {
        if (win && !win.closed) {
          win.close();
        }
        showError(err);
      })
      .finally(() => AIOA.ui.setBusy(button, false));
  }

  $$('[data-aioa-dashboard]').forEach((button) => {
    button.addEventListener('click', () => openDashboard(button));
  });

  AIOA.dashboard = { load: load };
})(window.AIOA, window);
