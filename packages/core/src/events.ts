import type { Unsubscribe } from './signal';

export type EventHandler<T = unknown> = (payload: T) => void;

export interface EventBus<TEvents extends object = Record<string, unknown>> {
  on<K extends keyof TEvents & string>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe;
  once<K extends keyof TEvents & string>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe;
  emit<K extends keyof TEvents & string>(event: K, payload: TEvents[K]): void;
  removeAllListeners(): void;
}

export function createEventBus<
  TEvents extends object = Record<string, unknown>,
>(): EventBus<TEvents> {
  const handlers = new Map<string, Set<EventHandler>>();

  const getHandlers = (event: string): Set<EventHandler> => {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    return set;
  };

  return {
    on<K extends keyof TEvents & string>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe {
      const set = getHandlers(event);
      set.add(handler as EventHandler);
      return () => {
        set.delete(handler as EventHandler);
      };
    },

    once<K extends keyof TEvents & string>(
      event: K,
      handler: EventHandler<TEvents[K]>,
    ): Unsubscribe {
      const unsub = this.on(event, ((payload: TEvents[K]) => {
        unsub();
        handler(payload);
      }) as EventHandler<TEvents[K]>);
      return unsub;
    },

    emit<K extends keyof TEvents & string>(event: K, payload: TEvents[K]): void {
      const set = handlers.get(event);
      if (!set) return;
      for (const handler of set) {
        handler(payload);
      }
    },

    removeAllListeners(): void {
      handlers.clear();
    },
  };
}
