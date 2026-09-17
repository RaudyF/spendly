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
  recurringObligations: new Map<string, Map<string, any>>(),
  periodStates: new Map<string, Map<string, any>>(),
  periodRollovers: new Map<string, Map<string, any>>(),
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

    // Non-destructive idempotent migrations for existing tables and columns
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`;

    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pay_cycle TEXT;`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS financial_period TEXT;`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS obligation_id TEXT;`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tags TEXT;`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_id TEXT;`;
    await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`;

    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS pay_cycle TEXT DEFAULT 'MONTHLY';`;
    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS financial_period TEXT;`;
    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'salary';`;
    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'received';`;
    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`;
    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;`;
    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS device_source TEXT;`;
    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS source_id TEXT;`;
    await sql`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`;

    await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS period_type TEXT DEFAULT 'MONTHLY';`;
    await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS financial_period TEXT;`;
    await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`;
    await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';`;
    await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS source_id TEXT;`;
    await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`;

    await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline TEXT;`;
    await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';`;
    await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'piggy-bank';`;
    await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`;
    await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';`;
    await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS source_id TEXT;`;
    await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`;

    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS due_date TEXT;`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS period TEXT;`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS financial_period TEXT;`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS template_id TEXT;`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS source_id TEXT;`;
    await sql`ALTER TABLE obligations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`;

    await sql`ALTER TABLE recurring_obligations ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`;
    await sql`ALTER TABLE recurring_obligations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';`;
    await sql`ALTER TABLE recurring_obligations ADD COLUMN IF NOT EXISTS source_id TEXT;`;
    await sql`ALTER TABLE recurring_obligations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`;

    await sql`ALTER TABLE period_states ADD COLUMN IF NOT EXISTS financial_period TEXT;`;
    await sql`ALTER TABLE period_states ADD COLUMN IF NOT EXISTS idempotency_key TEXT;`;
    await sql`ALTER TABLE period_states ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';`;
    await sql`ALTER TABLE period_states ADD COLUMN IF NOT EXISTS source_id TEXT;`;
    await sql`ALTER TABLE period_states ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`;

    await sql`ALTER TABLE period_rollovers ADD COLUMN IF NOT EXISTS financial_period TEXT;`;
    await sql`ALTER TABLE period_rollovers ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';`;
    await sql`ALTER TABLE period_rollovers ADD COLUMN IF NOT EXISTS source_id TEXT;`;
    await sql`ALTER TABLE period_rollovers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`;

    // Partial unique indexes for idempotent operations
    await sql`CREATE INDEX IF NOT EXISTS idx_obligations_user_id ON obligations(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_obligations_period ON obligations(user_id, period);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_obligations_idempotency_v2 ON obligations(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;`;

    // Recurring obligations table (templates)
    await sql`
      CREATE TABLE IF NOT EXISTS recurring_obligations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        category TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'monthly',
        day_of_month INT NOT NULL,
        pay_cycle TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_recurring_obligations_user_id ON recurring_obligations(user_id);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_recurring_idempotency_v2 ON recurring_obligations(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;`;

    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        settings JSONB DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Phase 5: Period States & Rollover Tables
    await sql`
      CREATE TABLE IF NOT EXISTS period_states (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        period TEXT NOT NULL,
        cycle TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        closed_at TIMESTAMP WITH TIME ZONE,
        reopened_at TIMESTAMP WITH TIME ZONE,
        reopen_reason TEXT,
        frozen_summary JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_period_states_user_id ON period_states(user_id);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_period_states_idempotency ON period_states(user_id, period, cycle);`;

    await sql`
      CREATE TABLE IF NOT EXISTS period_rollovers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_period TEXT NOT NULL,
        source_cycle TEXT NOT NULL,
        destination_period TEXT NOT NULL,
        destination_cycle TEXT NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'applied',
        idempotency_key TEXT,
        goal_allocation JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_period_rollovers_user_id ON period_rollovers(user_id);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_period_rollovers_idempotency_v2 ON period_rollovers(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;`;

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
  financialPeriod?: string;
  obligationId?: string;
  status?: string;
  notes?: string;
  tags?: string | string[];
  idempotencyKey?: string;
  gmailMessageId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
}) {
  const createdAt = expense.createdAt || new Date().toISOString();
  const updatedAt = expense.updatedAt || new Date().toISOString();
  const source = expense.source || 'web';
  const sourceId = expense.sourceId || `src_${Date.now()}`;
  const tagsStr = Array.isArray(expense.tags) ? expense.tags.join(',') : expense.tags || null;

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO expenses (
          id, user_id, amount, category, description, date, pay_cycle, 
          financial_period, obligation_id, status, notes, tags, idempotency_key, gmail_message_id,
          created_at, updated_at, deleted_at, source, source_id
        )
        VALUES (
          ${expense.id}, ${expense.userId}, ${expense.amount}, ${expense.category}, ${expense.description}, ${expense.date}, ${expense.payCycle || null},
          ${expense.financialPeriod || null}, ${expense.obligationId || null}, ${expense.status || 'active'}, ${expense.notes || null}, ${tagsStr},
          ${expense.idempotencyKey || null}, ${expense.gmailMessageId || null},
          ${createdAt}, ${updatedAt}, ${expense.deletedAt || null}, ${source}, ${sourceId}
        )
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          date = EXCLUDED.date,
          pay_cycle = EXCLUDED.pay_cycle,
          financial_period = EXCLUDED.financial_period,
          obligation_id = EXCLUDED.obligation_id,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          tags = EXCLUDED.tags,
          idempotency_key = EXCLUDED.idempotency_key,
          gmail_message_id = EXCLUDED.gmail_message_id,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          source = EXCLUDED.source,
          source_id = EXCLUDED.source_id
        WHERE EXCLUDED.updated_at >= expenses.updated_at OR expenses.updated_at IS NULL
      `;
      return;
    } catch (error: any) {
      const isUniqueViolation =
        error?.code === '23505' ||
        error?.constraint === 'idx_expenses_gmail_msg' ||
        error?.message?.includes('idx_expenses_gmail_msg');
      if (isUniqueViolation) {
        return;
      }
      console.warn('[Neon] Error en createExpense:', error);
      throw error;
    }
  }

  const userExpenses = getUserMap(inMemoryStore.expenses, expense.userId);
  const existing = userExpenses.get(expense.id);
  if (!existing || new Date(updatedAt).getTime() >= new Date(existing.updated_at || 0).getTime()) {
    userExpenses.set(expense.id, {
      id: expense.id,
      user_id: expense.userId,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      date: expense.date,
      pay_cycle: expense.payCycle || null,
      financial_period: expense.financialPeriod || null,
      obligation_id: expense.obligationId || null,
      status: expense.status || 'active',
      notes: expense.notes || null,
      tags: tagsStr,
      idempotency_key: expense.idempotencyKey || null,
      gmail_message_id: expense.gmailMessageId || null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: expense.deletedAt || null,
      source,
      source_id: sourceId,
    });
  }
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
  financialPeriod?: string;
  idempotencyKey?: string;
  gmailMessageId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  sourceId?: string;
  deviceSource?: string;
}) {
  const createdAt = income.createdAt || new Date().toISOString();
  const updatedAt = income.updatedAt || new Date().toISOString();
  const sourceId = income.sourceId || `src_${Date.now()}`;
  const deviceSource = income.deviceSource || 'web';

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO incomes (
          id, user_id, amount, source, date, pay_cycle, type, status,
          financial_period, idempotency_key, gmail_message_id, device_source, source_id,
          created_at, updated_at, deleted_at
        )
        VALUES (
          ${income.id}, ${income.userId}, ${income.amount}, ${income.source}, ${income.date}, ${income.payCycle || 'MONTHLY'}, ${income.type || 'salary'}, ${income.status || 'received'},
          ${income.financialPeriod || null}, ${income.idempotencyKey || null}, ${income.gmailMessageId || null}, ${deviceSource}, ${sourceId},
          ${createdAt}, ${updatedAt}, ${income.deletedAt || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          source = EXCLUDED.source,
          date = EXCLUDED.date,
          pay_cycle = EXCLUDED.pay_cycle,
          type = EXCLUDED.type,
          status = EXCLUDED.status,
          financial_period = EXCLUDED.financial_period,
          idempotency_key = EXCLUDED.idempotency_key,
          gmail_message_id = EXCLUDED.gmail_message_id,
          device_source = EXCLUDED.device_source,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          source_id = EXCLUDED.source_id
        WHERE EXCLUDED.updated_at >= incomes.updated_at OR incomes.updated_at IS NULL
      `;
      return;
    } catch (error: any) {
      const isUniqueViolation =
        error?.code === '23505' ||
        error?.constraint === 'idx_incomes_gmail_msg' ||
        error?.message?.includes('idx_incomes_gmail_msg');
      if (isUniqueViolation) {
        return;
      }
      console.warn('[Neon] Error en createIncome:', error);
      throw error;
    }
  }

  const userIncomes = getUserMap(inMemoryStore.incomes, income.userId);
  const existing = userIncomes.get(income.id);
  if (!existing || new Date(updatedAt).getTime() >= new Date(existing.updated_at || 0).getTime()) {
    userIncomes.set(income.id, {
      id: income.id,
      user_id: income.userId,
      amount: income.amount,
      source: income.source,
      date: income.date,
      pay_cycle: income.payCycle || 'MONTHLY',
      type: income.type || 'salary',
      status: income.status || 'received',
      financial_period: income.financialPeriod || null,
      idempotency_key: income.idempotencyKey || null,
      gmail_message_id: income.gmailMessageId || null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: income.deletedAt || null,
      source_id: sourceId,
      device_source: deviceSource,
    });
  }
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
  financialPeriod?: string;
  idempotencyKey?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
}) {
  const createdAt = budget.createdAt || new Date().toISOString();
  const updatedAt = budget.updatedAt || new Date().toISOString();
  const source = budget.source || 'web';
  const sourceId = budget.sourceId || `src_${Date.now()}`;

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO budgets (
          id, user_id, category, amount, period, period_type, 
          financial_period, idempotency_key, created_at, updated_at, deleted_at, source, source_id
        )
        VALUES (
          ${budget.id}, ${budget.userId}, ${budget.category}, ${budget.amount}, ${budget.period}, ${budget.periodType || 'MONTHLY'},
          ${budget.financialPeriod || null}, ${budget.idempotencyKey || null},
          ${createdAt}, ${updatedAt}, ${budget.deletedAt || null}, ${source}, ${sourceId}
        )
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          period = EXCLUDED.period,
          period_type = EXCLUDED.period_type,
          financial_period = EXCLUDED.financial_period,
          idempotency_key = EXCLUDED.idempotency_key,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          source = EXCLUDED.source,
          source_id = EXCLUDED.source_id
        WHERE EXCLUDED.updated_at >= budgets.updated_at OR budgets.updated_at IS NULL
      `;
      return;
    } catch (error: any) {
      console.warn('[Neon] Error en createBudget:', error);
      throw error;
    }
  }

  const userBudgets = getUserMap(inMemoryStore.budgets, budget.userId);
  const existing = userBudgets.get(budget.id);
  if (!existing || new Date(updatedAt).getTime() >= new Date(existing.updated_at || 0).getTime()) {
    userBudgets.set(budget.id, {
      id: budget.id,
      user_id: budget.userId,
      category: budget.category,
      amount: budget.amount,
      period: budget.period,
      period_type: budget.periodType || 'MONTHLY',
      financial_period: budget.financialPeriod || null,
      idempotency_key: budget.idempotencyKey || null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: budget.deletedAt || null,
      source,
      source_id: sourceId,
    });
  }
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
  deadline?: string | null;
  color: string;
  icon?: string;
  idempotencyKey?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
}) {
  const createdAt = goal.createdAt || new Date().toISOString();
  const updatedAt = goal.updatedAt || new Date().toISOString();
  const source = goal.source || 'web';
  const sourceId = goal.sourceId || `src_${Date.now()}`;
  const deadline = goal.deadline || null;

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO goals (
          id, user_id, name, target_amount, current_amount, deadline, color, icon, 
          idempotency_key, created_at, updated_at, deleted_at, source, source_id
        )
        VALUES (
          ${goal.id}, ${goal.userId}, ${goal.name}, ${goal.targetAmount}, ${goal.currentAmount}, ${deadline}, ${goal.color}, ${goal.icon || 'piggy-bank'},
          ${goal.idempotencyKey || null}, ${createdAt}, ${updatedAt}, ${goal.deletedAt || null}, ${source}, ${sourceId}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          target_amount = EXCLUDED.target_amount,
          current_amount = EXCLUDED.current_amount,
          deadline = EXCLUDED.deadline,
          color = EXCLUDED.color,
          icon = EXCLUDED.icon,
          idempotency_key = EXCLUDED.idempotency_key,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          source = EXCLUDED.source,
          source_id = EXCLUDED.source_id
        WHERE EXCLUDED.updated_at >= goals.updated_at OR goals.updated_at IS NULL
      `;
      return;
    } catch (error: any) {
      console.warn('[Neon] Error en createGoal:', error);
      throw error;
    }
  }

  const userGoals = getUserMap(inMemoryStore.goals, goal.userId);
  const existing = userGoals.get(goal.id);
  if (!existing || new Date(updatedAt).getTime() >= new Date(existing.updated_at || 0).getTime()) {
    userGoals.set(goal.id, {
      id: goal.id,
      user_id: goal.userId,
      name: goal.name,
      target_amount: goal.targetAmount,
      current_amount: goal.currentAmount,
      deadline: goal.deadline,
      color: goal.color,
      icon: goal.icon || 'piggy-bank',
      idempotency_key: goal.idempotencyKey || null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: goal.deletedAt || null,
      source,
      source_id: sourceId,
    });
  }
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
  dueDate?: string;
  period?: string;
  financialPeriod?: string;
  templateId?: string;
  status?: string;
  idempotencyKey?: string;
  gmailMessageId?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
}) {
  const createdAt = obligation.createdAt || new Date().toISOString();
  const updatedAt = obligation.updatedAt || new Date().toISOString();
  const source = obligation.source || 'web';
  const sourceId = obligation.sourceId || `src_${Date.now()}`;

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO obligations (
          id, user_id, name, amount, category, pay_cycle, is_paid, 
          due_date, period, financial_period, template_id, status, idempotency_key, gmail_message_id,
          created_at, updated_at, deleted_at, source, source_id
        )
        VALUES (
          ${obligation.id}, 
          ${obligation.userId}, 
          ${obligation.name}, 
          ${obligation.amount}, 
          ${obligation.category}, 
          ${obligation.payCycle},
          ${obligation.isPaid},
          ${obligation.dueDate || null},
          ${obligation.period || null},
          ${obligation.financialPeriod || null},
          ${obligation.templateId || null},
          ${obligation.status || 'pending'},
          ${obligation.idempotencyKey || null},
          ${obligation.gmailMessageId || null},
          ${createdAt}, 
          ${updatedAt},
          ${obligation.deletedAt || null},
          ${source},
          ${sourceId}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          pay_cycle = EXCLUDED.pay_cycle,
          is_paid = EXCLUDED.is_paid,
          due_date = EXCLUDED.due_date,
          period = EXCLUDED.period,
          financial_period = EXCLUDED.financial_period,
          template_id = EXCLUDED.template_id,
          status = EXCLUDED.status,
          idempotency_key = EXCLUDED.idempotency_key,
          gmail_message_id = EXCLUDED.gmail_message_id,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          source = EXCLUDED.source,
          source_id = EXCLUDED.source_id
        WHERE EXCLUDED.updated_at >= obligations.updated_at OR obligations.updated_at IS NULL
      `;
      return;
    } catch (error: any) {
      const isUniqueViolation =
        error?.code === '23505' ||
        error?.constraint === 'idx_obligations_idempotency_v2' ||
        error?.constraint === 'idx_obligations_idempotency' ||
        error?.message?.includes('idx_obligations_idempotency') ||
        error?.detail?.includes('idempotency_key');

      if (isUniqueViolation) {
        return;
      }
      console.warn('[Neon] Error en createObligation:', error);
      throw error;
    }
  }

  const userObligations = getUserMap(inMemoryStore.obligations, obligation.userId);
  if (obligation.idempotencyKey) {
    let exists = false;
    userObligations.forEach((existing) => {
      if (existing.idempotency_key === obligation.idempotencyKey) {
        exists = true;
      }
    });
    if (exists) return;
  }

  const existing = userObligations.get(obligation.id);
  if (!existing || new Date(updatedAt).getTime() >= new Date(existing.updated_at || 0).getTime()) {
    userObligations.set(obligation.id, {
      id: obligation.id,
      user_id: obligation.userId,
      name: obligation.name,
      amount: obligation.amount,
      category: obligation.category,
      pay_cycle: obligation.payCycle,
      is_paid: obligation.isPaid,
      due_date: obligation.dueDate || null,
      period: obligation.period || null,
      financial_period: obligation.financialPeriod || null,
      template_id: obligation.templateId || null,
      status: obligation.status || 'pending',
      idempotency_key: obligation.idempotencyKey || null,
      gmail_message_id: obligation.gmailMessageId || null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: obligation.deletedAt || null,
      source,
      source_id: sourceId,
    });
  }
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

// Recurring obligations operations (templates)
export async function createRecurringObligation(template: {
  id: string;
  userId: string;
  name: string;
  amount: number;
  category: string;
  frequency: string;
  dayOfMonth: number;
  payCycle: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  idempotencyKey?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
}) {
  const createdAt = template.createdAt || new Date().toISOString();
  const updatedAt = template.updatedAt || new Date().toISOString();
  const source = template.source || 'web';
  const sourceId = template.sourceId || `src_${Date.now()}`;

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO recurring_obligations (
          id, user_id, name, amount, category, frequency, day_of_month,
          pay_cycle, start_date, end_date, is_active, idempotency_key, created_at, updated_at, deleted_at, source, source_id
        )
        VALUES (
          ${template.id},
          ${template.userId},
          ${template.name},
          ${template.amount},
          ${template.category},
          ${template.frequency},
          ${template.dayOfMonth},
          ${template.payCycle},
          ${template.startDate},
          ${template.endDate || null},
          ${template.isActive},
          ${template.idempotencyKey || null},
          ${createdAt},
          ${updatedAt},
          ${template.deletedAt || null},
          ${source},
          ${sourceId}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          frequency = EXCLUDED.frequency,
          day_of_month = EXCLUDED.day_of_month,
          pay_cycle = EXCLUDED.pay_cycle,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          is_active = EXCLUDED.is_active,
          idempotency_key = EXCLUDED.idempotency_key,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          source = EXCLUDED.source,
          source_id = EXCLUDED.source_id
        WHERE EXCLUDED.updated_at >= recurring_obligations.updated_at OR recurring_obligations.updated_at IS NULL
      `;
      return;
    } catch (error: any) {
      const isUniqueViolation =
        error?.code === '23505' ||
        error?.constraint === 'idx_recurring_idempotency_v2' ||
        error?.message?.includes('idx_recurring_idempotency');
      if (isUniqueViolation) {
        return;
      }
      console.warn('[Neon] Error en createRecurringObligation:', error);
      throw error;
    }
  }

  const userRec = getUserMap(inMemoryStore.recurringObligations, template.userId);
  const existing = userRec.get(template.id);
  if (!existing || new Date(updatedAt).getTime() >= new Date(existing.updated_at || 0).getTime()) {
    userRec.set(template.id, {
      id: template.id,
      user_id: template.userId,
      name: template.name,
      amount: template.amount,
      category: template.category,
      frequency: template.frequency,
      day_of_month: template.dayOfMonth,
      pay_cycle: template.payCycle,
      start_date: template.startDate,
      end_date: template.endDate || null,
      is_active: template.isActive,
      idempotency_key: template.idempotencyKey || null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: template.deletedAt || null,
      source,
      source_id: sourceId,
    });
  }
}

