import type {
  AsyncValidator,
  CellValue,
  ColumnDef,
  GridPlugin,
  Row,
  SyncValidator,
  ValidationContext,
  ValidationError,
  ValidationPluginApi,
  ValidationResult,
} from './types';

// ─── Helpers ───────────────────────────────────────────────

const key = (dataIndex: number, columnId: string): string => `${dataIndex}:${columnId}`;

function findColumn(cols: readonly ColumnDef[], id: string): ColumnDef | undefined {
  for (const c of cols) if (c.id === id) return c;
  return undefined;
}

function cellIsValidatable(col: ColumnDef | undefined): col is ColumnDef {
  if (!col) return false;
  return typeof col.validate === 'function' || typeof col.asyncValidate === 'function';
}

// `Object.is` treats two `Date` instances with the same epoch as unequal — we
// don't want that, since identical date values shouldn't trigger spurious
// `validation:change` events.
function valuesEqual(a: CellValue, b: CellValue): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}

// ─── Plugin ────────────────────────────────────────────────

export function createValidationPlugin(): GridPlugin {
  // Key is `${dataIndex}:${columnId}` so errors survive sort/filter and pinned
  // rows look up with the same shape. `pendingTokens` lets stale async results
  // be discarded when a newer validation supersedes them.
  const errors = new Map<string, ValidationError>();
  const pendingTokens = new Map<string, number>();
  let tokenCounter = 0;

  const plugin: GridPlugin = {
    name: 'validation',

    init(ctx) {
      const grid = ctx.grid;

      const getRow = (dataIndex: number): Row | null => {
        const snap = grid.data;
        return snap[dataIndex] ?? null;
      };

      // Resolve a view-row to a data-row. Returns null if the view index is
      // out of range — public APIs treat that as a no-op rather than throwing.
      const safeViewToData = (rowIndex: number): number | null => {
        const map = grid.indexMap.get();
        if (rowIndex < 0 || rowIndex >= map.length) return null;
        return map.viewToData(rowIndex);
      };

      const buildContext = (
        rowIndex: number,
        dataIndex: number,
        columnId: string,
        row: Row,
        originalValue: CellValue,
      ): ValidationContext => ({ rowIndex, dataIndex, columnId, row, originalValue });

      const emitChange = (): void => {
        ctx.events.emit('validation:change', { errors: Array.from(errors.values()) });
      };

      /**
       * Merge-or-remove a cell's error record. Returns true if anything
       * changed so callers can skip emitting `validation:change` on no-ops.
       */
      const recordError = (error: ValidationError | null, entryKey: string): boolean => {
        if (!error) {
          if (!errors.has(entryKey)) return false;
          errors.delete(entryKey);
          return true;
        }
        const prev = errors.get(entryKey);
        if (
          prev &&
          prev.state === error.state &&
          prev.message === error.message &&
          valuesEqual(prev.value, error.value)
        ) {
          return false;
        }
        errors.set(entryKey, error);
        return true;
      };

      const runSyncValidator = (
        validator: SyncValidator,
        value: CellValue,
        vctx: ValidationContext,
      ): ValidationResult => {
        try {
          return validator(value, vctx);
        } catch (err) {
          // A thrown validator is treated as a failure rather than a crash —
          // same user intent as returning a message. The exception message
          // surfaces so the author can diagnose.
          return err instanceof Error ? err.message : 'Validator threw';
        }
      };

      const kickoffAsync = (
        validator: AsyncValidator,
        value: CellValue,
        vctx: ValidationContext,
        entryKey: string,
      ): Promise<ValidationResult> => {
        const token = ++tokenCounter;
        pendingTokens.set(entryKey, token);

        // Mark as pending (unless a sync error already sits here — sync error
        // takes precedence in the UI; pending is only surfaced when no other
        // verdict is known).
        if (!errors.has(entryKey)) {
          errors.set(entryKey, {
            dataIndex: vctx.dataIndex,
            columnId: vctx.columnId,
            message: '',
            value,
            state: 'pending',
          });
          emitChange();
        }

        return Promise.resolve()
          .then(() => validator(value, vctx))
          .catch(
            (err): ValidationResult => (err instanceof Error ? err.message : 'Validator threw'),
          )
          .then((result) => {
            // Only apply if we're still the latest attempt; otherwise silently drop.
            if (pendingTokens.get(entryKey) !== token) return result;
            pendingTokens.delete(entryKey);

            if (result === true) {
              // Clear any pending/invalid record owned by this async pass. If
              // a sync error was recorded separately, leave it alone.
              const prev = errors.get(entryKey);
              if (prev && (prev.state === 'pending' || prev.message === '')) {
                errors.delete(entryKey);
                emitChange();
              }
            } else {
              const changed = recordError(
                {
                  dataIndex: vctx.dataIndex,
                  columnId: vctx.columnId,
                  message: result,
                  value,
                  state: 'invalid',
                },
                entryKey,
              );
              if (changed) emitChange();
            }
            return result;
          });
      };

      // ── Internal core: takes a resolved data-index and column. ──
      // Both the public view-keyed APIs and the data-keyed internal callers
      // (validateAll, data:change handler) funnel through these so the
      // viewToData round-trip happens at most once per call.

      const runSyncCore = (
        rowIndex: number,
        dataIndex: number,
        col: ColumnDef,
        value: CellValue,
      ): { result: ValidationResult; vctx: ValidationContext } | null => {
        const row = getRow(dataIndex);
        if (!row) return null;

        const entryKey = key(dataIndex, col.id);
        const vctx = buildContext(rowIndex, dataIndex, col.id, row, row[col.id]);

        let syncResult: ValidationResult = true;
        if (col.validate) {
          syncResult = runSyncValidator(col.validate, value, vctx);
        }

        if (syncResult !== true) {
          // Abort any in-flight async — its result would race with the
          // newer sync verdict and has been superseded.
          pendingTokens.delete(entryKey);
          const changed = recordError(
            {
              dataIndex,
              columnId: col.id,
              message: syncResult,
              value,
              state: 'invalid',
            },
            entryKey,
          );
          if (changed) emitChange();
        } else {
          // Sync passed: clear any sync-originated error; async pending/error
          // remains if one is in flight.
          const prev = errors.get(entryKey);
          if (prev && prev.state !== 'pending') {
            const changed = recordError(null, entryKey);
            if (changed) emitChange();
          }
        }

        return { result: syncResult, vctx };
      };

      const runAsyncCore = async (
        rowIndex: number,
        dataIndex: number,
        col: ColumnDef,
        value: CellValue,
      ): Promise<ValidationResult> => {
        const sync = runSyncCore(rowIndex, dataIndex, col, value);
        if (!sync) return true;
        if (sync.result !== true) return sync.result;
        if (!col.asyncValidate) return true;
        return kickoffAsync(col.asyncValidate, value, sync.vctx, key(dataIndex, col.id));
      };

      const api: ValidationPluginApi = {
        validateCell(rowIndex, columnId, value) {
          const cols = grid.columns.get();
          const col = findColumn(cols, columnId);
          if (!cellIsValidatable(col)) return true;

          const dataIndex = safeViewToData(rowIndex);
          if (dataIndex === null) return true;

          const row = getRow(dataIndex);
          if (!row) return true;

          const currentValue = value === undefined ? row[columnId] : value;
          const sync = runSyncCore(rowIndex, dataIndex, col, currentValue);
          if (!sync) return true;

          if (col.asyncValidate && sync.result === true) {
            // Fire-and-forget — caller doesn't await. Swallow promise.
            void kickoffAsync(col.asyncValidate, currentValue, sync.vctx, key(dataIndex, col.id));
          }
          return sync.result;
        },

        async validateCellAsync(rowIndex, columnId, value) {
          const cols = grid.columns.get();
          const col = findColumn(cols, columnId);
          if (!cellIsValidatable(col)) return true;

          const dataIndex = safeViewToData(rowIndex);
          if (dataIndex === null) return true;

          const row = getRow(dataIndex);
          if (!row) return true;

          const currentValue = value === undefined ? row[columnId] : value;
          return runAsyncCore(rowIndex, dataIndex, col, currentValue);
        },

        async validateAll() {
          const cols = grid.columns.get();
          const snap = grid.data;
          const indexMap = grid.indexMap.get();
          const promises: Promise<ValidationResult>[] = [];
          for (let dataIndex = 0; dataIndex < snap.length; dataIndex++) {
            const row = snap[dataIndex];
            if (!row) continue;
            // Row may be filtered out — pass -1 as the view-row in the ctx so
            // consumers can detect "not currently visible". Errors are still
            // keyed by data-index, so they reappear when the filter relaxes.
            const rowIndex = indexMap.dataToView(dataIndex) ?? -1;
            for (const col of cols) {
              if (!cellIsValidatable(col)) continue;
              promises.push(runAsyncCore(rowIndex, dataIndex, col, row[col.id]));
            }
          }
          await Promise.all(promises);
          return Array.from(errors.values());
        },

        getError(rowIndex, columnId) {
          const dataIndex = safeViewToData(rowIndex);
          if (dataIndex === null) return null;
          return errors.get(key(dataIndex, columnId)) ?? null;
        },

        isPending(rowIndex, columnId) {
          const err = api.getError(rowIndex, columnId);
          return err?.state === 'pending';
        },

        getErrors() {
          return Array.from(errors.values());
        },

        clearErrors(rowIndex, columnId) {
          // No args → clear everything.
          if (rowIndex === undefined && columnId === undefined) {
            if (errors.size === 0 && pendingTokens.size === 0) return;
            errors.clear();
            pendingTokens.clear();
            emitChange();
            return;
          }

          // Column scope: only `columnId` provided.
          if (rowIndex === undefined && columnId !== undefined) {
            const suffix = `:${columnId}`;
            let changed = false;
            for (const k of Array.from(errors.keys())) {
              if (k.endsWith(suffix)) {
                errors.delete(k);
                pendingTokens.delete(k);
                changed = true;
              }
            }
            if (changed) emitChange();
            return;
          }

          // Cell or row scope — both need a resolvable view-row.
          const dataIndex = safeViewToData(rowIndex as number);
          if (dataIndex === null) return;

          if (columnId !== undefined) {
            const entryKey = key(dataIndex, columnId);
            if (!errors.has(entryKey) && !pendingTokens.has(entryKey)) return;
            errors.delete(entryKey);
            pendingTokens.delete(entryKey);
            emitChange();
            return;
          }

          // Row-scope clear: strip every key that starts with `${dataIndex}:`.
          const prefix = `${dataIndex}:`;
          let changed = false;
          for (const k of Array.from(errors.keys())) {
            if (k.startsWith(prefix)) {
              errors.delete(k);
              pendingTokens.delete(k);
              changed = true;
            }
          }
          if (changed) emitChange();
        },
      };

      ctx.expose('validation', api);

      // Cell decoration: invalid → red border + tooltip text via data-attr so a
      // React (or any) adapter can render a native title or custom tooltip.
      ctx.addCellDecorator(({ row, col }) => {
        const di = safeViewToData(row);
        if (di === null) return null;
        const err = errors.get(key(di, col));
        if (!err) return null;
        const attributes: Record<string, string> = { 'data-validation-state': err.state };
        if (err.state === 'pending') {
          return { className: 'gs-cell--validating', attributes };
        }
        attributes['data-validation-message'] = err.message;
        attributes['aria-invalid'] = 'true';
        // Native `title` is the fallback tooltip — the React adapter renders a
        // styled overlay on top of it, but consumers without the overlay still
        // see the error message on hover with zero extra code.
        attributes.title = err.message;
        return { className: 'gs-cell--invalid', attributes };
      });

      // When a cell's value changes outside the editing pipeline (clipboard
      // paste, fill handle, programmatic `setCell`/`setCellByDataIndex`),
      // re-run validation so decoration stays accurate. Validates by data
      // index so writes to currently-hidden rows are still re-checked.
      const unsubData = ctx.events.on('data:change', ({ changes }) => {
        const cols = grid.columns.get();
        const indexMap = grid.indexMap.get();
        for (const change of changes) {
          const col = findColumn(cols, change.col);
          if (!cellIsValidatable(col)) continue;
          const dataIndex = change.row;
          const row = getRow(dataIndex);
          if (!row) continue;
          const rowIndex = indexMap.dataToView(dataIndex) ?? -1;
          runSyncCore(rowIndex, dataIndex, col, change.newValue);
          if (col.asyncValidate) {
            const vctx = buildContext(rowIndex, dataIndex, col.id, row, row[col.id]);
            void kickoffAsync(col.asyncValidate, change.newValue, vctx, key(dataIndex, col.id));
          }
        }
      });

      return () => {
        unsubData();
        errors.clear();
        pendingTokens.clear();
      };
    },
  };

  return plugin;
}
