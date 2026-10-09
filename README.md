# ptable-demo

Angular 21 + PrimeNG 21 demo: `p-table` with virtual scroll + lazy loading over 100,000 mock customers.

- `npm install && npm start` → http://localhost:4200
- Mock API: `src/app/mock-api/mock-api.interceptor.ts` (remove it and `withInterceptors(...)` in `app.config.ts` to use a real `/api/customers` backend returning `{ data, total }`).
- GitHub Pages deploy: `.github/workflows/deploy.yml`
