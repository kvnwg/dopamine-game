/**
 * A save as a code to copy and paste (Settings, Save code): a backup the player keeps themselves, or
 * a way to move a game to another device or browser. "DL1:" + the save gzipped and in base64 where
 * the browser can compress (all current ones), else "DL0:" + the save in base64.
 */
import { readSave, serialize, type GameState } from '../core';

const b64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const unb64 = (text: string): Uint8Array => {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function saveToCode(state: GameState): Promise<string> {
  const bytes = new TextEncoder().encode(serialize(state));
  if (typeof CompressionStream === 'function') {
    try {
      return `DL1:${b64(await pipe(bytes, new CompressionStream('gzip')))}`;
    } catch {
      /* fall through: uncompressed */
    }
  }
  return `DL0:${b64(bytes)}`;
}

/** The game in a save code (mended if need be), or null if it isn't one. Spaces and line breaks are ignored. */
export async function codeToSave(code: string): Promise<{ state: GameState; fixed: string[] } | null> {
  const clean = code.replace(/\s+/g, '');
  try {
    let text: string;
    if (clean.startsWith('DL1:')) {
      if (typeof DecompressionStream !== 'function') return null;
      text = new TextDecoder().decode(await pipe(unb64(clean.slice(4)), new DecompressionStream('gzip')));
    } else if (clean.startsWith('DL0:')) {
      text = new TextDecoder().decode(unb64(clean.slice(4)));
    } else if (code.trim().startsWith('{')) {
      // A raw save (from the dev tools, say), its spaces kept: names have them.
      text = code.trim();
    } else {
      return null;
    }
    return readSave(text);
  } catch {
    return null;
  }
}
