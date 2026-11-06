/**
 * The battle (Phaser and its scene) is its own download (BattlePanel starts it once the page has
 * rendered: the title screen doesn't need it). Whatever else waits for it to arrive first, such as the
 * recorded sounds (soundController.ts), asks here, so the battle gets the connection to itself.
 */
let battle: Promise<typeof import('../render/BattleScene')> | null = null;

/** The battle's code, downloading once (the same promise every time). */
export function loadBattle(): Promise<typeof import('../render/BattleScene')> {
  battle ??= import('../render/BattleScene');
  return battle;
}

/** Resolves when the battle's code has arrived, or after `ms` at the latest (or at once if it failed). */
export function afterBattle(ms: number): Promise<void> {
  return Promise.race([
    loadBattle().then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((r) => setTimeout(r, ms)),
  ]);
}
