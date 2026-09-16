import { NextRequest, NextResponse } from 'next/server';
import * as neon from '@/lib/neon';

// GET /api/sync - Pull data from cloud or check database status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Quick status check endpoint
    if (action === 'status') {
      const dbStatus = await neon.checkConnection();
      return NextResponse.json({
        success: true,
        database: dbStatus,
      });
    }

    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Initialize tables if they don't exist
    await neon.initializeTables();

    // Fetch all user data in parallel
    const [expenses, budgets, goals, obligations, incomes, settings, dbStatus] = await Promise.all([
      neon.getExpenses(userId),
      neon.getBudgets(userId),
      neon.getGoals(userId),
      neon.getObligations(userId),
      neon.getIncomes(userId),
      neon.getSettings(userId),
      neon.checkConnection(),
    ]);

    // Transform expenses
    const transformedExpenses = expenses.map((e: any) => ({
      id: e.id,
      amount: parseFloat(e.amount),
      category: e.category,
      description: e.description || '',
      date: e.date,
      payCycle: e.pay_cycle || undefined,
      createdAt: e.created_at || new Date().toISOString(),
      updatedAt: e.updated_at || e.created_at || new Date().toISOString(),
    }));

    // Transform incomes
    const transformedIncomes = incomes.map((i: any) => ({
      id: i.id,
      amount: parseFloat(i.amount),
      source: i.source,
      date: i.date,
      payCycle: i.pay_cycle || 'MONTHLY',
      type: i.type || 'salary',
      status: i.status || 'received',
      createdAt: i.created_at || new Date().toISOString(),
      updatedAt: i.updated_at || i.created_at || new Date().toISOString(),
    }));

    // Transform budgets
    const transformedBudgets = budgets.map((b: any) => ({
      id: b.id,
      category: b.category,
      limit: parseFloat(b.amount),
      spent: 0, // Recalculated on client from expenses
      month: b.period,
      periodType: b.period_type || 'MONTHLY',
      createdAt: b.created_at || new Date().toISOString(),
      updatedAt: b.updated_at || new Date().toISOString(),
    }));

    // Transform goals
    const transformedGoals = goals.map((g: any) => ({
      id: g.id,
      name: g.name,
      targetAmount: parseFloat(g.target_amount),
      currentAmount: parseFloat(g.current_amount),
      deadline: g.deadline || undefined,
      color: g.color || '#3B82F6',
      icon: g.icon || 'piggy-bank',
      createdAt: g.created_at || new Date().toISOString(),
      updatedAt: g.updated_at || new Date().toISOString(),
    }));

    // Transform obligations
    const transformedObligations = obligations.map((o: any) => ({
      id: o.id,
      name: o.name,
      amount: parseFloat(o.amount),
      category: o.category,
      payCycle: o.pay_cycle,
      isPaid: Boolean(o.is_paid),
      createdAt: o.created_at || new Date().toISOString(),
      updatedAt: o.updated_at || new Date().toISOString(),
    }));

    // Transform profile from settings
    const profile = settings ? {
      id: 'profile',
      name: settings.name || '',
      email: settings.email || '',
      monthlyIncome: typeof settings.monthlyIncome === 'number' ? settings.monthlyIncome : parseFloat(settings.monthlyIncome) || 0,
      currency: settings.currency || 'DOP',
      incomeFrequency: settings.incomeFrequency || 'biweekly',
      onboardingCompleted: settings.onboardingCompleted ?? true,
    } : null;

    return NextResponse.json({
      success: true,
      database: dbStatus,
      data: {
        expenses: transformedExpenses,
        incomes: transformedIncomes,
        budgets: transformedBudgets,
        goals: transformedGoals,
        obligations: transformedObligations,
        profile,
      },
    });
  } catch (error: any) {
    console.error('Sync pull error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data from cloud' },
      { status: 500 }
    );
  }
}

// POST /api/sync - Push local data to cloud
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, expenses, incomes, budgets, goals, obligations, profile } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Initialize tables if they don't exist
    await neon.initializeTables();

    const results = {
      expenses: 0,
      incomes: 0,
      budgets: 0,
      goals: 0,
      obligations: 0,
      profile: false,
    };

    // 1. Sync user profile and settings
    if (profile) {
      await neon.createUser({
        id: userId,
        email: profile.email || '',
        displayName: profile.name || null,
        photoURL: profile.photoURL || null,
        provider: 'app',
      });
      
      await neon.saveSettings(userId, {
        name: profile.name,
        email: profile.email,
        monthlyIncome: profile.monthlyIncome,
        currency: profile.currency,
        incomeFrequency: profile.incomeFrequency,
        onboardingCompleted: profile.onboardingCompleted,
      });
      results.profile = true;
    }

    // 2. Sync expenses
    if (expenses && Array.isArray(expenses)) {
      for (const expense of expenses) {
        await neon.createExpense({
          id: expense.id,
          userId: userId,
          amount: expense.amount,
          category: expense.category,
          description: expense.description || '',
          date: expense.date,
          payCycle: expense.payCycle,
        });
        results.expenses++;
      }
    }

    // 3. Sync incomes
    if (incomes && Array.isArray(incomes)) {
      for (const income of incomes) {
        await neon.createIncome({
          id: income.id,
          userId: userId,
          amount: income.amount,
          source: income.source || 'Ingreso',
          date: income.date,
          payCycle: income.payCycle,
          type: income.type,
          status: income.status,
        });
        results.incomes++;
      }
    }

    // 4. Sync budgets
    if (budgets && Array.isArray(budgets)) {
      for (const budget of budgets) {
        await neon.createBudget({
          id: budget.id,
          userId: userId,
          category: budget.category,
          amount: budget.limit,
          period: budget.month,
          periodType: budget.periodType,
        });
        results.budgets++;
      }
    }

    // 5. Sync goals
    if (goals && Array.isArray(goals)) {
      for (const goal of goals) {
        await neon.createGoal({
          id: goal.id,
          userId: userId,
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          deadline: goal.deadline || null,
          color: goal.color || '#3B82F6',
          icon: goal.icon || 'piggy-bank',
        });
        results.goals++;
      }
    }

    // 6. Sync obligations
    if (obligations && Array.isArray(obligations)) {
      for (const obligation of obligations) {
        await neon.createObligation({
          id: obligation.id,
          userId: userId,
          name: obligation.name,
          amount: obligation.amount,
          category: obligation.category,
          payCycle: obligation.payCycle,
          isPaid: obligation.isPaid,
        });
        results.obligations++;
      }
    }

    const dbStatus = await neon.checkConnection();

    return NextResponse.json({
      success: true,
      message: 'Datos sincronizados exitosamente con la nube',
      database: dbStatus,
      synced: results,
    });
  } catch (error: any) {
    console.error('Sync push error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync data to cloud' },
      { status: 500 }
    );
  }
}
