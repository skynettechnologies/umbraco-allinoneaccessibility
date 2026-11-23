/**
 * ---------------------------------------------------------------------------
 * tabs.js - Appearance Design / Paid Features / Accessibility Score
 * ---------------------------------------------------------------------------
 * ARIA tabs (the "tabs" partial): click a tab, or use the arrow keys,
 * Home and End on the tab row. The save bar shows only on tabs with something
 * to save: Appearance Design, and Paid Features on a paid plan.
 *
 * Order and locks follow the plan (AIOA.tabs.setPlan, called by plan.js):
 *   paid plan  Accessibility Score, Paid Features, Appearance Design
 *   free plan  Appearance Design, Paid Features, Accessibility Score; the last
 *              two are blurred behind the upgrade overlay (the "lock" partial)
 * The page opens on the tab the admin chose last time (localStorage "aioa-tab-picked"),
 * otherwise on the first tab.
 *
 *   AIOA.tabs.select(name, focus)  show "appearance", "paid" or "score"
 *   AIOA.tabs.current()
 *   AIOA.tabs.setPlan(paid)
 *
 * Events on document:  "aioa:tab-change" (detail.tab)  "aioa:lock-change" (detail.locked)
 */
(function (AIOA, document) {
  'use strict';

  const { $, $$ } = AIOA.util;
  const tablist = $('.aioa-tabs');
  const tabs = $$('.aioa-tab');
  const STORAGE_KEY = 'aioa-tab-picked';
  const ORDER = {
    paid: ['score', 'paid', 'appearance'],
    free: ['appearance', 'paid', 'score']
  };

  let current = tabs[0].dataset.tab;
  let paidPlan = false; // until the plan is known

  /** Show one tab and its panel */
  function show(name) {
    const tab = tabs.find((t) => t.dataset.tab === name) || tabs[0];
    current = tab.dataset.tab;

    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });

    // Nothing to save on the score tab, nor on the locked Paid Features tab (free plan)
    $('#save-area').hidden = !(current === 'appearance' || (current === 'paid' && paidPlan));

    document.dispatchEvent(new CustomEvent('aioa:tab-change', { detail: { tab: current } }));
    return tab;
  }

  /** Show a tab chosen by the admin, and remember it for the next visit */
  function select(name, focus) {
    const tab = show(name);
    AIOA.storage.set(STORAGE_KEY, current);
    if (focus) {
      tab.focus();
    }
  }

  /** Lock (free plan) or unlock (paid plan) the paid tabs */
  function setLocked(locked) {
    $$('[data-tab-lock]').forEach((el) => {
      el.hidden = !locked;
    });
    $$('.aioa-lockable').forEach((box) => {
      box.classList.toggle('is-locked', locked);
      box.querySelector('.aioa-lock').hidden = !locked;
      box.querySelector('.aioa-lock-content').inert = locked; // not focusable, not read out
    });
    document.dispatchEvent(new CustomEvent('aioa:lock-change', { detail: { locked: locked } }));
  }

  /** Order and lock the tabs for the plan, then open the remembered (or first) tab */
  function setPlan(paid) {
    paidPlan = paid;
    const order = paid ? ORDER.paid : ORDER.free;
    tabs.sort((a, b) => order.indexOf(a.dataset.tab) - order.indexOf(b.dataset.tab));
    tablist.append(...tabs);

    setLocked(!paid);
    show(AIOA.storage.get(STORAGE_KEY) || tabs[0].dataset.tab);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => select(tab.dataset.tab));

    tab.addEventListener('keydown', (e) => {
      const index = tabs.indexOf(tab);
      const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (target === undefined) {
        return;
      }
      e.preventDefault();
      select(tabs[(target + tabs.length) % tabs.length].dataset.tab, true);
    });
  });

  AIOA.tabs = {
    select: select,
    current: () => current,
    setPlan: setPlan
  };
})(window.AIOA, document);
