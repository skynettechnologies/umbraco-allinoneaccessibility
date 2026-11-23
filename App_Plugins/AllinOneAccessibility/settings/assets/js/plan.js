/**
 * ---------------------------------------------------------------------------
 * plan.js - what is shown above the settings, and the tabs for the plan
 * ---------------------------------------------------------------------------
 *   free plan  -> "Upgrade to Paid Plan" banner   (#free_plan_upgrade_block)
 *   paid plan  -> paid card with "Dashboard"      (#paid_plan_block)
 * plus the "Widget installed on <domain>" line.
 * Tabs (AIOA.tabs.setPlan): a paid plan starts with Accessibility Score;
 * on the free plan Paid Features and Accessibility Score are locked.
 */
(function (AIOA, document) {
  'use strict';

  const { $ } = AIOA.util;
  const state = AIOA.state;

  AIOA.plan = {
    /**
     * @param {number|string} is_free_widget from the widget settings response: 1 = free plan, anything else = paid plan
     */
    render(is_free_widget) {
      state.isPaid = parseInt(is_free_widget, 10) !== 1;

      $('#free_plan_upgrade_block').hidden = state.isPaid;
      $('#paid_plan_block').hidden = !state.isPaid;
      AIOA.tabs.setPlan(state.isPaid);

      const domain = document.createElement('strong');
      domain.textContent = state.activeDomain;
      $('#site-text').replaceChildren('Widget installed on ', domain);
    }
  };
})(window.AIOA, document);
