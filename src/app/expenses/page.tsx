'use client';

import { Suspense } from 'react';
import { Layout } from '@/components/layout/navigation';
import { ExpensesPage } from '@/components/expenses';
import { Skeleton } from '@/components/ui';

export default function Expenses() {
  return (
    <Layout title="Movimientos">
      <Suspense
        fallback={
          <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-4">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        }
      >
        <ExpensesPage />
      </Suspense>
    </Layout>
  );
}
