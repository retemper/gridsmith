/**
 * Marker attached to placeholder rows created by the async data plugin (or
 * any future equivalent) so the index map knows to bypass client-side filter
 * predicates. Without this, a placeholder row with every cell unloaded would
 * fail any `contains`/`eq` filter and vanish from the view before the
 * real content arrives.
 *
 * Sort is left untouched — placeholders compare equal under `defaultCompare`,
 * so stable sort keeps them in data-index order among themselves.
 *
 * `Symbol.for` is used intentionally so duplicate module instances (dual
 * bundler outputs, edge-case hot reload) resolve to the same token.
 */
export const PLACEHOLDER_ROW: unique symbol = Symbol.for('gridsmith.row.placeholder');

export type PlaceholderMeta = { [PLACEHOLDER_ROW]?: true };
