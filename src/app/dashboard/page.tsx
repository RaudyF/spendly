'use client';

import { Suspense } from 'react';
import { Layout } from '@/components/layout/navigation';
import { Dashboard } from '@/components/dashboard';
import { Skeleton } from '@/components/ui';

export default function DashboardPage() {
  return (
    <Layout title="Resumen">
      <Suspense
        fallback={
          <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-80 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </Layout>
  );
}
