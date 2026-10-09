import { Component } from '@angular/core';
import { LazyVirtualTableComponent } from './lazy-virtual-table/lazy-virtual-table.component';

@Component({
  selector: 'app-root',
  imports: [LazyVirtualTableComponent],
  template: `
    <main class="page">
      <header class="page-header">
        <h1>Customers</h1>
        <p>100,000 rows loaded lazily with PrimeNG virtual scroll — only the visible block is fetched from the API.</p>
      </header>
      <section class="card">
        <app-lazy-virtual-table />
      </section>
    </main>
  `,
  styles: `
    .page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
    .page-header h1 { margin: 0 0 .25rem; font-size: 2rem; }
    .page-header p { margin: 0 0 1.5rem; color: #64748b; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.04); padding: 1rem; }
  `,
})
export class App {}
