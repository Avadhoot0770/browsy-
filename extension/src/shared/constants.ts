/**
 * Shared constants for the Browsy Extension
 */

export const EXTENSION_NAME = "Browsy";
export const EXTENSION_TAGLINE = "The web, your way.";
export const EXTENSION_VERSION = "0.2.0";

export const SHADOW_HOST_ID = "browsy-extension-root";
export const APP_CONTAINER_ID = "browsy-app-container";

export const Z_INDEX_MAX = 2147483647;

export const MVP_HONEST_RESPONSE = (hostname: string) => `
Browsy is connected to this page (${hostname}).

AI-powered page understanding is the next layer. In the upcoming stage, Browsy will analyze this page's controls, filters, and content to execute your request directly.
`.trim();

export const STAGE2_HONEST_RESPONSE = (
  hostname: string,
  stats?: { buttons: number; search: number; repeated: number }
) => {
  if (stats && (stats.buttons > 0 || stats.search > 0 || stats.repeated > 0)) {
    return `Browsy can see this page (${hostname}).

I detected ${stats.buttons} buttons, ${stats.search} search fields, and ${stats.repeated} repeated items.

Page understanding is active in this development build. Automatic page actions will be enabled in the next stage.`.trim();
  }
  return `Browsy can see this page (${hostname}).

Page understanding is active in this development build. Automatic page actions will be enabled in the next stage.`.trim();
};
