// Type definitions for the SaldoClaro App

export type PayCycle = 'Q1' | 'Q2' | 'MONTHLY';

export interface BaseSyncEntity {
  id: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  source?: string;
  sourceId?: string;
}

export interface Expense extends BaseSyncEntity {
  amount: number;
  description: string;
  category: CategoryType;
  date: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
  payCycle?: PayCycle;
  notes?: string;
  tags?: string[];
  obligationId?: string;
  status?: 'active' | 'reverted';
  financialPeriod?: string;
  realDate?: string;
}

export type IncomeClassification = 'salary' | 'additional';
export type IncomeStatus = 'expected' | 'received';

export interface Income extends BaseSyncEntity {
  amount: number;
  source: string;
  date: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
  payCycle?: PayCycle;
  type?: IncomeClassification;
  status?: IncomeStatus;
}

export interface Budget extends BaseSyncEntity {
  category: CategoryType;
  limit: number;
  spent: number;
  month: string;
  periodType?: PayCycle;
}

export type RecurrenceFrequency = 'monthly' | 'biweekly';

export interface RecurringObligation extends BaseSyncEntity {
  name: string;
  amount: number;
  category: CategoryType;
  frequency: RecurrenceFrequency;
  dayOfMonth: number;
  payCycle: PayCycle;
  startDate: string; // YYYY-MM or YYYY-MM-DD
  endDate?: string; // YYYY-MM or YYYY-MM-DD
  isActive: boolean;
}

export type ObligationStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface Obligation extends BaseSyncEntity {
  name: string;
  amount: number;
  category: CategoryType;
  dueDate?: string;
  payCycle: PayCycle;
  isPaid: boolean; // deprecated but kept for compat
  status?: ObligationStatus; // new
  period: string; // YYYY-MM
  templateId?: string; // Link back to RecurringObligation
  idempotencyKey?: string; // Unique key: userId + templateId + period
}

export interface SavingsGoal extends BaseSyncEntity {
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  color: string;
  icon: string;
}

export type IncomeFrequency = 'monthly' | 'biweekly' | 'variable';

export interface UserProfile extends BaseSyncEntity {
  name: string;
  email?: string;
  photoURL?: string;
  monthlyIncome: number;
  incomeFrequency?: IncomeFrequency;
  currency: string;
  onboardingCompleted: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  accentColor: AccentColor;
  compactMode: boolean;
  showAnimations: boolean;
  defaultView: 'dashboard' | 'expenses' | 'budget';
  notificationsEnabled: boolean;
  weekStartsOn: 0 | 1 | 6;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  showCents: boolean;
}

export type AccentColor = 'coral' | 'purple' | 'teal' | 'blue' | 'green' | 'amber';

export type CategoryType =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'utilities'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'travel'
  | 'subscriptions'
  | 'other';

export interface CategoryInfo {
  id: CategoryType;
  name: string;
  icon: string;
  color: string;
  gradient: string;
}

export interface FinancialHealth {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  tips: string[];
  savingsRate: number;
  spendingTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface AIInsight {
  id: string;
  type: 'tip' | 'warning' | 'achievement' | 'pattern';
  title: string;
  description: string;
  category?: CategoryType;
  createdAt: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface MonthlyStats {
  month: string;
  payCycle?: PayCycle;
  totalIncome: number;
  receivedIncome: number;
  expectedIncome: number;
  salaryReceived: number;
  additionalReceived: number;
  baseSalaryExpected: number;
  pendingSalary: number;
  totalExpenses: number;
  savings: number;
  committed: number;
  freeAvailable: number;
  projectedFreeAvailable: number;
  byCategory: Record<CategoryType, number>;
  q1Stats?: {
    income: number;
    expectedSalary: number;
    salaryReceived: number;
    additionalReceived: number;
    receivedIncome: number;
    pendingSalary: number;
    expenses: number;
    committed: number;
    freeAvailable: number;
    initialBalance?: number;
  };
  q2Stats?: {
    income: number;
    expectedSalary: number;
    salaryReceived: number;
    additionalReceived: number;
    receivedIncome: number;
    pendingSalary: number;
    expenses: number;
    committed: number;
    freeAvailable: number;
    initialBalance?: number;
  };
  initialBalance?: number;
}

// Phase 5: Period Closing & Rollover Types
export type PeriodStatus = 'open' | 'pending_review' | 'closed';
export type PeriodCycle = 'Q1' | 'Q2' | 'MONTHLY';

export interface ObligationBreakdownSummary {
  totalCount: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  cancelledCount: number;
  totalCommitted: number;
  paidAmount: number;
  pendingAmount: number;
}

export interface PeriodFinancialSummary {
  period: string; // YYYY-MM
  cycle: PeriodCycle;
  expectedIncome: number;
  receivedIncome: number;
  pendingIncome: number;
  salaryReceived: number;
  additionalReceived: number;
  totalExpenses: number;
  obligations: ObligationBreakdownSummary;
  budgetSpent: number;
  budgetLimit: number;
  initialBalance: number; // Saldo inicial por arrastre recibido
  realFreeAvailable: number; // Disponible real (sobre ingresos reales recibidos)
  projectedFreeAvailable: number; // Disponible proyectado (con ingresos esperados)
  eligibleCarryAmount: number; // Sobrante o déficit elegible para arrastre
  carryType: 'surplus' | 'deficit' | 'zero';
  closedAt: string;
}

export interface PeriodState extends BaseSyncEntity {
  period: string; // YYYY-MM
  cycle: PeriodCycle;
  status: PeriodStatus;
  closedAt?: string;
  reopenedAt?: string;
  reopenReason?: string;
  frozenSummary?: PeriodFinancialSummary;
}

export type RolloverType = 'surplus' | 'deficit';
export type RolloverStatus = 'pending' | 'applied' | 'cancelled';

export interface RolloverGoalAllocation {
  goalId: string;
  goalName: string;
  amount: number;
}

export interface PeriodRollover extends BaseSyncEntity {
  sourcePeriod: string; // YYYY-MM
  sourceCycle: PeriodCycle;
  destinationPeriod: string; // YYYY-MM
  destinationCycle: PeriodCycle;
  amount: number; // Monto real transferido
  type: RolloverType;
  status: RolloverStatus;
  idempotencyKey: string; // userId_srcPeriod_srcCycle_destPeriod_destCycle
  goalAllocation?: RolloverGoalAllocation;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface Transaction {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  description: string;
  category?: CategoryType;
  date: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface NotificationSettings {
  budgetAlerts: boolean;
  weeklyReports: boolean;
  goalReminders: boolean;
  unusualSpending: boolean;
}

export interface ExportData {
  version: string;
  exportDate: string;
  profile: UserProfile | null;
  preferences: UserPreferences;
  expenses: Expense[];
  incomes: Income[];
  budgets: Budget[];
  goals: SavingsGoal[];
  obligations: Obligation[];
}
