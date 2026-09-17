const fs = require('fs');
let code = fs.readFileSync('src/store/actions/obligation-actions.ts', 'utf8');

const newFunctions = `
  registerPayment: async (obligationId: string, amount: number, realDate: string, payCycle: import('@/types').PayCycle) => {
    const obligation = get().obligations.find(o => o.id === obligationId);
    if (!obligation) return;
    
    // Add the payment as an expense
    await get().addExpense({
      amount,
      description: \`Pago: \${obligation.name}\`,
      category: obligation.category,
      date: realDate,
      payCycle,
      obligationId,
      status: 'active',
      source: 'partial_payment'
    });
    
    // Calculate new status
    const allExpenses = get().expenses.filter(e => e.obligationId === obligationId && e.status !== 'reverted');
    const totalPaid = allExpenses.reduce((sum, e) => sum + e.amount, 0); // we just added one so it should be included but wait, addExpense is async and updates state.
    // get().expenses should have it since it calls set().
    // wait, I will re-fetch it from state after await just in case
    
    const updatedExpenses = get().expenses.filter(e => e.obligationId === obligationId && e.status !== 'reverted');
    const newTotalPaid = updatedExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    let newStatus: import('@/types').ObligationStatus = 'partial';
    if (newTotalPaid >= obligation.amount) {
      newStatus = 'paid';
    }
    
    await get().updateObligation(obligationId, { status: newStatus, isPaid: newStatus === 'paid' });
  },

  revertPayment: async (expenseId: string, obligationId: string) => {
    const expense = get().expenses.find(e => e.id === expenseId);
    if (!expense) return;
    
    await get().updateExpense(expenseId, { status: 'reverted' });
    
    const obligation = get().obligations.find(o => o.id === obligationId);
    if (!obligation) return;

    const updatedExpenses = get().expenses.filter(e => e.obligationId === obligationId && e.status !== 'reverted');
    const newTotalPaid = updatedExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    let newStatus: import('@/types').ObligationStatus = 'partial';
    if (newTotalPaid === 0) {
      // It might be pending or overdue. Leave it to UI or compute it here?
      // Since evaluating overdue requires America/Santo_Domingo, let's just use pending or overdue based on date if we want,
      // But for now, pending is safe, or we can check date.
      newStatus = 'pending'; // UI can override visually or we can keep it as pending.
    }
    
    await get().updateObligation(obligationId, { status: newStatus, isPaid: false });
  },
`;

code = code.replace("ensurePeriodInitialized: async", newFunctions + "\n  ensurePeriodInitialized: async");
fs.writeFileSync('src/store/actions/obligation-actions.ts', code);
