---
'@gridsmith/core': minor
'@gridsmith/react': minor
---

Add multi-level group headers. `ColumnDef` (and `GridColumnDef`) now accepts a `children` tree; headers render spanning cells above the leaf columns. New exports: `flattenColumns`, `getHeaderDepth`, `buildHeaderRows`, `setLeafWidth`, `HeaderCell`. `GridInstance` exposes the original tree as `columnDefs` alongside the flat `columns` signal and emits a `columnDefs:update` event. Data operations (sort/filter/edit) continue to operate on leaf columns only; reorder is disabled when groups are present.
