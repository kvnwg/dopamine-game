/**
 * The save, kept in the player's Claude account when the game runs as a claude.ai artifact (Kevin:
 * "u gotta stop restarting my game save every time"). The artifact viewer's own browser storage can
 * come back empty (a cleared or partitioned store, the phone app's web view, another device), and
 * then the game used to start over. Here the save also goes to the artifact's `db` store, in the
 * player's private `data/users/<id>/save` document, which lasts across visits, devices and new
 * versions. On boot the newer of the two saves (by play time) is the one played.
 *
 * Only where the viewer offers `db` and `user` (the page declares both when published) and the
 * player is signed in with a place to write (the artifact's owner, or a colleague at Contributor or
 * above). Everywhere else every call resolves null or does nothing, and the browser save carries on
 * alone. Nothing here ever throws into the game.
 */

interface DocSnap {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface CapDb {
  doc(path: string): DocRef;
}
interface CapUser {
  id(): Promise<string | null>;
  isOwner(): Promise<boolean>;
}
interface ClaudeHost {
  use(name: string): Promise<unknown>;
}

/** A document holds at most 256 KiB; the save is written only if it fits with room to spare. */
const MAX_TEXT = 240_000;

function host(): ClaudeHost | null {
  try {
    const c = (window as unknown as { claude?: ClaudeHost }).claude;
    return c && typeof c.use === 'function' ? c : null;
  } catch {
    return null;
  }
}

/** Resolves `p`, or `fallback` after `ms`. */
function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

let slotPromise: Promise<DocRef | null> | null = null;
let userPromise: Promise<CapUser | null> | null = null;

function userCap(): Promise<CapUser | null> {
  userPromise ??= (async () => {
    const c = host();
    if (!c) return null;
    return ((await c.use('user')) as CapUser | null) ?? null;
  })().catch(() => null);
  return userPromise;
}

/** The player's save document, or null where there is none to be had. */
function slot(): Promise<DocRef | null> {
  slotPromise ??= (async () => {
    const c = host();
    if (!c) return null;
    const [db, user] = await Promise.all([c.use('db') as Promise<CapDb | null>, userCap()]);
    if (!db || !user) return null;
    const id = await user.id();
    if (!id) return null;
    return db.doc(`data/users/${id}/save`);
  })().catch(() => null);
  return slotPromise;
}

/** Whether this game runs where it could have an account save at all (a claude.ai artifact). */
export function cloudPossible(): boolean {
  return host() !== null;
}

/** Whether the player is the artifact's owner (false anywhere else). */
export async function isArtifactOwner(): Promise<boolean> {
  const user = await within(userCap(), 10_000, null);
  if (!user) return false;
  try {
    return await user.isOwner();
  } catch {
    return false;
  }
}

let loadPromise: Promise<string | null> | null = null;
/** The save in the player's account (its text), or null: none, or none to be had. Asked once. */
export function cloudLoadAll(): Promise<string | null> {
  loadPromise ??= (async () => {
    const ref = await slot();
    if (!ref) return null;
    const snap = await ref.get();
    const body = snap.exists ? snap.data() : undefined;
    return typeof body?.text === 'string' ? body.text : null;
  })().catch(() => null);
  return loadPromise;
}

/** As cloudLoadAll, waiting at most `ms`: 'late' if it hadn't answered by then (it may still). */
export function cloudLoad(ms: number): Promise<string | null | 'late'> {
  return within<string | null | 'late'>(cloudLoadAll(), ms, 'late');
}

/** False once a write has been refused for good (this viewer can't write here): no more tries. */
let writable = true;
/** When the account last took a save (0: not yet this visit). */
let lastOkAt = 0;

/**
 * Whether the game is being kept in the player's account: 'off' (not a claude.ai artifact),
 * 'pending' (not written yet this visit), 'on' (it has been), 'refused' (no place to write).
 */
export function cloudStatus(): 'off' | 'pending' | 'on' | 'refused' {
  if (!host()) return 'off';
  if (!writable) return 'refused';
  return lastOkAt ? 'on' : 'pending';
}
let writing = false;
let queued: { text: string; meta: Record<string, unknown> } | null = null;
let lastText = '';

/**
 * Writes the save to the player's account, one write at a time: a save asked for while one is being
 * written replaces any waiting one and goes after it. Unchanged saves aren't written again.
 */
export function cloudSave(text: string, meta: { playTimeMs: number; lastActiveAt: number }): void {
  if (!writable || !host() || text === lastText || text.length > MAX_TEXT) return;
  queued = { text, meta };
  if (!writing) void drain();
}

async function drain(): Promise<void> {
  writing = true;
  try {
    while (queued && writable) {
      const job = queued;
      queued = null;
      const ref = await within(slot(), 10_000, null);
      if (!ref) {
        writable = false;
        break;
      }
      try {
        await ref.set({ v: 1, text: job.text, savedAt: Date.now(), ...job.meta });
        lastText = job.text;
        lastOkAt = Date.now();
      } catch (e) {
        const code = (e as { code?: string } | null)?.code;
        // Refused for good (no place to write, not granted, gone): stop trying this visit.
        if (code && code !== 'unavailable' && code !== 'resource_exhausted') writable = false;
        else await new Promise((r) => setTimeout(r, 4000 + Math.random() * 4000));
      }
    }
  } finally {
    writing = false;
  }
}

/** Starting over: the account's save goes too, so the next visit doesn't bring the old game back. */
export async function cloudClear(): Promise<void> {
  queued = null;
  lastText = '';
  const ref = await within(slot(), 5000, null);
  if (!ref) return;
  try {
    await ref.delete();
  } catch {
    /* nothing to clear, or no place to write */
  }
}
