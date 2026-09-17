const fs = require('fs');
let code = fs.readFileSync('src/components/onboarding/onboarding-flow.tsx', 'utf8');

const originalHandleComplete = `  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await setProfile({
        name: name || 'User',
        email: user?.email || '',
        monthlyIncome: parseFloat(income) || 0,
        incomeFrequency,
        currency,
        onboardingCompleted: true,
      });

      if (income && parseFloat(income) > 0) {
        await initializeDefaultBudgets(parseFloat(income));
      }
      
      await completeOnboarding();
    } finally {
      setIsSubmitting(false);
    }
  };`;

const newHandleComplete = `  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      await setProfile({
        name: name || 'User',
        email: user?.email || '',
        monthlyIncome: parseFloat(income) || 0,
        incomeFrequency,
        currency,
        onboardingCompleted: true,
      });

      if (income && parseFloat(income) > 0) {
        await initializeDefaultBudgets(parseFloat(income));
      }
      
      // Try to sync to cloud immediately so user is created in Neon DB.
      // But we must catch any error so we DO NOT block onboarding if Neon or Firebase fails.
      const syncToCloud = useStore.getState().syncToCloud;
      try {
        await syncToCloud();
      } catch (e) {
        console.warn('Neon initial sync failed, proceeding in local mode:', e);
      }
      
      await completeOnboarding();
    } finally {
      setIsSubmitting(false);
    }
  };`;

code = code.replace(originalHandleComplete, newHandleComplete);
fs.writeFileSync('src/components/onboarding/onboarding-flow.tsx', code);
