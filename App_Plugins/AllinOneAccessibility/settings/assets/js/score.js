/**
 * ---------------------------------------------------------------------------
 * score.js - Accessibility Score tab
 * ---------------------------------------------------------------------------
 * Paid plan: the first time the tab opens it loads the scan results
 * (server route, action fetchScanDetails) and shows one of:
 *   #score-loading  #score-error  #score-empty (scanning in progress)  #score-card
 * Free plan: the sample card stays blurred under the upgrade overlay
 * (AIOA.tabs.setPlan) and nothing is requested.
 */
(function (AIOA, document) {
  'use strict';

  const { $ } = AIOA.util;
  const state = AIOA.state;
  const card = $('#score-card');
  const VIEWS = ['score-loading', 'score-error', 'score-empty', 'score-card'];
  const LEVELS = ['compliant', 'semi', 'not'];

  let locked = true;   // until the plan is known
  let loaded = false;  // the score is shown or loading

  function show(id) {
    VIEWS.forEach((view) => {
      $('#' + view).hidden = view !== id;
    });
  }

  /** 96.15 -> "96.15%", 100 -> "100%" */
  function percent(value) {
    return Math.round((Number(value) || 0) * 100) / 100 + '%';
  }

  /** "2026-06-27 05:24:30" (UTC) -> "Jun 27, 2026" */
  function formatDate(value) {
    const date = new Date(String(value).replace(' ', 'T') + 'Z');
    return isNaN(date) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function field(name) {
    return card.querySelector('[data-field="' + name + '"]');
  }

  /** Fill the score card from the fetchScanDetails summary */
  function render(summary) {
    // Up to 99, never 100 (the server's summary is capped the same way)
    const score = Math.max(0, Math.min(99, Math.round(Number(summary.score) || 0)));
    const violations = summary.violations || {};
    const altText = summary.alt_text || {};
    const pages = summary.pages || {};

    card.dataset.level = LEVELS.includes(summary.level) ? summary.level : 'not';
    field('status').textContent = summary.status || '';

    const donut = card.querySelector('.aioa-donut');
    donut.style.setProperty('--p', score);
    donut.setAttribute('aria-label', 'Accessibility score ' + score + '%' + (summary.status ? ', ' + summary.status : ''));
    field('score').textContent = score;

    field('violations-pct').textContent = percent(violations.percentage);
    field('violations-count').textContent = num(violations.fixed) + ' / ' + num(violations.total);
    field('alt-pct').textContent = percent(altText.percentage);
    field('alt-count').textContent = num(altText.fixed) + ' / ' + num(altText.total);
    field('pages').textContent = num(pages.scanned);
    field('pages-count').textContent = num(pages.scanned) + ' / ' + num(pages.total);

    const date = formatDate(summary.last_scan);
    field('last-scan').textContent = date ? 'Last scan: ' + date : '';

    // Only https report links are offered
    const report = field('report');
    report.hidden = !/^https:\/\//i.test(summary.report_url || '');
    report.href = report.hidden ? '#' : summary.report_url;

    show('score-card');
  }

  function num(value) {
    return Number(value) || 0;
  }

  /** Load the score of the website (once, unless forced by Try again) */
  function load(force) {
    if (locked || (loaded && !force)) {
      return;
    }
    loaded = true;
    show('score-loading');

    AIOA.api.route('fetchScanDetails', { url: state.activeDomain })
      .then((result) => {
        if (!result || typeof result !== 'object') {
          throw new Error('Unexpected response from the server.');
        }
        if (result.error) {
          throw new Error(result.error);
        }
        if (result.no_scan) {
          show('score-empty'); // not scanned yet, or the scan is still running
          return;
        }
        render(result);
      })
      .catch((err) => {
        loaded = false; // try again the next time the tab opens
        $('#score-error-text').textContent = err instanceof TypeError ?
          'Please check your connection and try again.' :
          (err.message || 'Please try again.');
        show('score-error');
      });
  }

  $('#score-retry').addEventListener('click', () => load(true));

  document.addEventListener('aioa:tab-change', (e) => {
    if (e.detail.tab === 'score') {
      load();
    }
  });

  // Free plan: sample card under the overlay; paid plan: the real results
  document.addEventListener('aioa:lock-change', (e) => {
    locked = e.detail.locked;
    $('#score-sample').hidden = !locked;
    $('#score-live').hidden = locked;
    if (!locked && AIOA.tabs.current() === 'score') {
      load();
    }
  });
})(window.AIOA, document);
