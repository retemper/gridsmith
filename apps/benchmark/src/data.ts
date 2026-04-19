import type { BenchmarkRow } from './types';

const FIRST_NAMES = [
  'Alex',
  'Jamie',
  'Robin',
  'Taylor',
  'Morgan',
  'Casey',
  'Jordan',
  'Riley',
  'Avery',
  'Quinn',
];
const LAST_NAMES = [
  'Kim',
  'Lee',
  'Park',
  'Choi',
  'Smith',
  'Jones',
  'Brown',
  'Wilson',
  'Garcia',
  'Rossi',
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRows(count: number, seed = 1): BenchmarkRow[] {
  const rand = mulberry32(seed);
  const rows = new Array<BenchmarkRow>(count);
  for (let i = 0; i < count; i++) {
    const firstName = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)] ?? 'Alex';
    const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)] ?? 'Kim';
    const year = 2015 + Math.floor(rand() * 10);
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    rows[i] = {
      id: i + 1,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
      age: 20 + Math.floor(rand() * 50),
      balance: Math.round(rand() * 1_000_000) / 100,
      active: rand() > 0.3,
      joined: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }
  return rows;
}
