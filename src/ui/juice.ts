/**
 * Small touches for every button, from Kevin's game-feel list ("nothing should just appear, buttons
 * pop with a slight overshoot"): on release a button hops a pixel up, flashes and settles (global.css
 * `.popped`, whole pixels and steps, so pixel art inside stays on its grid). The click sound itself
 * climbs a step for taps in quick succession (see soundController).
 */
export function installButtonJuice(): () => void {
  const onUp = (e: PointerEvent) => {
    const btn = (e.target as Element | null)?.closest?.('button') as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;
    // Restart the hop even when the same button is tapped again mid-hop.
    btn.classList.remove('popped');
    void btn.offsetWidth;
    btn.classList.add('popped');
  };
  const onEnd = (e: AnimationEvent) => {
    if (e.animationName === 'btnPop') (e.target as Element).classList.remove('popped');
  };
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('animationend', onEnd, true);
  return () => {
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('animationend', onEnd, true);
  };
}
