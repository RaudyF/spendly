'use client';

import { Suspense } from 'react';
import { Layout } from '@/components/layout/navigation';
import { ObligationsPage } from '@/components/obligations/obligations-page';
import { Skeleton } from '@/components/ui';

export default function Page() {
  return (
    <Layout title="Obligaciones">
      <Suspense
        fallback={
          <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-4">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        }
      >
        <ObligationsPage />
      </Suspense>
    </Layout>
  );
}
