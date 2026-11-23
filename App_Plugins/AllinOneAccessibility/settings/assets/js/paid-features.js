/**
 * ---------------------------------------------------------------------------
 * paid-features.js - Paid Features tab
 * ---------------------------------------------------------------------------
 * Fields (the "paid" partials) and the API parameters they become:
 *   statement_link, report_problem_link   empty or a full http(s) link
 *   widget_leave_page, is_sound_disabled  switches, 1 / 0
 *   is_mobile_position                    switch: separate position on phones
 *   is_widget_custom_position_mobile      "Set an exact position in pixels": 0 presets / 1 offsets
 *   widget_position_mobile                preset, e.g. "bottom_right"
 *   Exact position, every value a whole number of px, 0 - 250:
 *     horizontal  To the left / To the right / Center
 *                 widget_position_left_mobile, widget_position_right_mobile,
 *                 widget_position_horizontal_center_offset_mobile
 *     vertical    To the top / To the bottom
 *                 widget_position_top_mobile, widget_position_bottom_mobile
 *   Only the chosen direction of each axis is sent; the others are empty
 *   (widget_position_vertical_center_offset_mobile is always empty).
 *
 *   AIOA.paid.fill(result)   saved values -> tab
 *   AIOA.paid.collect()      check + read the tab, or null when a link is invalid
 *                            or a value of the exact mobile position is missing
 */
