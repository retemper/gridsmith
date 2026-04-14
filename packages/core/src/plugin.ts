import type { EventBus } from './events';
import type { GridPlugin, PluginContext, CellDecorator, GridInstance, GridEvents } from './types';

interface PluginEntry {
  plugin: GridPlugin;
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  cleanup?: (() => void) | void;
}

export interface PluginManager {
  readonly apis: Map<string, unknown>;
  readonly decorators: CellDecorator[];
  initAll(grid: GridInstance, events: EventBus<GridEvents>): void;
  getPlugin<T>(name: string): T | undefined;
  destroyAll(): void;
}

export function resolvePluginOrder(plugins: GridPlugin[]): GridPlugin[] {
  const byName = new Map<string, GridPlugin>();
  for (const p of plugins) {
    if (byName.has(p.name)) {
      throw new Error(`Duplicate plugin name: "${p.name}"`);
    }
    byName.set(p.name, p);
  }

  const sorted: GridPlugin[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (plugin: GridPlugin) => {
    if (visited.has(plugin.name)) return;
    if (visiting.has(plugin.name)) {
      throw new Error(`Circular plugin dependency: "${plugin.name}"`);
    }

    visiting.add(plugin.name);

    for (const dep of plugin.dependencies ?? []) {
      const depPlugin = byName.get(dep);
      if (!depPlugin) {
        throw new Error(`Plugin "${plugin.name}" depends on "${dep}", which is not registered`);
      }
      visit(depPlugin);
    }

    visiting.delete(plugin.name);
    visited.add(plugin.name);
    sorted.push(plugin);
  };

  for (const p of plugins) {
    visit(p);
  }

  return sorted;
}

export function createPluginManager(plugins: GridPlugin[]): PluginManager {
  const ordered = resolvePluginOrder(plugins);
  const entries: PluginEntry[] = [];
  const apis = new Map<string, unknown>();
  const decorators: CellDecorator[] = [];

  return {
    apis,
    decorators,

    initAll(grid: GridInstance, events: EventBus<GridEvents>) {
      for (const plugin of ordered) {
        const ctx: PluginContext = {
          grid,
          events,
          getPlugin<T>(name: string): T | undefined {
            return apis.get(name) as T | undefined;
          },
          expose(name: string, api: unknown) {
            apis.set(name, api);
          },
          addCellDecorator(decorator: CellDecorator) {
            decorators.push(decorator);
          },
        };

        const cleanup = plugin.init(ctx);
        entries.push({ plugin, cleanup });
        events.emit('plugin:ready', { name: plugin.name });
      }
    },

    getPlugin<T>(name: string): T | undefined {
      return apis.get(name) as T | undefined;
    },

    destroyAll() {
      // Destroy in reverse order
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (!entry) continue;
        if (typeof entry.cleanup === 'function') {
          entry.cleanup();
        }
      }
      entries.length = 0;
      apis.clear();
      decorators.length = 0;
    },
  };
}
