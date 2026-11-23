import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers.tsx';
import { AppRoutes } from '@/app/routes.tsx';
import { registerPwa } from '@/app/pwa.ts';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);

registerPwa();
