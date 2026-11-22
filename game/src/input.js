// Keyboard and mouse for Velvet Hour: WASD or the arrow keys move, holding Shift or C sneaks
// (slow and silent), a mouse click throws a coin to that point, Enter/Space/click confirms on
// the menu screens, R restarts the vault and P pauses. Input is polled: main.js asks each frame
// for the held direction and drains the one-shot actions and clicks.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  let sneakHeld = false;
  let actions = 0;
  const clicks = [];

  function toGamePoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    const direction = KEYMAP[event.code];
    if (direction) {
      held[direction] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyC') sneakHeld = true;
    else if (event.code === 'Enter' || event.code === 'Space') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyR') actions |= ACTION_RESTART;
  });

  window.addEventListener('keyup', (event) => {
    const direction = KEYMAP[event.code];
    if (direction) held[direction] = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyC') sneakHeld = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    clicks.push(toGamePoint(event));
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The held movement direction as a unit-ish vector (not normalised; main.js normalises). */
    direction() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    sneaking() {
      return sneakHeld;
    },
    /** One-shot button presses since the last call; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Queued mouse clicks in game coordinates, oldest first; reading clears them. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
