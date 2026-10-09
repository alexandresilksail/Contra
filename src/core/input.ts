/**
 * Input layer: keyboard (fully rebindable) + Gamepad API.
 * Actions are exposed as edge-detected "pressed" plus continuous "held".
 */

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'shoot' | 'start' | 'pause';
export const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'jump', 'shoot', 'start', 'pause'];

export type BindingMap = Record<Action, string[]>; // KeyboardEvent.code[]

export const DEFAULT_KEYS: Record<0 | 1, BindingMap> = {
  0: {
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    jump: ['KeyK', 'KeyW'],
    shoot: ['KeyJ'],
    start: ['Enter'],
    pause: ['Escape'],
  },
  1: {
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    jump: ['Digit1'],
    shoot: ['Digit0'],
    start: ['NumpadEnter'],
    pause: ['Escape'],
  },
};

/** Human readable label for a KeyboardEvent.code */
export function keyLabel(code: string): string {
  if (!code) return '--';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  if (code.startsWith('Arrow')) return code.slice(5);
  const map: Record<string, string> = {
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    ShiftLeft: 'L-SHIFT',
    ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL',
    ControlRight: 'R-CTRL',
    Tab: 'TAB',
    Backspace: 'BKSP',
    Semicolon: ';',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Minus: '-',
    Equal: '=',
  };
  return map[code] ?? code.toUpperCase();
}

interface PlayerInputState {
  held: Record<Action, boolean>;
  pressed: Record<Action, boolean>;
  released: Record<Action, boolean>;
}

const emptyState = (): PlayerInputState => ({
  held: { left: false, right: false, up: false, down: false, jump: false, shoot: false, start: false, pause: false },
  pressed: { left: false, right: false, up: false, down: false, jump: false, shoot: false, start: false, pause: false },
  released: { left: false, right: false, up: false, down: false, jump: false, shoot: false, start: false, pause: false },
});

export class Input {
  private down = new Set<string>();
  private justDown = new Set<string>();
  private justUp = new Set<string>();
  private states: [PlayerInputState, PlayerInputState] = [emptyState(), emptyState()];
  bindings: Record<0 | 1, BindingMap>;
  gamepadEnabled = true;
  capturing: { player: 0 | 1; action: Action } | null = null;
  onCapture: ((code: string | null) => void) | null = null;

  private rawHandlers = {
    keydown: (e: KeyboardEvent) => this.onKeyDown(e),
    keyup: (e: KeyboardEvent) => this.onKeyUp(e),
    blur: () => this.releaseAll(),
  };

  constructor(bindings?: Record<0 | 1, BindingMap>) {
    this.bindings = bindings ?? structuredClone(DEFAULT_KEYS);
  }

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.rawHandlers.keydown);
    target.addEventListener('keyup', this.rawHandlers.keyup);
    target.addEventListener('blur', this.rawHandlers.blur);
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.rawHandlers.keydown);
    target.removeEventListener('keyup', this.rawHandlers.keyup);
    target.removeEventListener('blur', this.rawHandlers.blur);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.capturing) {
      e.preventDefault();
      const { player, action } = this.capturing;
      this.capturing = null;
      if (e.code !== 'Escape') this.bindings[player][action] = [e.code];
      this.onCapture?.(e.code === 'Escape' ? null : e.code);
      return;
    }
    if (e.repeat) return;
    // F-keys are reserved for debug, don't let them scroll the page
    if (/^F\d{1,2}$/.test(e.code)) e.preventDefault();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    this.down.add(e.code);
    this.justDown.add(e.code);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.down.delete(e.code);
    this.justUp.add(e.code);
  }

  private releaseAll(): void {
    this.down.clear();
    this.justDown.clear();
    this.justUp.clear();
  }

  /** Call once per frame, BEFORE entities read input. */
  update(): void {
    for (const p of [0, 1] as const) {
      const st = this.states[p];
      const bind = this.bindings[p];
      for (const a of ACTIONS) {
        const keys = bind[a];
        const heldNow = keys.some((k) => this.down.has(k)) || this.padHeld(p, a);
        const pressedNow = keys.some((k) => this.justDown.has(k)) || this.padPressed(p, a);
        st.pressed[a] = pressedNow || (heldNow && !st.held[a]);
        st.released[a] = !heldNow && st.held[a];
        st.held[a] = heldNow;
      }
    }
    this.justDown.clear();
    this.justUp.clear();
  }

  /** Call at the end of the frame. */
  postUpdate(): void {
    for (const p of [0, 1] as const) {
      const st = this.states[p];
      for (const a of ACTIONS) {
        st.pressed[a] = false;
        st.released[a] = false;
      }
    }
  }

  private pad(index: number): Gamepad | null {
    if (!this.gamepadEnabled || typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    const gp = pads ? pads[index] : null;
    return gp && gp.connected ? gp : null;
  }

  private prevPad: [Record<string, boolean>, Record<string, boolean>] = [{}, {}];

  private padBtn(gp: Gamepad, i: number): boolean {
    const b = gp.buttons[i];
    return !!b && (b.pressed || b.value > 0.5);
  }

  private padHeld(p: 0 | 1, a: Action): boolean {
    const gp = this.pad(p);
    if (!gp) return false;
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    switch (a) {
      case 'left':
        return ax < -0.35 || this.padBtn(gp, 14);
      case 'right':
        return ax > 0.35 || this.padBtn(gp, 15);
      case 'up':
        return ay < -0.5 || this.padBtn(gp, 12);
      case 'down':
        return ay > 0.5 || this.padBtn(gp, 13);
      case 'jump':
        return this.padBtn(gp, 0);
      case 'shoot':
        return this.padBtn(gp, 2) || this.padBtn(gp, 7);
      case 'start':
        return this.padBtn(gp, 9);
      case 'pause':
        return this.padBtn(gp, 8);
    }
    return false;
  }

  private padPressed(p: 0 | 1, a: Action): boolean {
    const now = this.padHeld(p, a);
    const key = a;
    const before = !!this.prevPad[p][key];
    this.prevPad[p][key] = now;
    return now && !before;
  }

  held(p: 0 | 1, a: Action): boolean {
    return this.states[p].held[a];
  }
  pressed(p: 0 | 1, a: Action): boolean {
    return this.states[p].pressed[a];
  }
  released(p: 0 | 1, a: Action): boolean {
    return this.states[p].released[a];
  }

  /** raw key (for menus / debug) */
  rawPressed(code: string): boolean {
    return this.justDown.has(code);
  }
  rawHeld(code: string): boolean {
    return this.down.has(code);
  }

  startCapture(player: 0 | 1, action: Action, cb: (code: string | null) => void): void {
    this.capturing = { player, action };
    this.onCapture = cb;
  }
}
