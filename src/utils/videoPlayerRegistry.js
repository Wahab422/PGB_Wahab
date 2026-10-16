/**
 * Global video player registry.
 * Allows any video player instance (section, list item, etc.) to pause all
 * other registered players when it starts playing.
 *
 * Usage:
 *   import { registerVideoPlayer, unregisterVideoPlayer, pauseOtherPlayers } from '../utils/videoPlayerRegistry';
 *
 *   // Register with a pause callback
 *   const id = registerVideoPlayer(() => pauseVideo());
 *
 *   // Before playing, pause everyone else
 *   pauseOtherPlayers(id);
 *
 *   // On destroy
 *   unregisterVideoPlayer(id);
 */

let counter = 0;
const players = new Map();

export function registerVideoPlayer(pauseFn) {
  const id = ++counter;
  players.set(id, pauseFn);
  return id;
}

export function unregisterVideoPlayer(id) {
  players.delete(id);
}

export function pauseOtherPlayers(exceptId) {
  players.forEach((pauseFn, id) => {
    if (id === exceptId) return;
    try {
      pauseFn();
    } catch {
      // One broken player must not stop the others from pausing.
    }
  });
}