(function (AIOA, document) {
  'use strict';

  const { $, checkedValue, checkRadio, positionValue, wholeNumber, wholeNumberField, requiredFields } = AIOA.util;

  const LINKS = ['statement_link', 'report_problem_link'];
  const SWITCHES = ['widget_leave_page', 'is_sound_disabled'];
  const OFFSET_MAX = 250;

  const isSet = (value) => value !== null && value !== undefined && value !== '';
  const isOn = (value) => Number(value) === 1;
  const num = (value) => wholeNumber(value, 0);

  // Exact mobile position: both values are required while it is in use
  const mobileFields = requiredFields(
    [$('#mobile_x_value'), $('#mobile_y_value')],
    $('#mobile-pos-error'),
    'Enter a horizontal and a vertical position from 0 to 250 px.'
  );
  const mobileExact = () => $('#is_mobile_position').checked && $('#custom-position-mobile-switcher').checked;

  /* =========================================================================
   * Links
   * ======================================================================= */

  /** "www.example.com/page" -> "https://www.example.com/page" (links typed without a scheme) */
  function withScheme(value) {
    const text = String(value || '').trim();
    if (text && !/^[a-z][a-z0-9+.-]*:/i.test(text) && /^[^\s/]+\.[^\s/]+/.test(text)) {
      return 'https://' + text;
    }
    return text;
  }

  /** Empty, or an http(s) link to a real domain */
  function isValidLink(value) {
    if (!value) {
      return true;
    }
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.');
    } catch (e) {
      return false;
    }
  }

  function setLinkError(name, message) {
    const error = $('#' + name + '-error');
    error.textContent = message || '';
    error.hidden = !message;
    $('#' + name).setAttribute('aria-invalid', message ? 'true' : 'false');
    $('[data-for="' + name + '"]').classList.toggle('is-invalid', !!message);
  }

  /** Add the scheme if needed and show an error under an invalid link; true when valid */
  function checkLink(name) {
    const input = $('#' + name);
    input.value = withScheme(input.value);
    const valid = isValidLink(input.value);
    setLinkError(name, valid ? '' : 'Enter a full link that starts with https://, for example ' + input.placeholder);
    return valid;
  }

  /* =========================================================================
   * Widget position for mobile
   * ======================================================================= */

  /** Switch on/off, preset grid <-> exact offsets */
  function syncMobile() {
    $('#mobile-position-body').hidden = !$('#is_mobile_position').checked;
    const custom = $('#custom-position-mobile-switcher').checked;
    $('#mobile-preset').hidden = custom;
    $('#mobile-custom').hidden = !custom;
    if (!mobileExact()) {
      mobileFields.reset();
    }
  }

  /** Move the icon in the "Mobile view" preview to the selected position */
  function updateMobilePreview() {
    const input = document.querySelector('input[name="position_mobile"]:checked');
    if (input) {
      $('#mini-widget-mobile').style.setProperty('--gx', input.dataset.gx);
      $('#mini-widget-mobile').style.setProperty('--gy', input.dataset.gy);
    }
  }

  /** Set one axis of the exact offsets (a whole number, 0 - 250 px) */
  function setAxis(axis, direction, value) {
    $('#mobile_' + axis + '_dir').value = direction;
    $('#mobile_' + axis + '_value').value = Math.min(Math.max(num(value), 0), OFFSET_MAX);
  }

  /** { direction, value } of one axis of the exact offsets */
  function readAxis(axis) {
    return { direction: $('#mobile_' + axis + '_dir').value, value: num($('#mobile_' + axis + '_value').value) };
  }

  /* =========================================================================
   * Fill / collect
   * ======================================================================= */

  function fill(result) {
    const r = result || {};
    mobileFields.reset();

    LINKS.forEach((name) => {
      $('#' + name).value = r[name] || '';
      setLinkError(name, '');
    });
    SWITCHES.forEach((name) => {
      $('#' + name).checked = isOn(r[name]);
    });

    $('#is_mobile_position').checked = isOn(r.is_mobile_position);
    $('#custom-position-mobile-switcher').checked = isOn(r.is_widget_custom_position_mobile);
    checkRadio('position_mobile', 'bottom_right');
    checkRadio('position_mobile', positionValue(r.widget_position_mobile));
    updateMobilePreview();

    // Horizontal: center offset first, then right wins over left (as on desktop)
    if (isSet(r.widget_position_horizontal_center_offset_mobile)) {
      setAxis('x', 'center', r.widget_position_horizontal_center_offset_mobile);
    } else if (num(r.widget_position_left_mobile) > 0 && !(num(r.widget_position_right_mobile) > 0)) {
      setAxis('x', 'left', r.widget_position_left_mobile);
    } else {
      setAxis('x', 'right', r.widget_position_right_mobile);
    }

    // Vertical: bottom wins over top (as on desktop)
    if (num(r.widget_position_top_mobile) > 0 && !(num(r.widget_position_bottom_mobile) > 0)) {
      setAxis('y', 'top', r.widget_position_top_mobile);
    } else {
      setAxis('y', 'bottom', r.widget_position_bottom_mobile);
    }

    syncMobile();
  }

  function collect() {
    const invalid = LINKS.filter((name) => !checkLink(name));
    if (invalid.length) {
      AIOA.tabs.select('paid');
      $('#' + invalid[0]).focus();
      AIOA.ui.toast('error', 'Invalid link', 'Check the links on the Paid Features tab.');
      return null;
    }

    // Exact mobile position: an empty field is never saved as 0
    if (mobileExact()) {
      const empty = mobileFields.check();
      if (empty) {
        AIOA.tabs.select('paid');
        empty.focus();
        AIOA.ui.toast('error', 'Mobile position missing', 'Enter the exact mobile position (0 - 250 px) on the Paid Features tab.');
        return null;
      }
    }

    const x = readAxis('x');
    const y = readAxis('y');
    const offset = (axis, direction) => (axis.direction === direction ? axis.value : '');

    return {
      statement_link: $('#statement_link').value,
      report_problem_link: $('#report_problem_link').value,
      widget_leave_page: $('#widget_leave_page').checked ? 1 : 0,
      is_sound_disabled: $('#is_sound_disabled').checked ? 1 : 0,
      is_mobile_position: $('#is_mobile_position').checked ? 1 : 0,
      is_widget_custom_position_mobile: $('#custom-position-mobile-switcher').checked ? 1 : 0,
      widget_position_mobile: checkedValue('position_mobile'),
      widget_position_right_mobile: offset(x, 'right'),
      widget_position_left_mobile: offset(x, 'left'),
      widget_position_horizontal_center_offset_mobile: offset(x, 'center'),
      widget_position_bottom_mobile: offset(y, 'bottom'),
      widget_position_top_mobile: offset(y, 'top'),
      widget_position_vertical_center_offset_mobile: '' // no vertical center option: always cleared
    };
  }

  /* =========================================================================
   * Event listeners
   * ======================================================================= */

  LINKS.forEach((name) => {
    $('#' + name).addEventListener('blur', () => checkLink(name));
    $('#' + name).addEventListener('input', () => setLinkError(name, ''));
  });

  $('#is_mobile_position').addEventListener('change', syncMobile);
  $('#custom-position-mobile-switcher').addEventListener('change', syncMobile);
  document.querySelectorAll('input[name="position_mobile"]').forEach((radio) => {
    radio.addEventListener('change', updateMobilePreview);
  });

  // Whole pixels only, kept within 0 - 250 px while typing
  ['x', 'y'].forEach((axis) => {
    wholeNumberField($('#mobile_' + axis + '_value'), OFFSET_MAX);
  });

  AIOA.paid = {
    fill: fill,
    collect: collect
  };
})(window.AIOA, document);