export async function getRecurringObligations(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      return await sql`
        SELECT * FROM recurring_obligations
        WHERE user_id = ${userId}
      `;
    } catch (error) {
      console.warn('[Neon] Error en getRecurringObligations, consultando memoria:', error);
    }
  }
  const userRec = getUserMap(inMemoryStore.recurringObligations, userId);
  return Array.from(userRec.values());
}

export async function deleteRecurringObligation(id: string, userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`DELETE FROM recurring_obligations WHERE id = ${id} AND user_id = ${userId}`;
      return;
    } catch (error) {
      console.warn('[Neon] Error en deleteRecurringObligation:', error);
    }
  }
  const userRec = getUserMap(inMemoryStore.recurringObligations, userId);
  userRec.delete(id);
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
      throw error;
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

// Phase 5: Period States operations
export async function savePeriodState(state: {
  id: string;
  userId: string;
  period: string;
  cycle: string;
  status: string;
  financialPeriod?: string;
  idempotencyKey?: string;
  closedAt?: string | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  frozenSummary?: any;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
}) {
  const createdAt = state.createdAt || new Date().toISOString();
  const updatedAt = state.updatedAt || new Date().toISOString();
  const source = state.source || 'web';
  const sourceId = state.sourceId || `src_${Date.now()}`;

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO period_states (
          id, user_id, period, cycle, status,
          financial_period, idempotency_key,
          closed_at, reopened_at, reopen_reason, frozen_summary, created_at, updated_at, deleted_at, source, source_id
        ) VALUES (
          ${state.id},
          ${state.userId},
          ${state.period},
          ${state.cycle},
          ${state.status},
          ${state.financialPeriod || null},
          ${state.idempotencyKey || null},
          ${state.closedAt ? new Date(state.closedAt).toISOString() : null},
          ${state.reopenedAt ? new Date(state.reopenedAt).toISOString() : null},
          ${state.reopenReason || null},
          ${state.frozenSummary ? JSON.stringify(state.frozenSummary) : null},
          ${createdAt},
          ${updatedAt},
          ${state.deletedAt || null},
          ${source},
          ${sourceId}
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          financial_period = EXCLUDED.financial_period,
          idempotency_key = EXCLUDED.idempotency_key,
          closed_at = EXCLUDED.closed_at,
          reopened_at = EXCLUDED.reopened_at,
          reopen_reason = EXCLUDED.reopen_reason,
          frozen_summary = EXCLUDED.frozen_summary,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          source = EXCLUDED.source,
          source_id = EXCLUDED.source_id
        WHERE EXCLUDED.updated_at >= period_states.updated_at OR period_states.updated_at IS NULL
      `;
      return;
    } catch (error: any) {
      const isUniqueViolation =
        error?.code === '23505' ||
        error?.constraint === 'idx_period_states_idempotency' ||
        error?.message?.includes('idx_period_states_idempotency');
      if (isUniqueViolation) {
        return;
      }
      console.warn('[Neon] Error en savePeriodState:', error);
      throw error;
    }
  }

  const userPeriodStates = getUserMap(inMemoryStore.periodStates, state.userId);
  const existing = userPeriodStates.get(state.id);
  if (!existing || new Date(updatedAt).getTime() >= new Date(existing.updated_at || 0).getTime()) {
    userPeriodStates.set(state.id, {
      id: state.id,
      user_id: state.userId,
      period: state.period,
      cycle: state.cycle,
      status: state.status,
      financial_period: state.financialPeriod || null,
      idempotency_key: state.idempotencyKey || null,
      closed_at: state.closedAt || null,
      reopened_at: state.reopenedAt || null,
      reopen_reason: state.reopenReason || null,
      frozen_summary: state.frozenSummary || null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: state.deletedAt || null,
      source,
      source_id: sourceId,
    });
  }
}

export async function getPeriodStates(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      return await sql`
        SELECT * FROM period_states
        WHERE user_id = ${userId}
        ORDER BY period DESC, cycle ASC
      `;
    } catch (error) {
      console.warn('[Neon] Error en getPeriodStates, consultando memoria:', error);
    }
  }

  const userPeriodStates = getUserMap(inMemoryStore.periodStates, userId);
  return Array.from(userPeriodStates.values());
}

// Phase 5: Period Rollovers operations
export async function savePeriodRollover(rollover: {
  id: string;
  userId: string;
  sourcePeriod: string;
  sourceCycle: string;
  destinationPeriod: string;
  destinationCycle: string;
  amount: number;
  type: string;
  status: string;
  financialPeriod?: string;
  idempotencyKey?: string | null;
  goalAllocation?: any;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
}) {
  const createdAt = rollover.createdAt || new Date().toISOString();
  const updatedAt = rollover.updatedAt || new Date().toISOString();
  const source = rollover.source || 'web';
  const sourceId = rollover.sourceId || `src_${Date.now()}`;

  const sql = getSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO period_rollovers (
          id, user_id, source_period, source_cycle,
          destination_period, destination_cycle, amount,
          type, status, financial_period, idempotency_key, goal_allocation, created_at, updated_at, deleted_at, source, source_id
        ) VALUES (
          ${rollover.id},
          ${rollover.userId},
          ${rollover.sourcePeriod},
          ${rollover.sourceCycle},
          ${rollover.destinationPeriod},
          ${rollover.destinationCycle},
          ${rollover.amount},
          ${rollover.type},
          ${rollover.status},
          ${rollover.financialPeriod || null},
          ${rollover.idempotencyKey || null},
          ${rollover.goalAllocation ? JSON.stringify(rollover.goalAllocation) : null},
          ${createdAt},
          ${updatedAt},
          ${rollover.deletedAt || null},
          ${source},
          ${sourceId}
        )
        ON CONFLICT (id) DO UPDATE SET
          amount = EXCLUDED.amount,
          type = EXCLUDED.type,
          status = EXCLUDED.status,
          financial_period = EXCLUDED.financial_period,
          goal_allocation = EXCLUDED.goal_allocation,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          source = EXCLUDED.source,
          source_id = EXCLUDED.source_id
        WHERE EXCLUDED.updated_at >= period_rollovers.updated_at OR period_rollovers.updated_at IS NULL
      `;
      return;
    } catch (error: any) {
      const isUniqueViolation =
        error?.code === '23505' ||
        error?.constraint === 'idx_period_rollovers_idempotency_v2' ||
        error?.constraint === 'idx_period_rollovers_idempotency' ||
        error?.message?.includes('idx_period_rollovers_idempotency');
      if (isUniqueViolation) {
        return;
      }
      console.warn('[Neon] Error en savePeriodRollover:', error);
      throw error;
    }
  }

  const userRollovers = getUserMap(inMemoryStore.periodRollovers, rollover.userId);
  if (rollover.idempotencyKey) {
    let exists = false;
    userRollovers.forEach((existing) => {
      if (existing.idempotency_key === rollover.idempotencyKey) {
        exists = true;
      }
    });
    if (exists) return;
  }

  const existing = userRollovers.get(rollover.id);
  if (!existing || new Date(updatedAt).getTime() >= new Date(existing.updated_at || 0).getTime()) {
    userRollovers.set(rollover.id, {
      id: rollover.id,
      user_id: rollover.userId,
      source_period: rollover.sourcePeriod,
      source_cycle: rollover.sourceCycle,
      destination_period: rollover.destinationPeriod,
      destination_cycle: rollover.destinationCycle,
      amount: rollover.amount,
      type: rollover.type,
      status: rollover.status,
      financial_period: rollover.financialPeriod || null,
      idempotency_key: rollover.idempotencyKey || null,
      goal_allocation: rollover.goalAllocation || null,
      created_at: createdAt,
      updated_at: updatedAt,
      deleted_at: rollover.deletedAt || null,
      source,
      source_id: sourceId,
    });
  }
}

export async function getPeriodRollovers(userId: string) {
  const sql = getSql();
  if (sql) {
    try {
      return await sql`
        SELECT * FROM period_rollovers
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
    } catch (error) {
      console.warn('[Neon] Error en getPeriodRollovers, consultando memoria:', error);
    }
  }

  const userRollovers = getUserMap(inMemoryStore.periodRollovers, userId);
  return Array.from(userRollovers.values());
}

export async function updatePeriodRolloverStatus(id: string, userId: string, status: string) {
  const sql = getSql();
  if (sql) {
    try {
      await sql`
        UPDATE period_rollovers
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return;
    } catch (error) {
      console.warn('[Neon] Error en updatePeriodRolloverStatus:', error);
    }
  }

  const userRollovers = getUserMap(inMemoryStore.periodRollovers, userId);
  const existing = userRollovers.get(id);
  if (existing) {
    userRollovers.set(id, {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    });
  }
}
