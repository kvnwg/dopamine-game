/**
 * A mid-game save for the CrazyGames trailer, made by the balance bot playing the real game logic
 * (tools/simCore.ts): about 90 minutes in, 3 rebirths, World 10, every feature open, Epic and Legendary
 * gear on. Two Extra Reels (a buyable upgrade) so the roll shots show three reels, and every feature
 * marked as seen so no NEW bubbles cover the shots. Prints the save JSON.
 *   npx tsx tools/crazygames/trailerSave.ts > save.json
 */
import { simulate } from '../simCore';
import { serialize } from '../../src/core';

const result = simulate({ minutes: 90, seed: 3 });
const state = structuredClone(result.final);
state.upgrades = { ...state.upgrades, extraReel: 2 };
state.features = { ...state.features, seen: [...state.features.unlocked] };
process.stdout.write(serialize(state));
