'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Target, Sparkles, Shield, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: PieChart,
    title: 'Quincenas',
    description: 'Gestiona tu dinero de forma natural. Divide tus ingresos y obligaciones por quincenas reales (Q1 y Q2).',
    color: 'primary',
  },
  {
    icon: Target,
    title: 'Disponible Libre',
    description: 'Conoce con exactitud cuánto dinero te sobra después de cubrir tus obligaciones reales y comprometidas.',
    color: 'secondary',
  },
  {
    icon: Sparkles,
    title: 'Obligaciones',
    description: 'Registra tus pagos recurrentes y asígnalos a la quincena correcta para no olvidar nada.',
    color: 'accent',
  },
  {
    icon: Shield,
    title: 'Seguro y Privado',
    description: 'Tus datos financieros están cifrados, seguros y vinculados solo a tu cuenta de Google.',
    color: 'primary',
  },
  {
    icon: Zap,
    title: 'Pronóstico Financiero',
    description: 'Visualiza qué pasará en tu próxima quincena antes de que llegue y planifica con anticipación.',
    color: 'secondary',
  },
  {
    icon: TrendingUp,
    title: 'Análisis de Gastos',
    description: 'Entiende tus patrones de consumo con reportes y gráficas simples de leer.',
    color: 'accent',
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-20 md:py-32 bg-white dark:bg-surface-950 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-surface-900 dark:text-white tracking-tight font-display"
          >
            Todo lo que necesitas para tu control financiero
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-surface-600 dark:text-surface-400"
          >
            Herramientas diseñadas para darte paz mental y visibilidad total sobre tu dinero.
          </motion.p>
        </div>

        {/* Mobile: Horizontal scroll */}
        <div className="md:hidden -mx-6 px-6">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex-shrink-0 w-[280px] snap-center p-5 rounded-2xl bg-surface-50 dark:bg-surface-900 border border-surface-100 dark:border-surface-800"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      feature.color === 'primary' && 'bg-primary-100 dark:bg-primary-900/30',
                      feature.color === 'secondary' && 'bg-secondary-100 dark:bg-secondary-900/30',
                      feature.color === 'accent' && 'bg-accent-100 dark:bg-accent-900/30'
                    )}
                  >
                    <feature.icon
                      className={cn(
                        'w-5 h-5',
                        feature.color === 'primary' && 'text-primary-600 dark:text-primary-400',
                        feature.color === 'secondary' && 'text-secondary-600 dark:text-secondary-400',
                        feature.color === 'accent' && 'text-accent-600 dark:text-accent-400'
                      )}
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          {/* Scroll indicator */}
          <div className="flex justify-center gap-1 mt-2">
            {features.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-surface-300 dark:bg-surface-700" />
            ))}
          </div>
        </div>

        {/* Desktop: Grid layout */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-6 rounded-2xl bg-surface-50 dark:bg-surface-900 border border-surface-100 dark:border-surface-800 hover:border-surface-200 dark:hover:border-surface-700 transition-colors"
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
                  feature.color === 'primary' && 'bg-primary-100 dark:bg-primary-900/30',
                  feature.color === 'secondary' && 'bg-secondary-100 dark:bg-secondary-900/30',
                  feature.color === 'accent' && 'bg-accent-100 dark:bg-accent-900/30'
                )}
              >
                <feature.icon
                  className={cn(
                    'w-6 h-6',
                    feature.color === 'primary' && 'text-primary-600 dark:text-primary-400',
                    feature.color === 'secondary' && 'text-secondary-600 dark:text-secondary-400',
                    feature.color === 'accent' && 'text-accent-600 dark:text-accent-400'
                  )}
                />
              </div>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-surface-600 dark:text-surface-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
