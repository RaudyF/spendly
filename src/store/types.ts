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

export interface SyncState {
  isSyncing: boolean;
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
  goals: SavingsGoal[];
  insights: AIInsight[];
  profile: UserProfile | null;

  // UI State
  isLoading: boolean;
  isOnboarded: boolean;
  currentMonth: string;
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
  restoreData: (
    data: any,
    mode: 'replace' | 'merge'
  ) => Promise<{ success: boolean; message: string; error?: string }>;

  // Utility
  recalculateStats: () => void;
  setCurrentMonth: (month: string) => void;
  setActivePayCycle: (cycle: PayCycle) => void;
  resetStore: () => Promise<void>;
}

export type StoreSet = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>),
  replace?: boolean
) => void;

export type StoreGet = () => AppState;
