import type { CellValue, EditingPluginApi, GridInstance, SelectOption } from '@gridsmith/core';
import {
  type CSSProperties,
  type CompositionEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { CellEditorProps, GridColumnDef } from './types';

// ─── Shared style & key handler ────────────────────────────

const EDITOR_INPUT_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  border: 'none',
  outline: 'none',
  padding: 'inherit',
  font: 'inherit',
  boxSizing: 'border-box',
  background: 'var(--gs-editor-bg, #fff)',
};

/**
 * Detect whether a keydown event occurred mid-IME composition.
 *
 * CJK IMEs (Korean/Japanese/Chinese) fire synthetic Enter/keydown events to
 * commit composition. Without this guard, the editor would prematurely commit
 * the cell on the final composition keystroke, dropping the composed character
 * or trailing half-composed text. Belt-and-suspenders: check the standard
 * `isComposing` flag, the legacy `keyCode === 229` sentinel, AND a ref
 * driven by `compositionstart`/`compositionend` events.
 */
function isComposingEvent(
  e: KeyboardEvent<HTMLElement>,
  composingRef: MutableRefObject<boolean>,
): boolean {
  return composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229;
}

interface EditorKeyCallbacks {
  onCancel: () => void;
  onTab: (shift: boolean) => void;
  onEnter: (shift: boolean) => void;
}

function useEditorKeyHandler(
  callbacks: EditorKeyCallbacks,
  composingRef: MutableRefObject<boolean>,
) {
  const { onCancel, onTab, onEnter } = callbacks;
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      // Ignore Enter/Tab while an IME composition is in-flight; the IME owns
      // those keys for confirming candidate text. Escape still works so users
      // can bail out.
      if (e.key === 'Enter') {
        if (isComposingEvent(e, composingRef)) return;
        e.preventDefault();
        onEnter(e.shiftKey);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        if (isComposingEvent(e, composingRef)) return;
        e.preventDefault();
        onTab(e.shiftKey);
      }
    },
    [onCancel, onTab, onEnter, composingRef],
  );
}

function useCompositionHandlers(composingRef: MutableRefObject<boolean>) {
  const onCompositionStart = useCallback(
    (_e: CompositionEvent<HTMLElement>) => {
      composingRef.current = true;
    },
    [composingRef],
  );
  const onCompositionEnd = useCallback(
    (_e: CompositionEvent<HTMLElement>) => {
      composingRef.current = false;
    },
    [composingRef],
  );
  return { onCompositionStart, onCompositionEnd };
}

// ─── Built-in editor inputs ─────────────────────────────────

interface InputEditorProps {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onTab: (shift: boolean) => void;
  onEnter: (shift: boolean) => void;
}

function TextEditor({ value, onChange, onCommit, onCancel, onTab, onEnter }: InputEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const onKeyDown = useEditorKeyHandler({ onCancel, onTab, onEnter }, composingRef);
  const { onCompositionStart, onCompositionEnd } = useCompositionHandlers(composingRef);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <input
      ref={inputRef}
      className="gs-editor-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
      onBlur={onCommit}
      style={EDITOR_INPUT_STYLE}
    />
  );
}

function NumberEditor({ value, onChange, onCommit, onCancel, onTab, onEnter }: InputEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const onKeyDown = useEditorKeyHandler({ onCancel, onTab, onEnter }, composingRef);
  const { onCompositionStart, onCompositionEnd } = useCompositionHandlers(composingRef);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <input
      ref={inputRef}
      className="gs-editor-input"
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
      onBlur={onCommit}
      style={EDITOR_INPUT_STYLE}
    />
  );
}

interface SelectEditorProps extends InputEditorProps {
  options: SelectOption[];
}

function SelectEditor({
  value,
  options,
  onChange,
  onCommit,
  onCancel,
  onTab,
  onEnter,
}: SelectEditorProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  // <select> has no IME composition path, so we hard-code a non-composing ref.
  const nonComposingRef = useRef(false);
  const onKeyDown = useEditorKeyHandler({ onCancel, onTab, onEnter }, nonComposingRef);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <select
      ref={selectRef}
      className="gs-editor-select"
      value={value}
      onChange={(e) => {
        // Auto-commit on selection change. `onChange` updates both local
        // React state and the plugin synchronously, so `onCommit` reads the
        // fresh value without needing a microtask deferral.
        onChange(e.target.value);
        onCommit();
      }}
      onKeyDown={onKeyDown}
      onBlur={onCommit}
      style={EDITOR_INPUT_STYLE}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={String(opt.value)}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function DateEditor({ value, onChange, onCommit, onCancel, onTab, onEnter }: InputEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // <input type="date"> is a native picker; no IME composition flows through it.
  const nonComposingRef = useRef(false);
  const onKeyDown = useEditorKeyHandler({ onCancel, onTab, onEnter }, nonComposingRef);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      className="gs-editor-input"
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onCommit}
      style={EDITOR_INPUT_STYLE}
    />
  );
}

// ─── Main CellEditor ────────────────────────────────────────

