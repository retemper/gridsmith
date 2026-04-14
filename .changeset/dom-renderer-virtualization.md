---
'@gridsmith/core': minor
---

Add DOM renderer with row/column virtualization

- `createRenderer()` mounts a virtualized grid into a container element
- Row virtualization with fixed height for O(1) position calculation
- Column virtualization with binary search for variable-width columns
- Overscan buffer for smooth scrolling
- ResizeObserver for container resize handling
- Row element pooling to minimize GC pressure
- Reactive: auto-updates on data, sort, filter, and column changes
