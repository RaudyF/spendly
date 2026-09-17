const fs = require('fs');
let code = fs.readFileSync('src/components/onboarding/onboarding-flow.tsx', 'utf8');

const originalEffect = `      // Check if returning user with completed onboarding
      if (isOnboarded || (profile?.onboardingCompleted && profile?.monthlyIncome > 0)) {
        // Returning user - complete onboarding immediately
        completeOnboarding();
        return;
      }`;

const newEffect = `      // Check if returning user with completed onboarding
      if (isOnboarded) {
        return; // Already onboarded, page.tsx will redirect.
      }
      
      if (profile?.onboardingCompleted && profile?.monthlyIncome > 0) {
        // Returning user - complete onboarding immediately
        completeOnboarding();
        return;
      }`;

code = code.replace(originalEffect, newEffect);
fs.writeFileSync('src/components/onboarding/onboarding-flow.tsx', code);
