// Helper do Meta Pixel no browser. O eventID compartilhado com o servidor
// permite deduplicação entre o Pixel e a Conversions API (CAPI).
declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
  }
}

const PIXEL_ID = import.meta.env.VITE_FB_PIXEL_ID as string | undefined;

export function initFbPixel(): void {
  if (!PIXEL_ID || !window.fbq) return;
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

export function trackInitiateCheckout(eventId: string, value: number): void {
  if (!PIXEL_ID || !window.fbq) return;
  window.fbq('track', 'InitiateCheckout', { value, currency: 'BRL' }, { eventID: eventId });
}
