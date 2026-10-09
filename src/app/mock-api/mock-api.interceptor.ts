/**
 * Mock backend for GET /api/customers.
 * Serves 100,000 deterministically generated customers with sorting and offset/limit paging.
 * To use a real backend, remove this file and `withInterceptors([mockApiInterceptor])` in app.config.ts.
 */
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import type { Customer } from '../lazy-virtual-table/lazy-virtual-table.component';

const TOTAL = 100_000;
const LATENCY_MS = 300;

const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Aisha', 'Mohammed', 'Fatima', 'Ahmed', 'Priya', 'Arjun', 'Wei', 'Mei', 'Yuki', 'Hiroshi',
  'Sofia', 'Lucas', 'Emma', 'Noah', 'Olivia', 'Liam', 'Isabella', 'Mateo', 'Chloe', 'Omar'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Khan', 'Patel',
  'Sharma', 'Chen', 'Wang', 'Tanaka', 'Sato', 'Müller', 'Schmidt', 'Rossi', 'Silva', 'Santos', 'Nguyen', 'Kim',
  'Lee', 'Hassan', 'Ali', 'Martin', 'Bernard', 'Dubois', 'Novak', 'Ivanov'];
const COUNTRIES = ['United States', 'India', 'Germany', 'Japan', 'Brazil', 'United Kingdom', 'France', 'Canada',
  'Australia', 'Pakistan', 'China', 'Italy', 'Spain', 'Mexico', 'Netherlands', 'Sweden', 'South Korea',
  'Egypt', 'Nigeria', 'Argentina', 'Turkey', 'Poland', 'Vietnam', 'UAE'];
const COMPANY_A = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Hooli', 'Vandelay', 'Soylent', 'Tyrell',
  'Cyberdyne', 'Wonka', 'Aperture', 'Massive', 'Pied Piper', 'Gringotts', 'Monarch', 'Oscorp'];
const COMPANY_B = ['Industries', 'Corp', 'Labs', 'Systems', 'Holdings', 'Solutions', 'Group', 'Partners', 'Dynamics', 'Ltd'];

/** Small deterministic PRNG (mulberry32) so the dataset is identical on every load. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(): Customer[] {
  const rnd = mulberry32(42);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const out: Customer[] = new Array(TOTAL);
  for (let i = 0; i < TOTAL; i++) {
    out[i] = {
      id: i + 1,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      country: pick(COUNTRIES),
      company: `${pick(COMPANY_A)} ${pick(COMPANY_B)}`,
    };
  }
  return out;
}

let customers: Customer[] | undefined;
const sortedCache = new Map<string, Customer[]>();

function getSorted(sortField: string | null, sortOrder: number): Customer[] {
  customers ??= generate();
  if (!sortField || !(sortField in customers[0])) return customers;
  const key = `${sortField}:${sortOrder}`;
  let sorted = sortedCache.get(key);
  if (!sorted) {
    const f = sortField as keyof Customer;
    sorted = [...customers].sort((a, b) => {
      const av = a[f], bv = b[f];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return (cmp || a.id - b.id) * (sortOrder < 0 ? -1 : 1);
    });
    sortedCache.set(key, sorted);
  }
  return sorted;
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const path = req.url.split('?')[0];
  if (req.method !== 'GET' || !path.endsWith('/api/customers')) return next(req);

  const offset = Math.max(0, Number(req.params.get('offset') ?? 0) || 0);
  const limit = Math.max(0, Number(req.params.get('limit') ?? 50) || 50);
  const sortField = req.params.get('sortField');
  const sortOrder = Number(req.params.get('sortOrder') ?? 1) || 1;

  const all = getSorted(sortField, sortOrder);
  const body = { data: all.slice(offset, offset + limit), total: all.length };

  return of(new HttpResponse({ status: 200, body })).pipe(delay(LATENCY_MS));
};
