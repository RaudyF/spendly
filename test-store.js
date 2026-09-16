import { useStore } from './src/store/index.js';

async function runTests() {
  console.log('--- STARTING STORE TEST ---');
  
  // Wait for initial hydration if needed, or just initialize manually
  const store = useStore.getState();
  
  // Set initial state for test
  store.setActivePayCycle('Q1');
  
  // Set some income
  useStore.setState({
    profile: {
      ...store.profile,
      monthlyIncome: 10000,
    }
  });
  
  // 1. Crear una obligación Internet TEST de RD$1,500 para Q1
  console.log('\n[1] Creating Obligation: Internet TEST, 1500, Q1');
  await store.addObligation({
    name: 'Internet TEST',
    amount: 1500,
    category: 'utilities',
    payCycle: 'Q1',
    isPaid: false
  });
  
  // Force recalculate
  store.recalculateStats();
  
  // 2. Confirmar que aparece una sola vez
  const state2 = useStore.getState();
  const q1Obligations = state2.obligations.filter(o => o.payCycle === 'Q1');
  console.log(`\n[2] Obligations in Q1 count: ${q1Obligations.length}`);
  console.log(`Obligation Name: ${q1Obligations[0]?.name}`);
  
  // 3 & 4. Verificar que comprometido aumenta RD$1,500 y disponible libre disminuye RD$1,500
  console.log(`\n[3 & 4] Checking Stats for Q1:`);
  console.log(`Total Income: ${state2.monthlyStats?.totalIncome}`);
  console.log(`Committed: ${state2.monthlyStats?.committed}`);
  console.log(`Free Available: ${state2.monthlyStats?.freeAvailable}`);
  
  // 5. Marcarla como pagada
  console.log('\n[5] Marking as paid...');
  const obId = q1Obligations[0].id;
  await store.updateObligation(obId, { isPaid: true });
  
  // 6. Confirmar que deja de contar como pendiente
  // Wait, does "isPaid: true" remove it from "committed"? 
  // Let's check the logic. Usually, paid obligations are still "committed" but they are just paid.
  // Pending is `committed - paid`. 
  // Wait, the prompt says: "Confirmar que deja de contar como pendiente."
  // Pending = committed - paid. So if it's paid, it stops being pending.
  const state3 = useStore.getState();
  const activeObligations = state3.obligations.filter(o => o.payCycle === 'Q1' || o.payCycle === 'MONTHLY');
  const committed = activeObligations.reduce((sum, o) => sum + o.amount, 0);
  const paid = activeObligations.filter(o => o.isPaid).reduce((sum, o) => sum + o.amount, 0);
  const pending = committed - paid;
  
  console.log(`\n[6] After payment:`);
  console.log(`Committed: ${committed}`);
  console.log(`Paid: ${paid}`);
  console.log(`Pending: ${pending}`);
  
  console.log('\n--- END OF TEST ---');
}

runTests().catch(console.error);