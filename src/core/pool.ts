/**
 * Generic object pool. Entities are recycled instead of re-created so the
 * game never allocates during the hot loop (keeps 60 FPS stable).
 */
export class Pool<T> {
  private free: T[] = [];
  readonly active: T[] = [];

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    prealloc = 0,
  ) {
    for (let i = 0; i < prealloc; i++) this.free.push(factory());
  }

  spawn(): T {
    const obj = this.free.pop() ?? this.factory();
    this.reset(obj);
    this.active.push(obj);
    return obj;
  }

  /** Remove active objects flagged dead and return them to the free list. */
  sweep(isDead: (obj: T) => boolean, onRecycle?: (obj: T) => void): void {
    const act = this.active;
    let w = 0;
    for (let i = 0; i < act.length; i++) {
      const o = act[i];
      if (isDead(o)) {
        if (onRecycle) onRecycle(o);
        this.free.push(o);
      } else {
        act[w++] = o;
      }
    }
    act.length = w;
  }

  clear(onRecycle?: (obj: T) => void): void {
    for (const o of this.active) {
      if (onRecycle) onRecycle(o);
      this.free.push(o);
    }
    this.active.length = 0;
  }

  get count(): number {
    return this.active.length;
  }
}
