import {
  Expense,
  Income,
  Budget,
  Obligation,
  SavingsGoal,
  UserProfile,
  AIInsight,
  CategoryType,
  MonthlyStats,
  PayCycle,
} from '@/types';

export interface DatabaseStatus {
  connected: boolean;
  configured: boolean;
  type: 'neon' | 'postgres' | 'mock';
  message: string;
}

export type SyncStatus =
  | 'saved_locally'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

export interface SyncState {
  status: SyncStatus;
  isOnline: boolean;
  isSyncing: boolean;
  pendingChangesCount: number;
  lastSyncTime: string | null;
  syncError: string | null;
  dbStatus?: DatabaseStatus | null;
}

export interface AppState {
  // Data
  expenses: Expense[];
  incomes: Income[];
  budgets: Budget[];
  obligations: Obligation[];
  recurringObligations: import('@/types').RecurringObligation[];
  periodStates: import('@/types').PeriodState[];
  periodRollovers: import('@/types').PeriodRollover[];
  goals: SavingsGoal[];
  insights: AIInsight[];
  profile: UserProfile | null;

  // UI State
  isLoading: boolean;
  isOnboarded: boolean;
  currentMonth: string;
  viewingPeriod: string;
  activePayCycle: PayCycle;
  theme: 'light' | 'dark' | 'system';
  currentUserId: string | null;
  
  // Sync State
  sync: SyncState;

  // Computed
  monthlyStats: MonthlyStats | null;
  financialHealth: { score: number; status: 'excellent' | 'good' | 'fair' | 'poor' } | null;

  // Actions
  initialize: (userId?: string) => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Expense actions
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Expense>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Income actions
  addIncome: (income: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Income>;
  updateIncome: (id: string, updates: Partial<Income>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;

  // Budget actions
  setBudget: (category: CategoryType, limit: number) => Promise<void>;
  initializeDefaultBudgets: (monthlyIncome: number) => Promise<void>;

  // Obligation actions
  addObligation: (obligation: Omit<Obligation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Obligation>;
  updateObligation: (id: string, updates: Partial<Obligation>) => Promise<void>;
  deleteObligation: (id: string) => Promise<void>;

  addRecurringObligation: (obligation: Omit<import('@/types').RecurringObligation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<import('@/types').RecurringObligation>;
  updateRecurringObligation: (id: string, updates: Partial<import('@/types').RecurringObligation>) => Promise<void>;
  deleteRecurringObligation: (id: string) => Promise<void>;

  ensurePeriodInitialized: (period: string) => Promise<void>;
  generatePeriodObligations: (period: string) => Promise<{ created: number; skipped: number; alreadyExisted: number }>;
  registerPayment: (obligationId: string, amount: number, realDate: string, payCycle: import('@/types').PayCycle, financialPeriod?: string) => Promise<Expense | null | void>;
  revertPayment: (expenseId: string, obligationId: string) => Promise<void>;
  cancelObligation: (obligationId: string) => Promise<void>;

  // Period Closing & Rollover actions
  getPeriodState: (period: string, cycle: import('@/types').PeriodCycle) => import('@/types').PeriodState | undefined;
  getEffectivePeriodStatus: (period: string, cycle: import('@/types').PeriodCycle) => import('@/types').PeriodStatus;
  isPeriodClosed: (period: string, cycle?: import('@/types').PeriodCycle) => boolean;
  calculatePeriodSummary: (period: string, cycle: import('@/types').PeriodCycle) => import('@/types').PeriodFinancialSummary;
  getRolloversForPeriod: (period: string, cycle: import('@/types').PeriodCycle) => { received: import('@/types').PeriodRollover[]; sent: import('@/types').PeriodRollover[] };
  closePeriod: (params: {
    period: string;
    cycle: import('@/types').PeriodCycle;
    carryAmount?: number;
    goalAllocation?: { goalId: string; amount: number };
    destinationPeriod?: string;
    destinationCycle?: import('@/types').PeriodCycle;
  }) => Promise<import('@/types').PeriodState>;
  reopenPeriod: (params: {
    period: string;
    cycle: import('@/types').PeriodCycle;
    reason: string;
  }) => Promise<import('@/types').PeriodState>;

  // Goal actions
  addGoal: (goal: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SavingsGoal>;
  updateGoal: (id: string, updates: Partial<SavingsGoal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addToGoal: (id: string, amount: number) => Promise<void>;

  // Profile actions
  setProfile: (profile: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: () => Promise<void>;

  // Insight actions
  refreshInsights: () => void;
  dismissInsight: (id: string) => Promise<void>;

  // Sync actions
  syncToCloud: () => Promise<{ success: boolean; error?: string }>;
  syncFromCloud: () => Promise<{ success: boolean; error?: string }>;
  clearSyncError: () => void;
  checkDatabaseStatus: () => Promise<DatabaseStatus>;
  enqueuePendingChange: (change: {
    entityType: import('@/lib/db').PendingChange['entityType'];
    action: import('@/lib/db').PendingChange['action'];
    entityId: string;
    payload?: any;
  }) => Promise<void>;
  processPendingQueue: () => Promise<{ success: boolean; syncedCount?: number; error?: string }>;
  scheduleBackgroundSync: () => void;
  setOnlineStatus: (isOnline: boolean) => void;
  restoreData: (
    data: any,
    mode: 'replace' | 'merge'
  ) => Promise<{ success: boolean; message: string; error?: string }>;

  // Utility
  recalculateStats: () => void;
  setCurrentMonth: (month: string) => void;
  setViewingPeriod: (period: string) => void;
  setActivePayCycle: (cycle: PayCycle) => void;
  resetStore: () => Promise<void>;
}

export type StoreSet = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>),
  replace?: boolean
) => void;

export type StoreGet = () => AppState;
