import { neon, NeonQueryFunction } from '@neondatabase/serverless';

export interface DatabaseStatus {
  connected: boolean;
  configured: boolean;
  type: 'neon' | 'postgres' | 'mock';
  message: string;
}

let _sql: NeonQueryFunction<false, false> | null = null;
let _tablesInitialized = false;

// In-memory fallback partitioned by user ID to guarantee isolated local testing and zero crashes
const inMemoryStore = {
  users: new Map<string, any>(),
  expenses: new Map<string, Map<string, any>>(),
  incomes: new Map<string, Map<string, any>>(),
  budgets: new Map<string, Map<string, any>>(),
  goals: new Map<string, Map<string, any>>(),
  obligations: new Map<string, Map<string, any>>(),
  settings: new Map<string, any>(),
};

function getUserMap(store: Map<string, Map<string, any>>, userId: string): Map<string, any> {
  if (!store.has(userId)) {
    store.set(userId, new Map());
  }
  return store.get(userId)!;
}

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return !!url && url.length > 0 && !url.includes('placeholder') && !url.includes('mock');
}

export function getSql(): NeonQueryFunction<false, false> | null {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL?.trim();
  if (url && !url.includes('placeholder') && !url.includes('mock')) {
    try {
      _sql = neon(url);
      return _sql;
    } catch (error) {
      console.error('[Neon] Error inicializando cliente Neon:', error);
      return null;
    }
  }

  return null;
}

export async function checkConnection(): Promise<DatabaseStatus> {
  if (!isDatabaseConfigured()) {
    return {
      connected: false,
      configured: false,
      type: 'mock',
      message: 'DATABASE_URL no configurada. La aplicación opera con persistencia local IndexedDB y aislamiento por usuario.',
    };
  }

  const sql = getSql();
  if (!sql) {
    return {
      connected: false,
      configured: true,
      type: 'mock',
      message: 'No se pudo inicializar la conexión con DATABASE_URL.',
    };
  }

  try {
    await sql`SELECT 1 as health_check`;
    return {
      connected: true,
      configured: true,
      type: 'neon',
      message: 'Conectado exitosamente a la base de datos PostgreSQL / Neon en la nube.',
    };
  } catch (error: any) {
    console.error('[Neon] Health check error:', error);
    return {
      connected: false,
      configured: true,
      type: 'mock',
      message: `Error al conectar a la base de datos: ${error?.message || 'Error de red'}. Operando en modo local.`,
    };
  }
}

// Auto-migration: create tables if they don't exist
export async function initializeTables(): Promise<void> {
  if (_tablesInitialized) return;

  const sql = getSql();
  if (!sql) {
    _tablesInitialized = true;
    return;
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        display_name TEXT,
        photo_url TEXT,
        provider TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS incomes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(12, 2) NOT NULL,
        source TEXT NOT NULL,
        date TEXT NOT NULL,
        pay_cycle TEXT,
        type TEXT,
        status TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);`;

    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(12, 2) NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        pay_cycle TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`;

    await sql`
      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        period TEXT NOT NULL DEFAULT 'monthly',
        period_type TEXT DEFAULT 'MONTHLY',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);`;

    await sql`
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        target_amount DECIMAL(12, 2) NOT NULL,
        current_amount DECIMAL(12, 2) DEFAULT 0,
        deadline TEXT,
        color TEXT DEFAULT '#3B82F6',
        icon TEXT DEFAULT 'piggy-bank',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);`;

    await sql`
      CREATE TABLE IF NOT EXISTS obligations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        category TEXT NOT NULL,
        pay_cycle TEXT NOT NULL,
        is_paid BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_obligations_user_id ON obligations(user_id);`;

    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        settings JSONB DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    _tablesInitialized = true;
  } catch (error) {
    console.error('[Neon] Error inicializando tablas:', error);
    // Don't throw to avoid crashing routes if database permissions are limited
    _tablesInitialized = true;
  }
}

