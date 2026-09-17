'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { format, subDays, parseISO, isSameDay } from 'date-fns';
import { useStore } from '@/store';
import { formatCurrency, getPayCycleFromDate } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { CustomTooltip } from './custom-tooltip';

// Spending trend chart (Area chart)
export const SpendingChart: React.FC = () => {
  const expenses = useStore((state) => state.expenses);
  const profile = useStore((state) => state.profile);
  const viewingPeriod = useStore((state) => state.viewingPeriod);
  const activePayCycle = useStore((state) => state.activePayCycle);
  const { resolvedTheme } = useTheme();

  // Get data based on current activePayCycle
  const chartData = React.useMemo(() => {
    const days = [];
    
    // Parse current month (e.g. '2024-03')
    const [yearStr, monthStr] = viewingPeriod.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1; // 0-based
    
    const startDate = new Date(year, monthIndex, 1);
    
    // Determine start and end days
    let startDay = 1;
    let endDay = new Date(year, monthIndex + 1, 0).getDate(); // Last day of month
    
    if (activePayCycle === 'Q1') {
      endDay = 15;
    } else if (activePayCycle === 'Q2') {
      startDay = 16;
    }
    
    // Filter expenses matching current month and active cycle
    const cycleExpenses = expenses.filter((e) => {
      if (!e.date.startsWith(viewingPeriod)) return false;
      if (activePayCycle === 'MONTHLY') return true;
      return (e.payCycle || getPayCycleFromDate(e.date)) === activePayCycle;
    });

    for (let day = startDay; day <= endDay; day++) {
      const date = new Date(year, monthIndex, day);
      const dayExpenses = cycleExpenses.filter((e) => {
        const expenseDate = parseISO(e.date);
        const expDay = expenseDate.getDate();
        const targetDay = Math.min(Math.max(expDay, startDay), endDay);
        return targetDay === day;
      });
      const total = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      days.push({
        date: format(date, 'MMM d'),
        amount: total,
      });
    }
    
    return days;
  }, [expenses, viewingPeriod, activePayCycle]);

  const gridColor = resolvedTheme === 'dark' ? '#404040' : '#e5e5e5';
  const textColor = resolvedTheme === 'dark' ? '#a3a3a3' : '#737373';

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: textColor }}
            tickMargin={10}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: textColor }}
            tickFormatter={(value) => formatCurrency(value, profile?.currency, true)}
            width={60}
          />
          <Tooltip content={<CustomTooltip currency={profile?.currency} />} />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#spendingGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
