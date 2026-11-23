/**
 * ---------------------------------------------------------------------------
 * All in One Accessibility - Umbraco adapter
 * ---------------------------------------------------------------------------
 * Loaded with defer right after core.js (deferred scripts run in document
 * order), before the rest of the page scripts. It wraps AIOA.api.route so
 * every call to the local route carries the ASP.NET antiforgery token the
 * settings page printed into its <meta> tags, and sends the backoffice
 * cookies explicitly. The shared reference files (core.js and friends) stay
 * byte-for-byte unmodified.
 */
(function (window, document) {
  'use strict';

  var AIOA = window.AIOA;
  if (!AIOA || !AIOA.api || !AIOA.config) {
    return;
  }

  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content') || '' : '';
  }

  var csrfToken = meta('aioa-csrf');
  var csrfField = meta('aioa-csrf-field') || '__RequestVerificationToken';

  AIOA.api.route = function (action, data) {
    var body = new URLSearchParams();
    Object.keys(data || {}).forEach(function (key) {
      var value = (data || {})[key];
      body.append(key, value === null || value === undefined ? '' : value);
    });
    if (csrfToken) {
      body.append(csrfField, csrfToken);
    }

    var url = AIOA.config.routeUrl + '?action=' + encodeURIComponent(action);
    return fetch(url, { method: 'POST', body: body, credentials: 'same-origin' })
      .then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) {
            throw new Error('Request failed (' + res.status + ')');
          }
          try { return JSON.parse(text); } catch (e) { return text; }
        });
      });
  };
})(window, document);
