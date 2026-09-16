'use client';

import { Layout } from '@/components/layout/navigation';
import { GoalsPage } from '@/components/goals';

export default function Goals() {
  return (
    <Layout title="Metas">
      <GoalsPage />
    </Layout>
  );
}