// User operations
export async function createUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  provider: string;
}) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO users (id, email, display_name, photo_url, provider, created_at, updated_at)
        VALUES (${user.id}, ${user.email}, ${user.displayName}, ${user.photoURL}, ${user.provider}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          photo_url = EXCLUDED.photo_url,
          updated_at = NOW()
      `;
      return;
    } catch (error) {
      console.warn('[Neon] Error en createUser, usando respaldo local:', error);
    }
  }

  inMemoryStore.users.set(user.id, {
    ...user,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getUser(id: string) {
  const sql = getSql();
  if (sql) {
    try {
      const result = await sql`SELECT * FROM users WHERE id = ${id}`;
      return result[0] || null;
    } catch (error) {
      console.warn('[Neon] Error en getUser, consultando memoria:', error);
    }
  }
  return inMemoryStore.users.get(id) || null;
}

// Expenses operations
export async function createExpense(expense: {
  id: string;
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  payCycle?: string;
}) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO expenses (id, user_id, amount, category, description, date, pay_cycle, created_at, updated_at)
        VALUES (${expense.id}, ${expense.userId}, ${expense.amount}, ${expense.category}, ${expense.description}, ${expense.date}, ${expense.payCycle || null}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          date = EXCLUDED.date,
          pay_cycle = EXCLUDED.pay_cycle,
          updated_at = NOW()
      `;
      return;
    } catch (error) {
      console.warn('[Neon] Error en createExpense, usando memoria:', error);
    }
  }

  const userExpenses = getUserMap(inMemoryStore.expenses, expense.userId);
  userExpenses.set(expense.id, {
    id: expense.id,
    user_id: expense.userId,
    amount: expense.amount,
    category: expense.category,
    description: expense.description,
    date: expense.date,
    pay_cycle: expense.payCycle || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getExpenses(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      return await sql`
        SELECT * FROM expenses 
        WHERE user_id = ${userId} 
        ORDER BY date DESC
      `;
    } catch (error) {
      console.warn('[Neon] Error en getExpenses, consultando memoria:', error);
    }
  }

  const userExpenses = getUserMap(inMemoryStore.expenses, userId);
  return Array.from(userExpenses.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function deleteExpense(id: string, userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`DELETE FROM expenses WHERE id = ${id} AND user_id = ${userId}`;
      return;
    } catch (error) {
      console.warn('[Neon] Error en deleteExpense:', error);
    }
  }

  const userExpenses = getUserMap(inMemoryStore.expenses, userId);
  userExpenses.delete(id);
}

// Incomes operations
export async function createIncome(income: {
  id: string;
  userId: string;
  amount: number;
  source: string;
  date: string;
  payCycle?: string;
  type?: string;
  status?: string;
}) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO incomes (id, user_id, amount, source, date, pay_cycle, type, status, created_at, updated_at)
        VALUES (${income.id}, ${income.userId}, ${income.amount}, ${income.source}, ${income.date}, ${income.payCycle || 'MONTHLY'}, ${income.type || 'salary'}, ${income.status || 'received'}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          source = EXCLUDED.source,
          date = EXCLUDED.date,
          pay_cycle = EXCLUDED.pay_cycle,
          type = EXCLUDED.type,
          status = EXCLUDED.status,
          updated_at = NOW()
      `;
      return;
    } catch (error) {
      console.warn('[Neon] Error en createIncome, usando memoria:', error);
    }
  }

  const userIncomes = getUserMap(inMemoryStore.incomes, income.userId);
  userIncomes.set(income.id, {
    id: income.id,
    user_id: income.userId,
    amount: income.amount,
    source: income.source,
    date: income.date,
    pay_cycle: income.payCycle || 'MONTHLY',
    type: income.type || 'salary',
    status: income.status || 'received',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getIncomes(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      return await sql`
        SELECT * FROM incomes 
        WHERE user_id = ${userId} 
        ORDER BY date DESC
      `;
    } catch (error) {
      console.warn('[Neon] Error en getIncomes, consultando memoria:', error);
    }
  }

  const userIncomes = getUserMap(inMemoryStore.incomes, userId);
  return Array.from(userIncomes.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function deleteIncome(id: string, userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`DELETE FROM incomes WHERE id = ${id} AND user_id = ${userId}`;
      return;
    } catch (error) {
      console.warn('[Neon] Error en deleteIncome:', error);
    }
  }

  const userIncomes = getUserMap(inMemoryStore.incomes, userId);
  userIncomes.delete(id);
}

// Budgets operations
export async function createBudget(budget: {
  id: string;
  userId: string;
  category: string;
  amount: number;
  period: string;
  periodType?: string;
}) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO budgets (id, user_id, category, amount, period, period_type, created_at, updated_at)
        VALUES (${budget.id}, ${budget.userId}, ${budget.category}, ${budget.amount}, ${budget.period}, ${budget.periodType || 'MONTHLY'}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          period = EXCLUDED.period,
          period_type = EXCLUDED.period_type,
          updated_at = NOW()
      `;
      return;
    } catch (error) {
      console.warn('[Neon] Error en createBudget, usando memoria:', error);
    }
  }

  const userBudgets = getUserMap(inMemoryStore.budgets, budget.userId);
  userBudgets.set(budget.id, {
    id: budget.id,
    user_id: budget.userId,
    category: budget.category,
    amount: budget.amount,
    period: budget.period,
    period_type: budget.periodType || 'MONTHLY',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getBudgets(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      return await sql`
        SELECT * FROM budgets 
        WHERE user_id = ${userId}
      `;
    } catch (error) {
      console.warn('[Neon] Error en getBudgets, consultando memoria:', error);
    }
  }

  const userBudgets = getUserMap(inMemoryStore.budgets, userId);
  return Array.from(userBudgets.values());
}

