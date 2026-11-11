import { describe, expect, it } from 'vitest';
import { DATA } from '../src/data';
import { forMouse } from '../src/ui/i18n';

// On a PC (a mouse), the touch strings read "click" for "tap" and the scroll wheel for pinching.
describe('mouse wording', () => {
  it('turns tap into click, keeping the case and the ending', () => {
    expect(forMouse('Tap again: scrap {n}!')).toBe('Click again: scrap {n}!');
    expect(forMouse('TAP AGAIN!')).toBe('CLICK AGAIN!');
    expect(forMouse("Your dumpster's reels: tap to go to the Roll tab")).toBe("Your dumpster's reels: click to go to the Roll tab");
    expect(forMouse('He taps, tapping, tapped')).toBe('He clicks, clicking, clicked');
    expect(forMouse('Drag to explore, pinch to zoom')).toBe('Drag to explore, scroll to zoom');
  });

  it('leaves words that only contain "tap" alone', () => {
    expect(forMouse('A tapestry, a stapler, a tapir')).toBe('A tapestry, a stapler, a tapir');
  });

  it('leaves no "tap" or "pinch" in any string', () => {
    for (const [key, text] of Object.entries(DATA.strings)) {
      const out = forMouse(text);
      expect(out, key).not.toMatch(/\btap(s|ping|ped)?\b|pinch/i);
    }
  });
});
