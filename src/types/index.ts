// Type definitions for the SaldoClaro App

export type PayCycle = 'Q1' | 'Q2' | 'MONTHLY';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: CategoryType;
  date: string;
  createdAt: string;
  updatedAt: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
  payCycle?: PayCycle;
  notes?: string;
  tags?: string[];
  obligationId?: string;
}

export type IncomeClassification = 'salary' | 'additional';
export type IncomeStatus = 'expected' | 'received';

export interface Income {
  id: string;
  amount: number;
  source: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
  payCycle?: PayCycle;
  type?: IncomeClassification;
  status?: IncomeStatus;
}

export interface Budget {
  id: string;
  category: CategoryType;
  limit: number;
  spent: number;
  month: string;
  periodType?: PayCycle;
  createdAt: string;
  updatedAt: string;
}

export interface Obligation {
  id: string;
  name: string;
  amount: number;
  category: CategoryType;
  dueDate?: string;
  payCycle: PayCycle;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  color: string;
  icon: string;
}

export type IncomeFrequency = 'monthly' | 'biweekly' | 'variable';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  photoURL?: string;
  monthlyIncome: number;
  incomeFrequency?: IncomeFrequency;
  currency: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
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
  };
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
