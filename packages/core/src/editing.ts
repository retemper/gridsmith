import type {
  CellValue,
  EditorDefinition,
  EditingPluginApi,
  EditState,
  GridPlugin,
  ValidationPluginApi,
} from './types';

const builtinEditors: EditorDefinition[] = [
  {
    name: 'text',
    parse: (raw) => raw,
    format: (v) => (v == null ? '' : String(v)),
  },
  {
    name: 'number',
    parse: (raw) => {
      if (raw === '' || raw === '-') return null;
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    },
    format: (v) => (v == null ? '' : String(v)),
  },
  {
    name: 'checkbox',
    parse: (raw) => raw === 'true',
    format: (v) => String(Boolean(v)),
  },
  {
    name: 'date',
    parse: (raw) => {
      if (!raw) return null;
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    },
    format: (v) => {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (v == null) return '';
      return String(v);
    },
  },
  {
    name: 'select',
    parse: (raw) => raw,
    format: (v) => (v == null ? '' : String(v)),
  },
];

export function createEditingPlugin(): GridPlugin {
  const editors = new Map<string, EditorDefinition>();
  for (const ed of builtinEditors) {
    editors.set(ed.name, ed);
  }

  let editState: EditState | null = null;

  const plugin: GridPlugin = {
    name: 'editing',

    init(ctx) {
      const api: EditingPluginApi = {
        beginEdit(rowIndex, columnId, initialChar) {
          const cols = ctx.grid.columns.get();
          const col = cols.find((c) => c.id === columnId);
          if (!col || col.editable === false) return false;

          // Auto-commit current edit before starting a new one
          if (editState) {
            api.commitEdit();
          }

          const originalValue = ctx.grid.getCell(rowIndex, columnId);

          let value: CellValue;
          if (initialChar !== undefined) {
            // Type-to-edit: start with the typed character
            value = initialChar;
          } else {
            value = originalValue;
          }

          editState = { rowIndex, columnId, value, originalValue };
          ctx.events.emit('edit:begin', { ...editState });
          return true;
        },

        commitEdit() {
          if (!editState) return false;

          const { rowIndex, columnId, value, originalValue } = editState;
          const cols = ctx.grid.columns.get();
          const col = cols.find((c) => c.id === columnId);
          const editorName = col?.editor ?? col?.type ?? 'text';
          const editor = editors.get(editorName);

          // Parse string values through editor
          let finalValue = value;
          if (typeof value === 'string' && editor?.parse) {
            finalValue = editor.parse(value);
          }

          // Validation. Only runs when a validation plugin is registered and
          // the column declares a validator. Sync failures in `reject` mode
          // abort the commit; `warn` commits the value and leaves the error
          // recorded by the plugin so the UI can flag it.
          const validationApi = ctx.getPlugin<ValidationPluginApi>('validation');
          if (validationApi && (col?.validate || col?.asyncValidate)) {
            const result = validationApi.validateCell(rowIndex, columnId, finalValue);
            const mode = col?.validationMode ?? 'reject';
            if (result !== true && mode === 'reject') {
              // `validateCell` recorded the transient failure for `finalValue`,
              // but reject-mode never commits that value — so the recorded
              // error would mislabel the cell. Resync by revalidating against
              // the value that actually stays in the cell (the pre-edit one).
              // If the pre-edit value is itself invalid (e.g. malformed seed
              // data), the cell remains flagged — intentional, since the cell
              // really does still hold an invalid value.
              validationApi.validateCell(rowIndex, columnId, originalValue);
              editState = null;
              ctx.events.emit('edit:cancel', { rowIndex, columnId });
              return false;
            }
          }

          editState = null;

          ctx.grid.setCell(rowIndex, columnId, finalValue);
          ctx.events.emit('edit:commit', {
            rowIndex,
            columnId,
            oldValue: originalValue,
            newValue: finalValue,
          });
          return true;
        },

        cancelEdit() {
          if (!editState) return;
          const { rowIndex, columnId } = editState;
          editState = null;
          ctx.events.emit('edit:cancel', { rowIndex, columnId });
        },

        getEditState() {
          return editState ? { ...editState } : null;
        },

        isEditing() {
          return editState !== null;
        },

        defineEditor(def) {
          editors.set(def.name, def);
        },

        getEditor(name) {
          return editors.get(name);
        },

        setValue(value) {
          if (!editState) return;
          editState = { ...editState, value };
        },
      };

      ctx.expose('editing', api);

      ctx.addCellDecorator(({ row, col }) => {
        if (editState && editState.rowIndex === row && editState.columnId === col) {
          return { className: 'gs-cell--editing' };
        }
        return null;
      });

      return () => {
        editState = null;
      };
    },
  };

  return plugin;
}
