/**
 * All in One Accessibility - Settings dashboard for the Umbraco 14+ backoffice.
 * Embeds the settings page (cookie-authenticated, same origin) directly in the
 * dashboard tab. No build step: the backoffice's import map resolves the bare
 * module specifiers. The element must use UmbElementMixin - the dashboard
 * router calls the Umbraco element contract (provideContext) on it, so a
 * plain HTMLElement/LitElement is not enough from Umbraco 17 on.
 */
import { LitElement, html, css } from '@umbraco-cms/backoffice/external/lit';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';

export default class AioaDashboardElement extends UmbElementMixin(LitElement) {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    iframe {
      display: block;
      width: 100%;
      height: 100%;
      min-height: calc(100vh - 190px);
      border: 0;
      background: #fff;
    }
  `;

  render() {
    return html`
      <iframe
        src="/umbraco/backoffice/aioa"
        title="All in One Accessibility settings"
      ></iframe>
    `;
  }
}

customElements.define('aioa-dashboard', AioaDashboardElement);
