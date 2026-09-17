import { NextRequest, NextResponse } from 'next/server';
import * as neon from '@/lib/neon';
import { verifyFirebaseToken } from '@/lib/server-auth';

// GET /api/sync - Pull data from cloud or check database status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Quick status check endpoint (public connection health check)
    if (action === 'status') {
      const dbStatus = await neon.checkConnection();
      return NextResponse.json({
        success: true,
        database: dbStatus,
      });
    }

    // 1. Verify Firebase token from Authorization header on server
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const authResult = await verifyFirebaseToken(authHeader);

    if (!authResult.success || !authResult.uid) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado: Token de autenticación inválido o ausente' },
        { status: 401 }
      );
    }

    // 2. Extract authenticated UID directly from validated token (NEVER trust browser-provided userId)
    const authenticatedUserId = authResult.uid;

    // Initialize tables if they don't exist
    await neon.initializeTables();

    // 3. Filter all Neon database queries strictly by the authenticated user ID
    const [expenses, budgets, goals, obligations, recurringObligations, incomes, periodStates, periodRollovers, settings, dbStatus] = await Promise.all([
      neon.getExpenses(authenticatedUserId),
      neon.getBudgets(authenticatedUserId),
      neon.getGoals(authenticatedUserId),
      neon.getObligations(authenticatedUserId),
      neon.getRecurringObligations(authenticatedUserId),
      neon.getIncomes(authenticatedUserId),
      neon.getPeriodStates(authenticatedUserId),
      neon.getPeriodRollovers(authenticatedUserId),
      neon.getSettings(authenticatedUserId),
      neon.checkConnection(),
    ]);

    // Transform expenses
    const transformedExpenses = expenses.map((e: any) => ({
      id: e.id,
      userId: authenticatedUserId,
      amount: parseFloat(e.amount),
      category: e.category,
      description: e.description || '',
      date: e.date,
      payCycle: e.pay_cycle || undefined,
      createdAt: e.created_at || new Date().toISOString(),
      updatedAt: e.updated_at || e.created_at || new Date().toISOString(),
      deletedAt: e.deleted_at || null,
      source: e.source || 'cloud',
      sourceId: e.source_id || undefined,
    }));

    // Transform incomes
    const transformedIncomes = incomes.map((i: any) => ({
      id: i.id,
      userId: authenticatedUserId,
      amount: parseFloat(i.amount),
      source: i.source,
      date: i.date,
      payCycle: i.pay_cycle || 'MONTHLY',
      type: i.type || 'salary',
      status: i.status || 'received',
      createdAt: i.created_at || new Date().toISOString(),
      updatedAt: i.updated_at || i.created_at || new Date().toISOString(),
      deletedAt: i.deleted_at || null,
      sourceId: i.source_id || undefined,
    }));

    // Transform budgets
    const transformedBudgets = budgets.map((b: any) => ({
      id: b.id,
      userId: authenticatedUserId,
      category: b.category,
      limit: parseFloat(b.amount),
      spent: 0, // Recalculated on client from expenses
      month: b.period,
      periodType: b.period_type || 'MONTHLY',
      createdAt: b.created_at || new Date().toISOString(),
      updatedAt: b.updated_at || new Date().toISOString(),
      deletedAt: b.deleted_at || null,
      source: b.source || 'cloud',
      sourceId: b.source_id || undefined,
    }));

    // Transform goals
    const transformedGoals = goals.map((g: any) => ({
      id: g.id,
      userId: authenticatedUserId,
      name: g.name,
      targetAmount: parseFloat(g.target_amount),
      currentAmount: parseFloat(g.current_amount),
      deadline: g.deadline || undefined,
      color: g.color || '#3B82F6',
      icon: g.icon || 'piggy-bank',
      createdAt: g.created_at || new Date().toISOString(),
      updatedAt: g.updated_at || new Date().toISOString(),
      deletedAt: g.deleted_at || null,
      source: g.source || 'cloud',
      sourceId: g.source_id || undefined,
    }));

    // Transform obligations
    const transformedObligations = obligations.map((o: any) => ({
      id: o.id,
      userId: authenticatedUserId,
      name: o.name,
      amount: parseFloat(o.amount),
      category: o.category,
      payCycle: o.pay_cycle,
      dueDate: o.due_date || undefined,
      isPaid: Boolean(o.is_paid),
      status: o.status || 'pending',
      period: o.period || undefined,
      templateId: o.template_id || undefined,
      idempotencyKey: o.idempotency_key || undefined,
      createdAt: o.created_at || new Date().toISOString(),
      updatedAt: o.updated_at || new Date().toISOString(),
      deletedAt: o.deleted_at || null,
      source: o.source || 'cloud',
      sourceId: o.source_id || undefined,
    }));

    // Transform recurring obligations
    const transformedRecurringObligations = (recurringObligations || []).map((r: any) => ({
      id: r.id,
      userId: authenticatedUserId,
      name: r.name,
      amount: parseFloat(r.amount),
      category: r.category,
      frequency: r.frequency || 'monthly',
      dayOfMonth: r.day_of_month || 1,
      payCycle: r.pay_cycle || 'MONTHLY',
      startDate: r.start_date,
      endDate: r.end_date || undefined,
      isActive: Boolean(r.is_active ?? true),
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at || new Date().toISOString(),
      deletedAt: r.deleted_at || null,
      source: r.source || 'cloud',
      sourceId: r.source_id || undefined,
    }));

    // Transform period states
    const transformedPeriodStates = periodStates.map((ps: any) => ({
      id: ps.id,
      userId: authenticatedUserId,
      period: ps.period,
      cycle: ps.cycle,
      status: ps.status,
      closedAt: ps.closed_at ? new Date(ps.closed_at).toISOString() : undefined,
      reopenedAt: ps.reopened_at ? new Date(ps.reopened_at).toISOString() : undefined,
      reopenReason: ps.reopen_reason || undefined,
      frozenSummary: ps.frozen_summary || undefined,
      createdAt: ps.created_at || new Date().toISOString(),
      updatedAt: ps.updated_at || new Date().toISOString(),
      deletedAt: ps.deleted_at || null,
      source: ps.source || 'cloud',
      sourceId: ps.source_id || undefined,
    }));

    // Transform period rollovers
    const transformedRollovers = periodRollovers.map((ro: any) => ({
      id: ro.id,
      userId: authenticatedUserId,
      sourcePeriod: ro.source_period,
      sourceCycle: ro.source_cycle,
      destinationPeriod: ro.destination_period,
      destinationCycle: ro.destination_cycle,
      amount: parseFloat(ro.amount),
      type: ro.type,
      status: ro.status,
      idempotencyKey: ro.idempotency_key || undefined,
      goalAllocation: ro.goal_allocation || undefined,
      createdAt: ro.created_at || new Date().toISOString(),
      updatedAt: ro.updated_at || new Date().toISOString(),
      deletedAt: ro.deleted_at || null,
      source: ro.source || 'cloud',
      sourceId: ro.source_id || undefined,
    }));

    // Transform profile from settings
    const profile = settings ? {
      id: 'profile',
      userId: authenticatedUserId,
      name: settings.name || authResult.displayName || '',
      email: settings.email || authResult.email || '',
      monthlyIncome: typeof settings.monthlyIncome === 'number' ? settings.monthlyIncome : parseFloat(settings.monthlyIncome) || 0,
      currency: settings.currency || 'DOP',
      incomeFrequency: settings.incomeFrequency || 'biweekly',
      onboardingCompleted: settings.onboardingCompleted ?? true,
      createdAt: settings.createdAt || new Date().toISOString(),
      updatedAt: settings.updatedAt || new Date().toISOString(),
    } : null;

    return NextResponse.json({
      success: true,
      database: dbStatus,
      authenticatedUserId,
      data: {
        expenses: transformedExpenses,
        incomes: transformedIncomes,
        budgets: transformedBudgets,
        goals: transformedGoals,
        obligations: transformedObligations,
        recurringObligations: transformedRecurringObligations,
        periodStates: transformedPeriodStates,
        periodRollovers: transformedRollovers,
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

// POST /api/sync - Push local data to cloud and perform granular per-record conflict resolution
export async function POST(request: NextRequest) {
  try {
    // 1. Verify Firebase token from Authorization header on server
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const authResult = await verifyFirebaseToken(authHeader);

    if (!authResult.success || !authResult.uid) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado: Token de autenticación inválido o ausente' },
        { status: 401 }
      );
    }

    // 2. Extract authenticated UID directly from validated token (NEVER trust browser-provided userId)
    const authenticatedUserId = authResult.uid;

    const body = await request.json();
    const { expenses, incomes, budgets, goals, obligations, recurringObligations, periodStates, periodRollovers, profile } = body;

    // Initialize tables if they don't exist
    await neon.initializeTables();

    const results = {
      expenses: 0,
      incomes: 0,
      budgets: 0,
      goals: 0,
      obligations: 0,
      recurringObligations: 0,
      periodStates: 0,
      periodRollovers: 0,
      profile: false,
    };

    const syncedIds: {
      expenses: string[];
      incomes: string[];
      budgets: string[];
      goals: string[];
      obligations: string[];
      recurringObligations: string[];
      periodStates: string[];
      periodRollovers: string[];
      profile?: boolean;
    } = {
      expenses: [],
      incomes: [],
      budgets: [],
      goals: [],
      obligations: [],
      recurringObligations: [],
      periodStates: [],
      periodRollovers: [],
      profile: false,
    };

    const failedEntities: Array<{
      entityType: string;
      id: string;
      error: string;
      recoverable: boolean;
    }> = [];

    // 3. Sync user profile and settings strictly bound to authenticated UID
    if (profile || authResult.email) {
      try {
        await neon.createUser({
          id: authenticatedUserId,
          email: authResult.email || profile?.email || '',
          displayName: authResult.displayName || profile?.name || null,
          photoURL: authResult.photoURL || profile?.photoURL || null,
          provider: 'firebase',
        });

        if (profile) {
          await neon.saveSettings(authenticatedUserId, {
            name: profile.name || authResult.displayName,
            email: profile.email || authResult.email,
            monthlyIncome: profile.monthlyIncome,
            currency: profile.currency,
            incomeFrequency: profile.incomeFrequency,
            onboardingCompleted: profile.onboardingCompleted,
            updatedAt: profile.updatedAt || new Date().toISOString(),
          });
        }
        results.profile = true;
        syncedIds.profile = true;
      } catch (err: any) {
        console.error('[Sync API] Error syncing profile:', err);
        failedEntities.push({
          entityType: 'profile',
          id: 'profile',
          error: err.message || 'Error guardando perfil',
          recoverable: true,
        });
      }
    }

    // 4. Sync expenses per-record strictly filtered and assigned to authenticated UID
    if (expenses && Array.isArray(expenses)) {
      for (const expense of expenses) {
        try {
          await neon.createExpense({
            id: expense.id,
            userId: authenticatedUserId,
            amount: expense.amount,
            category: expense.category,
            description: expense.description || '',
            date: expense.date,
            payCycle: expense.payCycle,
            financialPeriod: expense.financialPeriod,
            idempotencyKey: expense.idempotencyKey,
            gmailMessageId: expense.gmailMessageId,
            createdAt: expense.createdAt,
            updatedAt: expense.updatedAt,
            deletedAt: expense.deletedAt,
            source: expense.source,
            sourceId: expense.sourceId,
          });
          results.expenses++;
          syncedIds.expenses.push(expense.id);
        } catch (err: any) {
          console.error(`[Sync API] Error syncing expense ${expense.id}:`, err);
          failedEntities.push({
            entityType: 'expense',
            id: expense.id,
            error: err.message || 'Error al guardar gasto',
            recoverable: true,
          });
        }
      }
    }

    // 5. Sync incomes per-record strictly filtered and assigned to authenticated UID
    if (incomes && Array.isArray(incomes)) {
      for (const income of incomes) {
        try {
          await neon.createIncome({
            id: income.id,
            userId: authenticatedUserId,
            amount: income.amount,
            source: income.source || 'Ingreso',
            date: income.date,
            payCycle: income.payCycle,
            type: income.type,
            status: income.status,
            financialPeriod: income.financialPeriod,
            idempotencyKey: income.idempotencyKey,
            gmailMessageId: income.gmailMessageId,
            createdAt: income.createdAt,
            updatedAt: income.updatedAt,
            deletedAt: income.deletedAt,
            sourceId: income.sourceId,
            deviceSource: income.source,
          });
          results.incomes++;
          syncedIds.incomes.push(income.id);
        } catch (err: any) {
          console.error(`[Sync API] Error syncing income ${income.id}:`, err);
          failedEntities.push({
            entityType: 'income',
            id: income.id,
            error: err.message || 'Error al guardar ingreso',
            recoverable: true,
          });
        }
      }
    }

    // 6. Sync budgets per-record strictly filtered and assigned to authenticated UID
    if (budgets && Array.isArray(budgets)) {
      for (const budget of budgets) {
        try {
          await neon.createBudget({
            id: budget.id,
            userId: authenticatedUserId,
            category: budget.category,
            amount: budget.limit,
            period: budget.month,
            periodType: budget.periodType,
            financialPeriod: budget.financialPeriod,
            idempotencyKey: budget.idempotencyKey,
            createdAt: budget.createdAt,
            updatedAt: budget.updatedAt,
            deletedAt: budget.deletedAt,
            source: budget.source,
            sourceId: budget.sourceId,
          });
          results.budgets++;
          syncedIds.budgets.push(budget.id);
        } catch (err: any) {
          console.error(`[Sync API] Error syncing budget ${budget.id}:`, err);
          failedEntities.push({
            entityType: 'budget',
            id: budget.id,
            error: err.message || 'Error al guardar presupuesto',
            recoverable: true,
          });
        }
      }
    }

    // 7. Sync goals per-record strictly filtered and assigned to authenticated UID
    if (goals && Array.isArray(goals)) {
      for (const goal of goals) {
        try {
          await neon.createGoal({
            id: goal.id,
            userId: authenticatedUserId,
            name: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            deadline: goal.deadline || null,
            color: goal.color || '#3B82F6',
            icon: goal.icon || 'piggy-bank',
            idempotencyKey: goal.idempotencyKey,
            createdAt: goal.createdAt,
            updatedAt: goal.updatedAt,
            deletedAt: goal.deletedAt,
            source: goal.source,
            sourceId: goal.sourceId,
          });
          results.goals++;
          syncedIds.goals.push(goal.id);
        } catch (err: any) {
          console.error(`[Sync API] Error syncing goal ${goal.id}:`, err);
          failedEntities.push({
            entityType: 'goal',
            id: goal.id,
            error: err.message || 'Error al guardar meta',
            recoverable: true,
          });
        }
      }
    }

    // 8. Sync obligations per-record strictly filtered and assigned to authenticated UID
    if (obligations && Array.isArray(obligations)) {
      for (const obligation of obligations) {
        try {
          await neon.createObligation({
            id: obligation.id,
            userId: authenticatedUserId,
            name: obligation.name,
            amount: obligation.amount,
            category: obligation.category,
            payCycle: obligation.payCycle,
            dueDate: obligation.dueDate,
            isPaid: obligation.isPaid,
            status: obligation.status,
            period: obligation.period,
            financialPeriod: obligation.financialPeriod,
            templateId: obligation.templateId,
            idempotencyKey: obligation.idempotencyKey,
            gmailMessageId: obligation.gmailMessageId,
            createdAt: obligation.createdAt,
            updatedAt: obligation.updatedAt,
            deletedAt: obligation.deletedAt,
            source: obligation.source,
            sourceId: obligation.sourceId,
          });
          results.obligations++;
          syncedIds.obligations.push(obligation.id);
        } catch (err: any) {
          console.error(`[Sync API] Error syncing obligation ${obligation.id}:`, err);
          failedEntities.push({
            entityType: 'obligation',
            id: obligation.id,
            error: err.message || 'Error al guardar obligación',
            recoverable: true,
          });
        }
      }
    }

    // 9. Sync recurring obligations per-record strictly filtered and assigned to authenticated UID
    if (recurringObligations && Array.isArray(recurringObligations)) {
      for (const template of recurringObligations) {
        try {
          await neon.createRecurringObligation({
            id: template.id,
            userId: authenticatedUserId,
            name: template.name,
            amount: template.amount,
            category: template.category,
            frequency: template.frequency,
            dayOfMonth: template.dayOfMonth,
            payCycle: template.payCycle,
            startDate: template.startDate,
            endDate: template.endDate,
            isActive: template.isActive,
            idempotencyKey: template.idempotencyKey,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            deletedAt: template.deletedAt,
            source: template.source,
            sourceId: template.sourceId,
          });
          results.recurringObligations++;
          syncedIds.recurringObligations.push(template.id);
        } catch (err: any) {
          console.error(`[Sync API] Error syncing recurring obligation ${template.id}:`, err);
          failedEntities.push({
            entityType: 'recurringObligation',
            id: template.id,
            error: err.message || 'Error al guardar plantilla recurrente',
            recoverable: true,
          });
        }
      }
    }

    // 10. Sync period states per-record strictly filtered and assigned to authenticated UID
    if (periodStates && Array.isArray(periodStates)) {
      for (const ps of periodStates) {
        try {
          await neon.savePeriodState({
            id: ps.id,
            userId: authenticatedUserId,
            period: ps.period,
            cycle: ps.cycle,
            status: ps.status,
            financialPeriod: ps.financialPeriod,
            idempotencyKey: ps.idempotencyKey,
            closedAt: ps.closedAt,
            reopenedAt: ps.reopenedAt,
            reopenReason: ps.reopenReason,
            frozenSummary: ps.frozenSummary,
            createdAt: ps.createdAt,
            updatedAt: ps.updatedAt,
            deletedAt: ps.deletedAt,
            source: ps.source,
            sourceId: ps.sourceId,
          });
          results.periodStates++;
          syncedIds.periodStates.push(ps.id);
        } catch (err: any) {
          console.error(`[Sync API] Error syncing period state ${ps.id}:`, err);
          failedEntities.push({
            entityType: 'periodState',
            id: ps.id,
            error: err.message || 'Error al guardar estado de período',
            recoverable: true,
          });
        }
      }
    }

    // 11. Sync period rollovers per-record strictly filtered and assigned to authenticated UID
    if (periodRollovers && Array.isArray(periodRollovers)) {
      for (const ro of periodRollovers) {
        try {
          await neon.savePeriodRollover({
            id: ro.id,
            userId: authenticatedUserId,
            sourcePeriod: ro.sourcePeriod,
            sourceCycle: ro.sourceCycle,
            destinationPeriod: ro.destinationPeriod,
            destinationCycle: ro.destinationCycle,
            amount: ro.amount,
            type: ro.type,
            status: ro.status,
            financialPeriod: ro.financialPeriod,
            idempotencyKey: ro.idempotencyKey,
            goalAllocation: ro.goalAllocation,
            createdAt: ro.createdAt,
            updatedAt: ro.updatedAt,
            deletedAt: ro.deletedAt,
            source: ro.source,
            sourceId: ro.sourceId,
          });
          results.periodRollovers++;
          syncedIds.periodRollovers.push(ro.id);
        } catch (err: any) {
          console.error(`[Sync API] Error syncing period rollover ${ro.id}:`, err);
          failedEntities.push({
            entityType: 'periodRollover',
            id: ro.id,
            error: err.message || 'Error al guardar remanente',
            recoverable: true,
          });
        }
      }
    }

    const dbStatus = await neon.checkConnection();

    // If there were any errors, do not report blanket success
    if (failedEntities.length > 0) {
      const totalSynced =
        results.expenses +
        results.incomes +
        results.budgets +
        results.goals +
        results.obligations +
        results.recurringObligations +
        results.periodStates +
        results.periodRollovers +
        (results.profile ? 1 : 0);

      const isPartial = totalSynced > 0;

      return NextResponse.json(
        {
          success: false,
          partial: isPartial,
          message: isPartial
            ? 'Sincronización parcial: algunos registros no se pudieron sincronizar y permanecen en cola pendiente.'
            : 'Error al sincronizar registros con la nube. Los cambios se conservan localmente.',
          authenticatedUserId,
          database: dbStatus,
          synced: results,
          syncedIds,
          failed: failedEntities,
          errors: failedEntities.map((f) => `${f.entityType}[${f.id}]: ${f.error}`),
        },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Datos sincronizados exitosamente con la nube por registro',
      authenticatedUserId,
      database: dbStatus,
      synced: results,
      syncedIds,
      failed: [],
    });
  } catch (error: any) {
    console.error('Sync push error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync data to cloud', success: false },
      { status: 500 }
    );
  }
}
