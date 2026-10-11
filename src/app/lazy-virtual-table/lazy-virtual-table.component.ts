import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Subject, catchError, debounceTime, filter, finalize, switchMap, tap } from 'rxjs';
import { Table, TableModule, TableLazyLoadEvent } from 'primeng/table';
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

const PAGE_SIZE = 50;
const ROW_HEIGHT = 46; // must match [virtualScrollItemSize] and the row height in the template
const SETTLE_MS = 150; // ignore the stream of onLazyLoad events while the user is dragging / flinging

@Component({
  selector: 'app-lazy-virtual-table',
  imports: [TableModule, SkeletonModule],
  templateUrl: './lazy-virtual-table.component.html',
})
export class LazyVirtualTableComponent {
  private http = inject(HttpClient);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);
  private table = viewChild(Table);

  /** Full-length array (scrollbar represents all rows); only the contiguous range [0, loadedCount) is filled. */
  customers = signal<(Customer | undefined)[]>([]);
  totalRecords = signal(0);
  loading = signal(false);
  loadedCount = signal(0);

  readonly cols = [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Name' },
    { field: 'country', header: 'Country' },
    { field: 'company', header: 'Company' },
  ];

  private lazyEvents = new Subject<TableLazyLoadEvent>();
  private sortKey = '';
  private requestSeq = 0;
  private inFlight?: { start: number; sortKey: string; snap: boolean };
  private snapSeq = 0;
  private lastScrollAt = 0;
  private scrollbarHeld = false;

  constructor() {
    // Debounce the onLazyLoad events; switchMap cancels (unsubscribes) a stale in-flight request.
    this.lazyEvents
      .pipe(
        debounceTime(SETTLE_MS),
        filter((event) => !this.isAlreadyRequested(event)),
        switchMap((event) => this.fetchNextPage(event)),
        takeUntilDestroyed(),
      )
      .subscribe();

    afterNextRender(() => this.trackUserScrolling());
  }

  loadCustomers(event: TableLazyLoadEvent): void {
    const sortKey = event.sortField ? `${String(event.sortField)}:${event.sortOrder ?? 1}` : '';
    if (sortKey !== this.sortKey) {
      // Sort changed: drop everything loaded in the old order, start again from the first page
      this.sortKey = sortKey;
      this.loadedCount.set(0);
      this.customers.update((current) => Array.from<Customer | undefined>({ length: current.length }));
    }
    this.lazyEvents.next(event);
  }

  /** The next page is already being fetched: keep that request (don't cancel + re-issue it). */
  private isAlreadyRequested(event: TableLazyLoadEvent): boolean {
    const f = this.inFlight;
    if (!f || f.start !== this.loadedCount() || f.sortKey !== this.sortKey) return false;
    if ((event.first ?? 0) > f.start) f.snap = true; // user has flung further meanwhile -> snap on arrival
    return true; // keep it even if the user scrolled back: the page is still the next contiguous one
  }

  /**
   * Loaded data is always contiguous from the top, so the only page that is ever requested is the one
   * right after the last loaded row (offset = loadedCount). If the user flung / dragged far beyond it,
   * that same page is fetched and the scroll is moved to its first row afterwards.
   */
  private fetchNextPage(event: TableLazyLoadEvent) {
    const first = event.first ?? 0;
    const start = this.loadedCount();
    const seq = ++this.requestSeq;

    if (first < start || (this.totalRecords() > 0 && start >= this.totalRecords())) {
      this.loading.set(false); // already loaded (or everything loaded): nothing to fetch
      return EMPTY;
    }

    const sortKey = this.sortKey;
    // landed beyond the next page -> snap to it once it has arrived
    const flight = { start, sortKey, snap: first > start };
    this.inFlight = flight;

    let params = new HttpParams().set('offset', start).set('limit', PAGE_SIZE);
    if (event.sortField) {
      params = params
        .set('sortField', String(event.sortField))
        .set('sortOrder', String(event.sortOrder ?? 1));
    }

    this.loading.set(true);
    return this.http.get<PageResponse<Customer>>('/api/customers', { params }).pipe(
      tap((res) => {
        if (sortKey !== this.sortKey || start !== this.loadedCount()) return; // stale reply
        this.customers.update((current) => {
          const next =
            current.length === res.total ? [...current] : Array.from<Customer | undefined>({ length: res.total });
          next.splice(start, res.data.length, ...res.data);
          return next;
        });
        this.totalRecords.set(res.total);
        this.loadedCount.set(start + res.data.length);
        if (flight.snap || (start === 0 && first > 0)) this.snapTo(start);
      }),
      catchError(() => EMPTY),
      finalize(() => {
        if (this.inFlight === flight) this.inFlight = undefined;
        if (seq === this.requestSeq) this.loading.set(false);
      }),
    );
  }

  /** Put row `index` at the top of the viewport, but only once the user has stopped scrolling. */
  private snapTo(index: number): void {
    const seq = ++this.snapSeq;
    const attempt = () => {
      if (seq !== this.snapSeq) return; // superseded by a newer snap
      const viewport = this.viewport();
      if (!viewport) return;
      if (this.scrollbarHeld || Date.now() - this.lastScrollAt < 120) {
        setTimeout(attempt, 100); // user is still scrolling / holding the scrollbar: wait
        return;
      }
      if (Math.floor(viewport.scrollTop / ROW_HEIGHT) < index) return; // user went back into loaded data
      this.table()?.scrollToVirtualIndex(index);
      if (Math.abs(viewport.scrollTop - index * ROW_HEIGHT) > ROW_HEIGHT) viewport.scrollTop = index * ROW_HEIGHT;
    };
    setTimeout(attempt, 0); // let the new rows render first
  }

  private viewport(): HTMLElement | null {
    return this.host.nativeElement.querySelector('.p-virtualscroller');
  }

  private trackUserScrolling(): void {
    const el = this.host.nativeElement;
    const onScroll = () => (this.lastScrollAt = Date.now());
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // a mousedown whose target is the scroll viewport itself, to the right of its content, is on the scrollbar
      if (t.classList?.contains('p-virtualscroller') && e.offsetX >= t.clientWidth) this.scrollbarHeld = true;
    };
    const onUp = () => (this.scrollbarHeld = false);
    el.addEventListener('scroll', onScroll, { capture: true, passive: true });
    el.addEventListener('mousedown', onDown, true);
    window.addEventListener('mouseup', onUp, true);
    this.destroyRef.onDestroy(() => {
      this.snapSeq++;
      el.removeEventListener('scroll', onScroll, true);
      el.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mouseup', onUp, true);
    });
  }
}
