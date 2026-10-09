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

  loadCustomers(event: TableLazyLoadEvent): void {
    this.loading.set(true);

    const first = event.first ?? 0;
    const rows = event.rows ?? 50;

    let params = new HttpParams().set('offset', first).set('limit', rows);
    if (event.sortField) {
      params = params
        .set('sortField', String(event.sortField))
        .set('sortOrder', String(event.sortOrder ?? 1));
    }

    this.http.get<PageResponse<Customer>>('/api/customers', { params }).subscribe({
      next: (res) => {
        this.customers.update((current) => {
          // Make the array as long as the full dataset, then put the loaded block in its place
          const next =
            current.length === res.total ? [...current] : Array.from<Customer | undefined>({ length: res.total });
          next.splice(first, res.data.length, ...res.data);
          return next;
        });
        this.totalRecords.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
