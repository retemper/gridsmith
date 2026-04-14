export type Unsubscribe = () => void;

export interface ReadonlySignal<T> {
  get(): T;
  peek(): T;
  subscribe(fn: (value: T) => void): Unsubscribe;
}

export interface Signal<T> extends ReadonlySignal<T> {
  set(value: T): void;
  update(fn: (current: T) => T): void;
}

export type Computed<T> = ReadonlySignal<T>;

let batchDepth = 0;
const pendingEffects: Set<() => void> = new Set();

export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = [...pendingEffects];
      pendingEffects.clear();
      for (const effect of effects) {
        effect();
      }
    }
  }
}

let activeComputed: Set<ReadonlySignal<unknown>> | null = null;

export function signal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const subscribers = new Set<(value: T) => void>();

  const notify = () => {
    // Snapshot subscribers to avoid issues with mutations during iteration
    const snapshot = [...subscribers];
    for (const fn of snapshot) {
      fn(value);
    }
  };

  const s: Signal<T> = {
    get() {
      if (activeComputed) {
        activeComputed.add(s as ReadonlySignal<unknown>);
      }
      return value;
    },
    peek() {
      return value;
    },
    set(newValue: T) {
      if (Object.is(value, newValue)) return;
      value = newValue;
      if (batchDepth > 0) {
        pendingEffects.add(notify);
      } else {
        notify();
      }
    },
    update(fn: (current: T) => T) {
      s.set(fn(value));
    },
    subscribe(fn: (value: T) => void): Unsubscribe {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };

  return s;
}

export function computed<T>(fn: () => T): Computed<T> {
  let value: T;
  let dirty = true;
  const subscribers = new Set<(value: T) => void>();
  let depUnsubs: Unsubscribe[] = [];
  let computing = false;

  const unsubDeps = () => {
    for (const unsub of depUnsubs) {
      unsub();
    }
    depUnsubs = [];
  };

  const recompute = (): T => {
    unsubDeps();

    const prevActive = activeComputed;
    activeComputed = new Set();
    computing = true;
    try {
      value = fn();
      dirty = false;
    } finally {
      const newDeps = activeComputed;
      activeComputed = prevActive;
      computing = false;

      // Subscribe to new deps
      for (const dep of newDeps) {
        depUnsubs.push(dep.subscribe(onDepChange));
      }
    }

    return value;
  };

  const onDepChange = () => {
    // Avoid reentrant computation
    if (computing) return;

    const oldValue = value;
    dirty = true;
    const newValue = recompute();

    // Only notify if value actually changed
    if (!Object.is(oldValue, newValue)) {
      const snapshot = [...subscribers];
      const doNotify = () => {
        for (const sub of snapshot) {
          sub(newValue);
        }
      };
      if (batchDepth > 0) {
        pendingEffects.add(doNotify);
      } else {
        doNotify();
      }
    }
  };

  const c: Computed<T> = {
    get() {
      if (activeComputed) {
        activeComputed.add(c as ReadonlySignal<unknown>);
      }
      if (dirty) {
        recompute();
      }
      return value;
    },
    peek() {
      if (dirty) {
        recompute();
      }
      return value;
    },
    subscribe(sub: (value: T) => void): Unsubscribe {
      if (dirty) {
        recompute();
      }
      subscribers.add(sub);
      return () => {
        subscribers.delete(sub);
      };
    },
  };

  return c;
}
