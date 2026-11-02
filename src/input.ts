/** Keyboard state with edge detection, sampled once per fixed update. */

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'start' | 'pause' | 'mute';

const BINDINGS: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'jump',
  Enter: 'start',
  NumpadEnter: 'start',
  KeyP: 'pause',
  KeyM: 'mute',
};

export class Input {
  private held = new Set<Action>();
  private pressedQueue = new Set<Action>();
  private pressedNow = new Set<Action>();

  constructor(target: Window, onFirstInput: () => void) {
    target.addEventListener('keydown', (e) => {
      const a = BINDINGS[e.code];
      if (!a) return;
      e.preventDefault();
      onFirstInput();
      if (!e.repeat) this.pressedQueue.add(a);
      this.held.add(a);
    });
    target.addEventListener('keyup', (e) => {
      const a = BINDINGS[e.code];
      if (a) this.held.delete(a);
    });
    target.addEventListener('blur', () => this.held.clear());
  }

  /** Call at the start of each fixed step: latches presses since the last step. */
  poll(): void {
    this.pressedNow = this.pressedQueue;
    this.pressedQueue = new Set();
  }

  isDown(a: Action): boolean {
    return this.held.has(a);
  }

  wasPressed(a: Action): boolean {
    return this.pressedNow.has(a);
  }
}
