/**
 * ---------------------------------------------------------------------------
 * ui.js - toasts, busy buttons and page views
 * ---------------------------------------------------------------------------
 *   AIOA.ui.setView(id)                      loading / error / settings
 *   AIOA.ui.setBusy(button, busy, label)     spinner while a request runs
 *   AIOA.ui.toast(type, title, msg, action)  notification in the top right
 */
(function (AIOA) {
  'use strict';

  const { $ } = AIOA.util;

  // Small inline icons used by the toasts
  const ICONS = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 7v6M12 17v.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  // Only one of these is visible at a time (the "status" partial and the layout)
  const VIEWS = ['load', 'error_block', 'settings_block'];

  AIOA.ui = {
    /** Show one view: "load", "error_block" or "settings_block" */
    setView(id) {
      VIEWS.forEach((view) => {
        document.getElementById(view).hidden = view !== id;
      });
    },

    /** Swap a button's content for a spinner + label while busy, and restore it afterwards */
    setBusy(button, busy, label) {
      if (busy) {
        button.dataset.html = button.innerHTML;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.innerHTML = '<span class="aioa-spinner" aria-hidden="true"></span><span>' + label + '</span>';
        return;
      }

      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (button.dataset.html) {
        button.innerHTML = button.dataset.html;
      }
    },

    /**
     * Show a toast notification.
     * @param {"success"|"error"} type
     * @param {string} title
     * @param {string} [message]
     * @param {{href: string, label: string}} [action] optional link (opens in a new tab)
     */
    toast(type, title, message, action) {
      const el = document.createElement('div');
      el.className = 'aioa-toast is-' + type;
      if (type === 'error') {
        el.setAttribute('role', 'alert');
      }
      el.innerHTML = '<span class="aioa-toast-ic" aria-hidden="true">' + (type === 'success' ? ICONS.check : ICONS.alert) + '</span>' +
        '<div class="aioa-toast-body"><strong></strong><p></p></div>' +
        '<button type="button" class="aioa-toast-close" aria-label="Dismiss notification">' + ICONS.close + '</button>';

      // Text is set with textContent so messages from the API can't inject HTML
      el.querySelector('strong').textContent = title;
      el.querySelector('p').textContent = message || '';

      if (action) {
        const link = document.createElement('a');
        link.href = action.href;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = action.label;
        el.querySelector('.aioa-toast-body').appendChild(link);
      }

      const close = () => {
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 200);
      };
      el.querySelector('.aioa-toast-close').addEventListener('click', close);
      $('#toasts').appendChild(el);

      // Links stay longer so there is time to click them
      setTimeout(close, action ? 15000 : (type === 'error' ? 8000 : 5000));
    }
  };
})(window.AIOA);
