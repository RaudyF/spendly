'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store';
import { useAuth } from '@/components/auth/auth-provider';
import { OnboardingFlow } from '@/components/onboarding';
import { LandingPage } from '@/components/landing';

export default function HomePage() {
  const router = useRouter();
  const isOnboarded = useStore((state) => state.isOnboarded);
  const isLoading = useStore((state) => state.isLoading);
  const { user, isLoading: authLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Redirect to dashboard in background if user is authenticated and onboarded
  useEffect(() => {
    if (!isLoading && !authLoading && user && isOnboarded) {
      router.push('/dashboard');
    }
  }, [isLoading, authLoading, user, isOnboarded, router]);

  // If user is authenticated but not onboarded, transition to onboarding
  useEffect(() => {
    if (!authLoading && !isLoading && user && !isOnboarded) {
      setShowOnboarding(true);
    }
  }, [user, authLoading, isLoading, isOnboarded]);

  // Show onboarding if active or user needs it
  if (showOnboarding || (user && !isOnboarded && !authLoading && !isLoading)) {
    return (
      <OnboardingFlow
        onBack={!user ? () => setShowOnboarding(false) : undefined}
      />
    );
  }

  // Task 7: The Landing page loads instantly without waiting for auth, IndexedDB, or Neon!
  return <LandingPage onGetStarted={() => setShowOnboarding(true)} />;
}
