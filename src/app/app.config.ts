import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { mockApiInterceptor } from './mock-api/mock-api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Remove `withInterceptors([mockApiInterceptor])` to use a real backend at /api/customers
    provideHttpClient(withInterceptors([mockApiInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({ theme: { preset: Aura } }),
  ],
};
