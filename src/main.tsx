import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { MailMindProvider } from './state/MailMindProvider';
import { AppErrorBoundary } from './components/shared/AppErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MailMindProvider>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </MailMindProvider>
    </BrowserRouter>
  </StrictMode>,
);
