/**
 * ---------------------------------------------------------------------------
 * settings-form.js - the widget settings form
 * ---------------------------------------------------------------------------
 *   AIOA.form.settingsFrom(result)  API response -> settings with defaults
 *   AIOA.form.fill(settings)        put settings into the form
 *   AIOA.form.collect()             validate + read the form as API parameters
 *                                   (+ the Paid Features tab on a paid plan, see paid-features.js)
 *   AIOA.form.setDirty(bool)        "You have unsaved changes" indicator
 * Also handles the color picker, the preset / custom switches and the
 * live previews (icon images, mini website, --widget-color).
 */
(function (AIOA, document) {
  'use strict';

  const { $, $$, parseHex, checkedValue, checkRadio, positionValue, wholeNumber, wholeNumberField, requiredFields } = AIOA.util;
  const state = AIOA.state;
  const config = AIOA.config;

  // Exact position: both values are required while "Set an exact position in pixels" is on
  const positionFields = requiredFields(
    [$('#custom_position_x_value'), $('#custom_position_y_value')],
    $('#pos-error'),
    'Enter a horizontal and a vertical position from 0 to 250 px.'
  );

  /* =========================================================================
   * Settings <-> form
   * ======================================================================= */

  /** Normalize a widget settings response; anything missing falls back to the defaults */
  function settingsFrom(result) {
    const defaults = config.defaults;
    return {
      widget_position: positionValue(result.widget_position) || defaults.widget_position,
      widget_color_code: result.widget_color_code || defaults.widget_color_code,
      widget_icon_type: result.widget_icon_type || defaults.widget_icon_type,
      widget_icon_size: result.widget_icon_size || defaults.widget_icon_size,
      widget_size: result.widget_size || defaults.widget_size,
      widget_icon_size_custom: wholeNumber(result.widget_icon_size_custom, '') || '',
      widget_position_top: wholeNumber(result.widget_position_top, 0),
      widget_position_bottom: wholeNumber(result.widget_position_bottom, 0),
      widget_position_left: wholeNumber(result.widget_position_left, 0),
      widget_position_right: wholeNumber(result.widget_position_right, 0)
    };
  }

  /** Put settings into the form. state.customPosition / customSize must be set first. */
  function fill(settings) {
    positionFields.reset();
    $('#custom-position-switcher').checked = state.customPosition === 1;
    $('#custom-size-switcher').checked = state.customSize === 1;
    syncCustomPosition();
    syncCustomSize();

    setColor(settings.widget_color_code);

    checkRadio('position', settings.widget_position);
    updateMiniWidget();
    checkRadio('widget_size', settings.widget_size);
    checkRadio('aioa_icon_type', settings.widget_icon_type);
    checkRadio('aioa_icon_size', settings.widget_icon_size);
    updateIconImages(settings.widget_icon_type);

    $('#widget_icon_size_custom').value = settings.widget_icon_size_custom;

    // Exact horizontal offset: right wins over left
    const xField = $('#custom_position_x_value');
    const xDirection = $('#custom_position_x_dir');
    if (settings.widget_position_right > 0) {
      xField.value = settings.widget_position_right;
      xDirection.value = 'cust-pos-to-the-right';
    } else if (settings.widget_position_left > 0) {
      xField.value = settings.widget_position_left;
      xDirection.value = 'cust-pos-to-the-left';
    } else {
      xField.value = 0;
      xDirection.value = 'cust-pos-to-the-right'; // default direction
    }

    // Exact vertical offset: bottom wins over top
    const yField = $('#custom_position_y_value');
    const yDirection = $('#custom_position_y_dir');
    if (settings.widget_position_bottom > 0) {
      yField.value = settings.widget_position_bottom;
      yDirection.value = 'cust-pos-to-the-lower';
    } else if (settings.widget_position_top > 0) {
      yField.value = settings.widget_position_top;
      yDirection.value = 'cust-pos-to-the-upper';
    } else {
      yField.value = 0;
      yDirection.value = 'cust-pos-to-the-lower'; // default direction
    }
  }

  /**
   * Validate the form and build the parameters for widget-setting-update-platform.
   * Shows what is wrong and returns null when the form is invalid.
   */
  function collect() {
    const hex = parseHex($('#colorcode').value);
    if (!hex) {
      setColorError(true);
      $('#colorcode').focus();
      AIOA.ui.toast('error', 'Invalid color', 'Enter a valid hex color code, for example FF5733.');
      return null;
    }

    // Whole pixels only (the fields never hold decimals, see wholeNumberField)
    const widget_icon_size_custom = String(wholeNumber($('#widget_icon_size_custom').value, ''));

    if (state.customSize === 1 && (widget_icon_size_custom === '' || Number(widget_icon_size_custom) < 20)) {
      $('#widget_icon_size_custom').focus();
      AIOA.ui.toast('error', 'Invalid icon size', 'Enter an exact icon size of at least 20 px.');
      return null;
    }

    if (state.customSize === 1 && Number(widget_icon_size_custom) > 150) {
      $('#widget_icon_size_custom').focus();
      AIOA.ui.toast('error', 'Invalid icon size', 'Enter an exact icon size of 150 px or less.');
      return null;
    }

    // Exact position: an empty field is never saved as 0
    if (state.customPosition === 1) {
      const empty = positionFields.check();
      if (empty) {
        AIOA.tabs.select('appearance');
        empty.focus();
        AIOA.ui.toast('error', 'Position missing', 'Enter the exact position (0 - 250 px), or turn off "Set an exact position in pixels".');
        return null;
      }
    }

    // Exact offsets: only the chosen direction of each axis is sent
    // (empty only while the exact position is off: then 0, as before)
    const custom_position_x = wholeNumber($('#custom_position_x_value').value, 0);
    const custom_position_y = wholeNumber($('#custom_position_y_value').value, 0);
    const x_position_direction = $('#custom_position_x_dir').value;
    const y_position_direction = $('#custom_position_y_dir').value;

    let widget_position_right = null;
    let widget_position_left = null;
    let widget_position_top = null;
    let widget_position_bottom = null;

    if (x_position_direction === 'cust-pos-to-the-right') {
      widget_position_right = custom_position_x;
    } else if (x_position_direction === 'cust-pos-to-the-left') {
      widget_position_left = custom_position_x;
    }

    if (y_position_direction === 'cust-pos-to-the-lower') {
      widget_position_bottom = custom_position_y;
    } else if (y_position_direction === 'cust-pos-to-the-upper') {
      widget_position_top = custom_position_y;
    }

    const params = {
      u: state.activeDomain,
      widget_position: checkedValue('position'),
      is_widget_custom_position: state.customPosition,
      is_widget_custom_size: state.customSize,
      widget_color_code: '#' + hex,
      widget_icon_type: checkedValue('aioa_icon_type'),
      widget_icon_size: checkedValue('aioa_icon_size'),
      widget_size: checkedValue('widget_size'),
      widget_icon_size_custom: widget_icon_size_custom,
      widget_position_right: widget_position_right,
      widget_position_left: widget_position_left,
      widget_position_top: widget_position_top,
      widget_position_bottom: widget_position_bottom
    };

    // Paid Features: paid plans only (the tab holds the saved values by then, see app.js)
    if (state.isPaid) {
      const paid = AIOA.paid.collect();
      if (!paid) {
        return null;
      }
      Object.assign(params, paid);
    }

    return params;
  }

  /* =========================================================================
   * Previews and switches
   * ======================================================================= */

  /** Show the selected icon type in every preview image (.iconimg) */
  function updateIconImages(iconType) {
    $$('.iconimg').forEach((img) => {
      img.src = config.iconBase + iconType + '.svg';
    });
  }

  /** Move the icon in the "Your website" preview to the selected position */
  function updateMiniWidget() {
    const input = document.querySelector('input[name="position"]:checked');
    if (input) {
      $('#mini-widget').style.setProperty('--gx', input.dataset.gx);
      $('#mini-widget').style.setProperty('--gy', input.dataset.gy);
    }
  }

  /** Preset position grid <-> exact offsets */
  function syncCustomPosition() {
    const on = $('#custom-position-switcher').checked;
    state.customPosition = on ? 1 : 0;
    $('#custom-position-controls').hidden = !on;
    $('#position_html').hidden = on;
    if (!on) {
      positionFields.reset();
    }
  }

  /** Preset icon sizes <-> exact size */
  function syncCustomSize() {
    const on = $('#custom-size-switcher').checked;
    state.customSize = on ? 1 : 0;
    $('#custom-size-controls').hidden = !on;
    $('#select_icon_size').hidden = on;
  }

  /* =========================================================================
   * Color picker
   * ======================================================================= */

  function setColorError(show) {
    $('#colorcode-error').hidden = !show;
    $('#colorcode').setAttribute('aria-invalid', show ? 'true' : 'false');
    $('[data-for="colorcode"]').classList.toggle('is-invalid', show);
  }

  /**
   * Apply a color to the picker, the presets and the live preview (--widget-color).
   * @param {string} value   any hex format; invalid values fall back to the default color
   * @param {boolean} keepText leave the hex field as typed (while the admin is typing)
   */
  function setColor(value, keepText) {
    const hex = parseHex(value) || config.defaultColor;
    if (!keepText) {
      $('#colorcode').value = hex;
    }
    $('#colorpicker').value = '#' + hex.toLowerCase();
    document.documentElement.style.setProperty('--widget-color', '#' + hex);
    setColorError(false);
    $$('.aioa-preset').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.color === hex));
    });
  }

  /* =========================================================================
   * Save bar: unsaved changes indicator
   * ======================================================================= */

  function setDirty(dirty) {
    $('#savebar').classList.toggle('is-dirty', dirty);
    $('#save-state-text').textContent = dirty ? 'You have unsaved changes' : 'All changes saved';
  }

  /* =========================================================================
   * Event listeners
   * ======================================================================= */

  // Color picker, hex field, presets, reset
  $('#colorpicker').addEventListener('input', (e) => setColor(e.target.value));

  $('#colorcode').addEventListener('input', (e) => {
    const clean = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6).toUpperCase();
    if (clean !== e.target.value) {
      e.target.value = clean;
    }
    if (clean.length === 6) {
      setColor(clean, true);
    }
  });

  $('#colorcode').addEventListener('blur', (e) => {
    const hex = parseHex(e.target.value);
    if (hex) {
      setColor(hex);
    } else {
      setColorError(true);
    }
  });

  $$('.aioa-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      setColor(btn.dataset.color);
      setDirty(true);
    });
  });

  $('#color-reset').addEventListener('click', () => {
    setColor(config.defaultColor);
    setDirty(true);
  });

  // Any change marks the form as unsaved; Enter must not submit the form
  $('#widget-form').addEventListener('input', () => setDirty(true));
  $('#widget-form').addEventListener('change', () => setDirty(true));
  $('#widget-form').addEventListener('submit', (e) => e.preventDefault());

  // Preset / custom switches
  $('#custom-position-switcher').addEventListener('change', syncCustomPosition);
  $('#custom-size-switcher').addEventListener('change', syncCustomSize);

  // Whole pixels only: exact offsets kept within 0 - 250 px while typing,
  // the exact icon size (20 - 150 px) is checked when saving
  ['#custom_position_x_value', '#custom_position_y_value'].forEach((selector) => {
    wholeNumberField($(selector), 250);
  });
  wholeNumberField($('#widget_icon_size_custom'));

  // Live previews
  $$('input[name="position"]').forEach((radio) => {
    radio.addEventListener('change', updateMiniWidget);
  });

  $$('input[name="aioa_icon_type"]').forEach((radio) => {
    radio.addEventListener('change', () => updateIconImages(radio.value));
  });

  AIOA.form = {
    settingsFrom: settingsFrom,
    fill: fill,
    collect: collect,
    setDirty: setDirty
  };
})(window.AIOA, document);
