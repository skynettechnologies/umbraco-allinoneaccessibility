/**
 * ---------------------------------------------------------------------------
 * save.js - "Save Changes"
 * ---------------------------------------------------------------------------
 * Sends the settings straight to the Skynet API (widget-setting-update-platform).
 * The website is always registered by the time the settings are shown (app.js).
 */
(function (AIOA) {
  'use strict';

  const { $ } = AIOA.util;

  function save() {
    const params = AIOA.form.collect();
    if (!params) {
      return; // invalid form, the problem is already shown
    }

    const button = $('#submit');
    AIOA.ui.setBusy(button, true, 'Saving…');

    AIOA.api.post(AIOA.config.apiUpdateUrl, params)
      .then(() => {
        AIOA.form.setDirty(false);
        AIOA.ui.toast('success', 'Settings saved successfully!', 'It may take a few seconds for changes to appear on your website.');
      })
      .catch((err) => {
        console.error('AJAX error:', err);
        AIOA.ui.toast('error', 'Something went wrong.', 'Your settings were not saved. Please try again.');
      })
      .finally(() => AIOA.ui.setBusy(button, false));
  }

  $('#submit').addEventListener('click', save);
})(window.AIOA);
