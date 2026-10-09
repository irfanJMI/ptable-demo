import { Component, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';

export interface Customer {
  id: number;
  name: string;
  country: string;
  company: string;
}

interface PageResponse<T> {
  data: T[];
  total: number;
}

@Component({
  selector: 'app-lazy-virtual-table',
  imports: [TableModule, SkeletonModule],
  templateUrl: './lazy-virtual-table.component.html',
})
export class LazyVirtualTableComponent {
  private http = inject(HttpClient);

  customers = signal<(Customer | undefined)[]>([]);
  totalRecords = signal(0);
  loading = signal(false);

  readonly cols = [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Name' },
    { field: 'country', header: 'Country' },
    { field: 'company', header: 'Company' },
  ];

  /** Sort key of the rows currently held in `customers`; a change means cached rows are stale. */
  private loadedSortKey = '';

  loadCustomers(event: TableLazyLoadEvent): void {
    this.loading.set(true);

    const first = event.first ?? 0;
    const rows = event.rows ?? 50;

    const sortKey = event.sortField ? `${String(event.sortField)}:${event.sortOrder ?? 1}` : '';
    if (sortKey !== this.loadedSortKey) {
      // Sort changed: throw away rows loaded in the old order
      this.loadedSortKey = sortKey;
      this.customers.update((current) => Array.from<Customer | undefined>({ length: current.length }));
    }

    // PrimeNG's scroller requests the *next* block a little early. After a jump (scrollbar drag,
    // fast wheel) the rows just above `first` can still be visible but never requested, so they
    // would stay as skeletons. Fetch the previous block too when it hasn't been loaded yet.
    const start = first > 0 && !this.customers()[first - 1] ? Math.max(0, first - rows) : first;
    const limit = first + rows - start;

    let params = new HttpParams().set('offset', start).set('limit', limit);
    if (event.sortField) {
      params = params
        .set('sortField', String(event.sortField))
        .set('sortOrder', String(event.sortOrder ?? 1));
    }

    this.http.get<PageResponse<Customer>>('/api/customers', { params }).subscribe({
      next: (res) => {
        if (sortKey !== this.loadedSortKey) return; // stale response from a previous sort
        this.customers.update((current) => {
          // Make the array as long as the full dataset, then put the loaded block in its place
          const next =
            current.length === res.total ? [...current] : Array.from<Customer | undefined>({ length: res.total });
          next.splice(start, res.data.length, ...res.data);
          return next;
        });
        this.totalRecords.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
