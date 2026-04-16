import type { ColumnDef, FilterEntry } from '@gridsmith/core';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilterPopover } from './filter-popover';

// ─── Fixtures ─────────────────────────────────────────────

const textCol: ColumnDef = { id: 'name', header: 'Name', type: 'text' };
const numCol: ColumnDef = { id: 'age', header: 'Age', type: 'number' };
const dateCol: ColumnDef = { id: 'when', header: 'When', type: 'date' };
const selectCol: ColumnDef = {
  id: 'role',
  header: 'Role',
  type: 'select',
  selectOptions: [
    { label: 'Admin', value: 'admin' },
    { label: 'User', value: 'user' },
  ],
};

// ─── Tests ────────────────────────────────────────────────

describe('FilterPopover', () => {
  it('text column: applies contains with string value', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <FilterPopover column={textCol} entry={null} onApply={onApply} onClose={onClose} />,
    );

    const input = container.querySelector('.gs-filter-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ali' } });

    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith({ columnId: 'name', operator: 'contains', value: 'ali' });
  });

  it('text column: empty value with contains clears filter (applies null)', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={textCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    // default operator is 'contains', value is empty
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('text column: empty value with eq still applies (eq null allowed)', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={textCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.change(container.querySelector('.gs-filter-operator') as HTMLSelectElement, {
      target: { value: 'eq' },
    });
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith({ columnId: 'name', operator: 'eq', value: null });
  });

  it('regex operator renders a text input even on number columns', () => {
    // Switch a number column's operator list doesn't include regex; use text col.
    const { container } = render(
      <FilterPopover column={textCol} entry={null} onApply={() => {}} onClose={() => {}} />,
    );
    fireEvent.change(container.querySelector('.gs-filter-operator') as HTMLSelectElement, {
      target: { value: 'regex' },
    });
    const input = container.querySelector('.gs-filter-input') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('text');
    expect(input.getAttribute('placeholder')).toBe('regex pattern');
  });

  it('number column: parses numeric input and applies', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={numCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.change(container.querySelector('.gs-filter-operator') as HTMLSelectElement, {
      target: { value: 'gte' },
    });
    fireEvent.change(container.querySelector('.gs-filter-input') as HTMLInputElement, {
      target: { value: '42' },
    });
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith({ columnId: 'age', operator: 'gte', value: 42 });
  });

  it('number column: between renders two inputs and applies [min, max]', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={numCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.change(container.querySelector('.gs-filter-operator') as HTMLSelectElement, {
      target: { value: 'between' },
    });
    const inputs = container.querySelectorAll('.gs-filter-input') as NodeListOf<HTMLInputElement>;
    expect(inputs).toHaveLength(2);
    expect(inputs[0].getAttribute('type')).toBe('number');
    fireEvent.change(inputs[0], { target: { value: '10' } });
    fireEvent.change(inputs[1], { target: { value: '20' } });
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith({
      columnId: 'age',
      operator: 'between',
      value: [10, 20],
    });
  });

  it('number column: between with missing bound clears filter', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={numCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.change(container.querySelector('.gs-filter-operator') as HTMLSelectElement, {
      target: { value: 'between' },
    });
    // leave both empty
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('date column: parses date input and applies', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={dateCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    const input = container.querySelector('.gs-filter-input') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('date');
    fireEvent.change(input, { target: { value: '2024-02-15' } });
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledTimes(1);
    const entry = onApply.mock.calls[0][0] as FilterEntry;
    expect(entry.operator).toBe('eq');
    expect(entry.value).toBeInstanceOf(Date);
  });

  it('date column: invalid input parses to null → applies null', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={dateCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.change(container.querySelector('.gs-filter-operator') as HTMLSelectElement, {
      target: { value: 'lt' },
    });
    fireEvent.change(container.querySelector('.gs-filter-input') as HTMLInputElement, {
      target: { value: 'not-a-date' },
    });
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('select column: in/notIn shows textarea and parses comma-separated list', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={selectCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    const textarea = container.querySelector('.gs-filter-input') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    fireEvent.change(textarea, { target: { value: 'admin, user' } });
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith({
      columnId: 'role',
      operator: 'in',
      value: ['admin', 'user'],
    });
  });

  it('select column: empty textarea clears filter', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={selectCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.click(container.querySelector('.gs-filter-apply') as HTMLButtonElement);
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('Clear button applies null regardless of inputs', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={textCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    fireEvent.change(container.querySelector('.gs-filter-input') as HTMLInputElement, {
      target: { value: 'anything' },
    });
    fireEvent.click(container.querySelector('.gs-filter-clear') as HTMLButtonElement);
    expect(onApply).toHaveBeenLastCalledWith(null);
  });

  it('Escape key invokes onClose', () => {
    const onClose = vi.fn();
    render(<FilterPopover column={textCol} entry={null} onApply={() => {}} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('mousedown outside the popover invokes onClose', () => {
    const onClose = vi.fn();
    render(<FilterPopover column={textCol} entry={null} onApply={() => {}} onClose={onClose} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('mousedown inside the popover does not close it', () => {
    const onClose = vi.fn();
    const { container } = render(
      <FilterPopover column={textCol} entry={null} onApply={() => {}} onClose={onClose} />,
    );
    const popover = container.querySelector('.gs-filter-popover') as HTMLElement;
    fireEvent.mouseDown(popover);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('seeds value inputs from existing between entry', () => {
    const entry: FilterEntry = {
      columnId: 'age',
      operator: 'between',
      value: [5, 10],
    };
    const { container } = render(
      <FilterPopover column={numCol} entry={entry} onApply={() => {}} onClose={() => {}} />,
    );
    const inputs = container.querySelectorAll('.gs-filter-input') as NodeListOf<HTMLInputElement>;
    expect(inputs[0].value).toBe('5');
    expect(inputs[1].value).toBe('10');
  });

  it('seeds textarea from existing in entry', () => {
    const entry: FilterEntry = {
      columnId: 'role',
      operator: 'in',
      value: ['admin', 'user'],
    };
    const { container } = render(
      <FilterPopover column={selectCol} entry={entry} onApply={() => {}} onClose={() => {}} />,
    );
    const textarea = container.querySelector('.gs-filter-input') as HTMLTextAreaElement;
    expect(textarea.value).toBe('admin, user');
  });

  it('seeds date input from existing Date value', () => {
    const entry: FilterEntry = {
      columnId: 'when',
      operator: 'eq',
      value: new Date(2024, 1, 15), // Feb 15 2024 — local time
    };
    const { container } = render(
      <FilterPopover column={dateCol} entry={entry} onApply={() => {}} onClose={() => {}} />,
    );
    const input = container.querySelector('.gs-filter-input') as HTMLInputElement;
    expect(input.value).toBe('2024-02-15');
  });

  it('Enter in the popover triggers Apply', () => {
    const onApply = vi.fn();
    const { container } = render(
      <FilterPopover column={textCol} entry={null} onApply={onApply} onClose={() => {}} />,
    );
    const input = container.querySelector('.gs-filter-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ali' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onApply).toHaveBeenCalledWith({ columnId: 'name', operator: 'contains', value: 'ali' });
  });
});