export async function deleteBudget(id: string, userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`DELETE FROM budgets WHERE id = ${id} AND user_id = ${userId}`;
      return;
    } catch (error) {
      console.warn('[Neon] Error en deleteBudget:', error);
    }
  }

  const userBudgets = getUserMap(inMemoryStore.budgets, userId);
  userBudgets.delete(id);
}

// Goals operations
export async function createGoal(goal: {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string;
  icon?: string;
}) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO goals (id, user_id, name, target_amount, current_amount, deadline, color, icon, created_at, updated_at)
        VALUES (${goal.id}, ${goal.userId}, ${goal.name}, ${goal.targetAmount}, ${goal.currentAmount}, ${goal.deadline}, ${goal.color}, ${goal.icon || 'piggy-bank'}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          target_amount = EXCLUDED.target_amount,
          current_amount = EXCLUDED.current_amount,
          deadline = EXCLUDED.deadline,
          color = EXCLUDED.color,
          icon = EXCLUDED.icon,
          updated_at = NOW()
      `;
      return;
    } catch (error) {
      console.warn('[Neon] Error en createGoal, usando memoria:', error);
    }
  }

  const userGoals = getUserMap(inMemoryStore.goals, goal.userId);
  userGoals.set(goal.id, {
    id: goal.id,
    user_id: goal.userId,
    name: goal.name,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    deadline: goal.deadline,
    color: goal.color,
    icon: goal.icon || 'piggy-bank',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getGoals(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      return await sql`
        SELECT * FROM goals 
        WHERE user_id = ${userId}
      `;
    } catch (error) {
      console.warn('[Neon] Error en getGoals, consultando memoria:', error);
    }
  }

  const userGoals = getUserMap(inMemoryStore.goals, userId);
  return Array.from(userGoals.values());
}

export async function deleteGoal(id: string, userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`DELETE FROM goals WHERE id = ${id} AND user_id = ${userId}`;
      return;
    } catch (error) {
      console.warn('[Neon] Error en deleteGoal:', error);
    }
  }

  const userGoals = getUserMap(inMemoryStore.goals, userId);
  userGoals.delete(id);
}

// Obligations operations
export async function createObligation(obligation: {
  id: string;
  userId: string;
  name: string;
  amount: number;
  category: string;
  payCycle: string;
  isPaid: boolean;
}) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO obligations (id, user_id, name, amount, category, pay_cycle, is_paid, created_at, updated_at)
        VALUES (
          ${obligation.id}, 
          ${obligation.userId}, 
          ${obligation.name}, 
          ${obligation.amount}, 
          ${obligation.category}, 
          ${obligation.payCycle},
          ${obligation.isPaid},
          NOW(), 
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          pay_cycle = EXCLUDED.pay_cycle,
          is_paid = EXCLUDED.is_paid,
          updated_at = NOW()
      `;
      return;
    } catch (error) {
      console.warn('[Neon] Error en createObligation, usando memoria:', error);
    }
  }

  const userObligations = getUserMap(inMemoryStore.obligations, obligation.userId);
  userObligations.set(obligation.id, {
    id: obligation.id,
    user_id: obligation.userId,
    name: obligation.name,
    amount: obligation.amount,
    category: obligation.category,
    pay_cycle: obligation.payCycle,
    is_paid: obligation.isPaid,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function getObligations(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      return await sql`
        SELECT * FROM obligations 
        WHERE user_id = ${userId}
      `;
    } catch (error) {
      console.warn('[Neon] Error en getObligations, consultando memoria:', error);
    }
  }

  const userObligations = getUserMap(inMemoryStore.obligations, userId);
  return Array.from(userObligations.values());
}

export async function deleteObligation(id: string, userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`DELETE FROM obligations WHERE id = ${id} AND user_id = ${userId}`;
      return;
    } catch (error) {
      console.warn('[Neon] Error en deleteObligation:', error);
    }
  }

  const userObligations = getUserMap(inMemoryStore.obligations, userId);
  userObligations.delete(id);
}

// User settings operations
export async function saveSettings(userId: string, settings: Record<string, unknown>) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO user_settings (user_id, settings, updated_at)
        VALUES (${userId}, ${JSON.stringify(settings)}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          settings = EXCLUDED.settings,
          updated_at = NOW()
      `;
      return;
    } catch (error) {
      console.warn('[Neon] Error en saveSettings, usando memoria:', error);
    }
  }

  inMemoryStore.settings.set(userId, settings);
}

export async function getSettings(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      const result = await sql`
        SELECT settings FROM user_settings WHERE user_id = ${userId}
      `;
      return result[0]?.settings || null;
    } catch (error) {
      console.warn('[Neon] Error en getSettings, consultando memoria:', error);
    }
  }

  return inMemoryStore.settings.get(userId) || null;
}
