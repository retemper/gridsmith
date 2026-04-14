export const VERSION = '0.0.0';

// Core API
export { createGrid } from './grid';
export { createRenderer } from './renderer';
export type { RendererOptions, RendererInstance } from './renderer';

// Virtualization
export {
  computeColumnLayout,
  calculateVisibleRange,
  getTotalHeight,
  DEFAULT_CONFIG,
} from './virtualization';
export type { VirtualizationConfig, ColumnLayout } from './virtualization';

// Reactive primitives
export { signal, computed, batch } from './signal';
export type { Signal, Computed, ReadonlySignal, Unsubscribe } from './signal';

// Event bus
export { createEventBus } from './events';
export type { EventBus, EventHandler } from './events';

// Types
export type {
  CellValue,
  Row,
  ColumnType,
  PinPosition,
  ColumnDef,
  SortDirection,
  SortEntry,
  SortState,
  FilterEntry,
  FilterOperator,
  FilterState,
  IndexMap,
  ViewportState,
  VisibleRange,
  CellChange,
  GridEvents,
  CellDecoration,
  CellDecorator,
  PluginContext,
  GridPlugin,
  GridOptions,
  GridInstance,
} from './types';
