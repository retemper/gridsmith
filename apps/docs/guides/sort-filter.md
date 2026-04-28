# Sort & Filter

Click headers to sort. Use the per-column filter button for type-aware filters.

## Sorting

- Click a header — cycles `asc → desc → none`.
- `Shift+click` a header — composes a multi-column sort.
- Sort indicators (`▲` / `▼`) appear next to the header label, with a number for multi-sort order.
- `aria-sort` is populated on the header cell.

Opt out per column:

```ts
{ id: 'actions', header: 'Actions', sortable: false }
```

### Custom comparators

Two layers of override:

```ts
// Per-column
{
  id: 'priority',
  header: 'Priority',
  comparator: (a, b) => priorityRank(a) - priorityRank(b),
}
```

```ts
// Per-sort entry (overrides column comparator)
const sortState: SortState = [
  { columnId: 'priority', direction: 'desc', comparator: customCompare },
];
```

`CellComparator` signature:

```ts
type CellComparator = (a: CellValue, b: CellValue) => number;
```

Date comparison uses `getTime()` internally — locale-independent.

## Filtering

Each column has a filter button that opens a type-aware popover. Operators:

| Type       | Operators                                                                 |
| ---------- | ------------------------------------------------------------------------- |
| `text`     | `contains`, `eq`, `neq`, `startsWith`, `endsWith`, `regex`, `in`, `notIn` |
| `number`   | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `notIn`           |
| `date`     | `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `between`                          |
| `select`   | `eq`, `neq`, `in`, `notIn`                                                |
| `checkbox` | `eq`                                                                      |

The full `FilterOperator` union: `'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'in' | 'notIn'`. For dates, `lt` / `gt` mean "before" / "after".

Opt out per column:

```ts
{ id: 'avatar', header: '', filterable: false }
```

### `FilterValue` shape

```ts
type FilterValue = CellValue | readonly CellValue[] | RegExp;
```

- `between` takes `[min, max]`
- `in` / `notIn` take arrays
- `regex` takes either a string pattern or a `RegExp` instance

When reading `entry.value`, narrow the union before using it as a `CellValue`:

```ts
if (Array.isArray(entry.value)) {
  /* between or in */
} else if (entry.value instanceof RegExp) {
  /* regex */
} else {
  /* CellValue */
}
```

## Controlled state

`sortState` and `filterState` are controllable:

```tsx
const [sort, setSort] = useState<SortState>([]);
const [filter, setFilter] = useState<FilterState>([]);

<Grid
  data={data}
  columns={columns}
  sortState={sort}
  filterState={filter}
  onSortChange={setSort}
  onFilterChange={setFilter}
/>;
```

Skip these props for default uncontrolled behavior.

## Server-side

For server-side sort / filter, use the [Async Data](./async-data) plugin with `serverSideSort` / `serverSideFilter`. Sort and filter state are passed to your `getRows` / `getRowCount`.

## Events

| Event           | Payload      |
| --------------- | ------------ |
| `sort:change`   | `{ sort }`   |
| `filter:change` | `{ filter }` |

## Related

- [Async Data](./async-data) — server-side sort/filter.
- [Selection](./selection) — auto-clears on sort/filter change.
