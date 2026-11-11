/**
 * The battle (Phaser and its scene) is its own download. The page prefetches it as it opens
 * (vite.config.ts battlePrefetch), and BattlePanel imports it once the loading screen has gone: the
 * import is what runs it (Phaser setting itself up is a few hundred ms of a phone's time), so it
 * mustn't land while the title is being built. Whatever else waits for it, such as the recorded sounds
 * (soundController.ts), asks here without starting it.
 */
let battle: Promise<typeof import('../render/BattleScene')> | null = null;
let asked: () => void = () => undefined;
const askedP = new Promise<void>((r) => (asked = r));

/** The battle's code, imported once (the same promise every time). */
export function loadBattle(): Promise<typeof import('../render/BattleScene')> {
  if (!battle) {
    battle = import('../render/BattleScene');
    asked();
  }
  return battle;
}

/**
 * Resolves when the battle's code has arrived and run, or `ms` after it was first asked for at the
 * latest (or at once if it failed). It never asks for it itself.
 */
export function afterBattle(ms: number): Promise<void> {
  return askedP.then(() =>
    Promise.race([
      battle!.then(
        () => undefined,
        () => undefined,
      ),
      new Promise<void>((r) => setTimeout(r, ms)),
    ]),
  );
}
