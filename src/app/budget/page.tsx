'use client';

import { Suspense } from 'react';
import { Layout } from '@/components/layout/navigation';
import { BudgetPage } from '@/components/budget';
import { Skeleton } from '@/components/ui';

export default function Budget() {
  return (
    <Layout title="Presupuestos">
      <Suspense
        fallback={
          <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-4">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          </div>
        }
      >
        <BudgetPage />
      </Suspense>
    </Layout>
  );
}
