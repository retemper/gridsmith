import type {
  CellValue,
  ColumnDef,
  FilterEntry,
  FilterOperator,
  FilterValue,
} from '@gridsmith/core';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';

// ─── Operator catalog per column type ──────────────────────

const TEXT_OPS: FilterOperator[] = ['contains', 'eq', 'startsWith', 'endsWith', 'regex'];
const NUMBER_OPS: FilterOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'];
const DATE_OPS: FilterOperator[] = ['eq', 'lt', 'gt', 'between'];
const SELECT_OPS: FilterOperator[] = ['in', 'notIn'];

const OP_LABELS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  between: 'between',
  contains: 'contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  regex: 'regex',
  in: 'includes',
  notIn: 'excludes',
};

function operatorsForColumn(column: ColumnDef): FilterOperator[] {
  switch (column.type) {
    case 'number':
      return NUMBER_OPS;
    case 'date':
      return DATE_OPS;
    case 'select':
      return SELECT_OPS;
    case 'text':
    default:
      return TEXT_OPS;
  }
}

// ─── Value parsing ─────────────────────────────────────────

function parseInputValue(column: ColumnDef, raw: string): CellValue {
  if (raw === '') return null;
  switch (column.type) {
    case 'number': {
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    }
    case 'date': {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    default:
      return raw;
  }
}

function formatInputValue(column: ColumnDef, value: CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) {
    // Use YYYY-MM-DD for <input type="date">
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value);
}

function inputTypeFor(column: ColumnDef): string {
  if (column.type === 'number') return 'number';
  if (column.type === 'date') return 'date';
  return 'text';
}

// ─── Component ─────────────────────────────────────────────

export interface FilterPopoverProps {
  column: ColumnDef;
  entry: FilterEntry | null;
  style?: CSSProperties;
  onApply: (entry: FilterEntry | null) => void;
  onClose: () => void;
}

export function FilterPopover({ column, entry, style, onApply, onClose }: FilterPopoverProps) {
  const ops = useMemo(() => operatorsForColumn(column), [column]);
  const [operator, setOperator] = useState<FilterOperator>(() => entry?.operator ?? ops[0]);

  // Keep editable state local and commit via onApply.
  const [value1, setValue1] = useState(() => {
    const v = entry?.value;
    if (Array.isArray(v)) return formatInputValue(column, v[0] ?? null);
    if (operator === 'in' || operator === 'notIn') return '';
    return formatInputValue(column, (v as CellValue) ?? null);
  });
  const [value2, setValue2] = useState(() => {
    const v = entry?.value;
    if (Array.isArray(v)) return formatInputValue(column, v[1] ?? null);
    return '';
  });

  // `in`/`notIn` accept a comma-separated list of candidates. A textarea keeps
  // the UI simple and avoids a chips component for M1.
  const [listText, setListText] = useState(() => {
    if (!entry || (entry.operator !== 'in' && entry.operator !== 'notIn')) return '';
    return Array.isArray(entry.value)
      ? (entry.value as CellValue[]).map((v) => (v == null ? '' : String(v))).join(', ')
      : '';
  });

  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape. Using `mousedown` ensures we capture the
  // click before the target element gets focus, which matters for the "click
  // another filter button" case.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (e.target instanceof Node && rootRef.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleApply = () => {
    const columnId = column.id;
    let filterValue: FilterValue;

    if (operator === 'between') {
      const v1 = parseInputValue(column, value1);
      const v2 = parseInputValue(column, value2);
      if (v1 == null || v2 == null) {
        onApply(null);
        return;
      }
      filterValue = [v1, v2];
    } else if (operator === 'in' || operator === 'notIn') {
      const items = listText
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => parseInputValue(column, s))
        .filter((v): v is CellValue => v !== null);
      if (items.length === 0) {
        onApply(null);
        return;
      }
      filterValue = items;
    } else {
      const v = parseInputValue(column, value1);
      // `regex` accepts an empty pattern only when the user explicitly cleared
      // the filter via the Clear button; an empty value through Apply is a
      // clear signal.
      if (v == null && operator !== 'eq' && operator !== 'neq') {
        onApply(null);
        return;
      }
      filterValue = v;
    }

    onApply({ columnId, operator, value: filterValue });
  };

  const handleClear = () => onApply(null);

  // ─── Render input fields based on operator ───────────

  const renderInputs = () => {
    if (operator === 'in' || operator === 'notIn') {
      return (
        <textarea
          className="gs-filter-input"
          rows={2}
          placeholder="Comma-separated values"
          value={listText}
          onChange={(e) => setListText(e.target.value)}
        />
      );
    }

    if (operator === 'between') {
      return (
        <div className="gs-filter-range">
          <input
            className="gs-filter-input"
            type={inputTypeFor(column)}
            value={value1}
            onChange={(e) => setValue1(e.target.value)}
            placeholder="from"
          />
          <input
            className="gs-filter-input"
            type={inputTypeFor(column)}
            value={value2}
            onChange={(e) => setValue2(e.target.value)}
            placeholder="to"
          />
        </div>
      );
    }

    // regex always takes a string input; other single-value operators use the
    // column-type input.
    const type = operator === 'regex' ? 'text' : inputTypeFor(column);
    return (
      <input
        className="gs-filter-input"
        type={type}
        value={value1}
        onChange={(e) => setValue1(e.target.value)}
        placeholder={operator === 'regex' ? 'regex pattern' : 'value'}
        autoFocus
      />
    );
  };

  return (
    <div
      ref={rootRef}
      className="gs-filter-popover"
      role="dialog"
      aria-label={`Filter ${column.header}`}
      style={{
        position: 'absolute',
        zIndex: 20,
        background: 'white',
        border: '1px solid #ccc',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 180,
        ...style,
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // Stop propagation so the grid root's keydown handler doesn't
          // react to Enter here (which, with a cell focused, would begin an
          // edit / toggle a checkbox / delete a value).
          e.stopPropagation();
          e.preventDefault();
          handleApply();
        }
      }}
    >
      <select
        className="gs-filter-operator"
        value={operator}
        onChange={(e) => setOperator(e.target.value as FilterOperator)}
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </select>
      {renderInputs()}
      <div className="gs-filter-actions" style={{ display: 'flex', gap: 4 }}>
        <button type="button" className="gs-filter-apply" onClick={handleApply}>
          Apply
        </button>
        <button type="button" className="gs-filter-clear" onClick={handleClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