interface CellEditorOverlayProps {
  grid: GridInstance;
  editingApi: EditingPluginApi;
  columns: GridColumnDef[];
  columnIndex: number;
  rowIndex: number;
  editValue: CellValue;
  columnId: string;
  style: CSSProperties;
  /**
   * Called after Enter commits the edit. The grid moves the focused cell
   * vertically (without opening a new editor) to mirror Excel's Enter/Shift+Enter.
   */
  onCommitAndMoveVertical: (shift: boolean) => void;
}

export const CellEditorOverlay = memo(function CellEditorOverlay({
  grid,
  editingApi,
  columns,
  columnIndex,
  rowIndex,
  editValue,
  columnId,
  style,
  onCommitAndMoveVertical,
}: CellEditorOverlayProps) {
  const col = columns[columnIndex];
  const editorType = col?.editor ?? col?.type ?? 'text';
  const editor = editingApi.getEditor(editorType);

  // Format the initial value for display in the editor.
  const initialDisplay = editor?.format
    ? editor.format(editValue)
    : editValue == null
      ? ''
      : String(editValue);

  // Local state holds the in-flight editor value so React can keep the
  // controlled input in sync with user typing. Plugin state is kept up to date
  // on every keystroke so `commitEdit()` reads the latest value.
  const [localValue, setLocalValue] = useState(initialDisplay);

  const handleChange = useCallback(
    (v: string) => {
      setLocalValue(v);
      editingApi.setValue(v);
    },
    [editingApi],
  );

  const handleCommit = useCallback(() => {
    editingApi.commitEdit();
  }, [editingApi]);

  const handleCancel = useCallback(() => {
    editingApi.cancelEdit();
  }, [editingApi]);

  const handleEnter = useCallback(
    (shift: boolean) => {
      onCommitAndMoveVertical(shift);
    },
    [onCommitAndMoveVertical],
  );

  const handleTab = useCallback(
    (shift: boolean) => {
      // Commit current edit first.
      editingApi.commitEdit();

      // Find next editable, visible column.
      const editableColumns = columns
        .map((c, i) => ({ col: c, index: i }))
        .filter((x) => x.col.visible !== false && x.col.editable !== false);

      const currentIdx = editableColumns.findIndex((x) => x.col.id === columnId);
      if (currentIdx === -1) return;

      let nextRow = rowIndex;
      let nextEditableIdx: number;

      if (shift) {
        nextEditableIdx = currentIdx - 1;
        if (nextEditableIdx < 0) {
          nextEditableIdx = editableColumns.length - 1;
          nextRow = Math.max(0, rowIndex - 1);
        }
      } else {
        nextEditableIdx = currentIdx + 1;
        if (nextEditableIdx >= editableColumns.length) {
          nextEditableIdx = 0;
          nextRow = Math.min(grid.rowCount - 1, rowIndex + 1);
        }
      }

      const next = editableColumns[nextEditableIdx];
      if (next) {
        editingApi.beginEdit(nextRow, next.col.id);
      }
    },
    [editingApi, columns, columnId, rowIndex, grid],
  );

  // Guard after all hooks to keep hook order stable.
  if (!col) return null;

  // Custom editor: let the caller render whatever React node they want.
  if (col.cellEditor) {
    const row: Record<string, CellValue> = {};
    for (const c of columns) {
      row[c.id] = grid.getCell(rowIndex, c.id);
    }

    const editorProps: CellEditorProps = {
      value: editValue,
      row,
      rowIndex,
      column: col,
      commit: (value: CellValue) => {
        editingApi.setValue(value);
        editingApi.commitEdit();
      },
      cancel: handleCancel,
    };

    return (
      <div className="gs-cell-editor" style={style}>
        {col.cellEditor(editorProps)}
      </div>
    );
  }

  // Checkbox is toggled inline by the Grid component; no overlay.
  if (editorType === 'checkbox') return null;

  let editorElement: ReactNode;

  if (editorType === 'select') {
    editorElement = (
      <SelectEditor
        value={localValue}
        options={col.selectOptions ?? []}
        onChange={handleChange}
        onCommit={handleCommit}
        onCancel={handleCancel}
        onTab={handleTab}
        onEnter={handleEnter}
      />
    );
  } else if (editorType === 'date') {
    editorElement = (
      <DateEditor
        value={localValue}
        onChange={handleChange}
        onCommit={handleCommit}
        onCancel={handleCancel}
        onTab={handleTab}
        onEnter={handleEnter}
      />
    );
  } else if (editorType === 'number') {
    editorElement = (
      <NumberEditor
        value={localValue}
        onChange={handleChange}
        onCommit={handleCommit}
        onCancel={handleCancel}
        onTab={handleTab}
        onEnter={handleEnter}
      />
    );
  } else {
    editorElement = (
      <TextEditor
        value={localValue}
        onChange={handleChange}
        onCommit={handleCommit}
        onCancel={handleCancel}
        onTab={handleTab}
        onEnter={handleEnter}
      />
    );
  }

  return (
    <div className="gs-cell-editor" style={style}>
      {editorElement}
    </div>
  );
});
