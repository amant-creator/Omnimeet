'use client';

import { SessionProvider } from 'next-auth/react';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * Client-only providers wrapper.
 * Keeps layout.js as a Server Component (required for Next.js metadata export)
 * while still giving the full client-side provider tree to all children.
 */
export default function Providers({ children }) {
  return (
    <SessionProvider>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </SessionProvider>
  );
}
