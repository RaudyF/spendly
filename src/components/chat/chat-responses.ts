import { CATEGORIES } from '@/lib/constants';

interface FinancialContext {
  totalExpenses?: number;
  savingsRate?: number;
  topCategories?: Array<{ name: string; amount: number }>;
  budgetUtilization?: number;
}

// Simple local responses when Gemini is not available
export const getLocalResponse = (message: string, context: FinancialContext): string => {
  const lowerMessage = message.toLowerCase();

  // Greetings
  if (lowerMessage.match(/^(hola|buenos dias|buenas tardes|buenas noches|saludos)/)) {
    return "¡Hola! Soy tu asistente de SaldoClaro. Puedo ayudarte a entender tus gastos, sugerirte formas de ahorrar y responder preguntas sobre tus finanzas. ¿Qué te gustaría saber?";
  }

  // How am I doing / status questions
  if (lowerMessage.includes('cómo voy') || lowerMessage.includes('mi estado') || lowerMessage.includes('salud financiera')) {
    if (context.totalExpenses && context.totalExpenses > 0) {
      const savingsRate = context.savingsRate || 0;
      let status = '';
      if (savingsRate >= 20) {
        status = `¡Excelente trabajo! Estás ahorrando el ${savingsRate}% de tus ingresos, lo cual es excelente.`;
      } else if (savingsRate >= 10) {
        status = `Vas bien con una tasa de ahorro del ${savingsRate}%. Intenta subirla al 20% para una mejor salud financiera.`;
      } else if (savingsRate > 0) {
        status = `Tu tasa de ahorro es del ${savingsRate}%. Considera reducir algunos gastos para ahorrar más.`;
      } else {
        status = "Estás gastando más de lo que ganas este mes. Veamos dónde puedes recortar gastos.";
      }
      return status;
    }
    return "Aún no tengo suficientes datos para evaluar tu salud financiera. ¡Empieza a registrar tus ingresos y gastos para obtener consejos personalizados!";
  }

  // Spending / expenses
  if (lowerMessage.includes('gasto') || lowerMessage.includes('dinero') || (lowerMessage.includes('dónde') && lowerMessage.includes('dinero'))) {
    if (context.topCategories && context.topCategories.length > 0) {
      const top = context.topCategories.slice(0, 3);
      const catList = top.map((c) => `${c.name} (RD$ ${c.amount.toLocaleString()})`).join(', ');
      return `Tus categorías de mayor gasto son: ${catList}. Enfócate en estas áreas si quieres reducir tus gastos.`;
    }
    return "¡Añade algunos gastos para ver a dónde va tu dinero! Te ayudaré a analizar tus patrones de consumo.";
  }

  // Save money tips
  if (lowerMessage.includes('ahorrar') || lowerMessage.includes('ahorro') || lowerMessage.includes('recortar') || lowerMessage.includes('reducir')) {
    const tips = [
      "Prueba la regla 50/30/20: 50% para necesidades, 30% para deseos y 20% para ahorros.",
      "Revisa tus suscripciones - cancela cualquiera que no hayas usado en el último mes.",
      "Prepara tus comidas los fines de semana para reducir los gastos en restaurantes y delivery.",
      "Espera 24 horas antes de realizar cualquier compra no esencial de más de RD$ 2,500.",
      "Configura transferencias automáticas a tu cuenta de ahorros justo después del día de pago.",
      "Usa aplicaciones de cashback y extensiones de navegador para tus compras diarias.",
    ];
    const randomTips = tips.sort(() => Math.random() - 0.5).slice(0, 2);
    return `Aquí tienes algunos consejos para ahorrar más:\n\n• ${randomTips.join('\n• ')}\n\n¿Te gustaría recibir consejos más específicos basados en tus gastos?`;
  }

  // Budget
  if (lowerMessage.includes('presupuesto')) {
    if (context.budgetUtilization !== undefined) {
      if (context.budgetUtilization > 90) {
        return `Has usado el ${context.budgetUtilization}% de tus presupuestos este mes. ¡Ten cuidado con los gastos restantes!`;
      } else if (context.budgetUtilization > 70) {
        return `Has usado el ${context.budgetUtilization}% de tus presupuestos. Vas por buen camino, pero sigue monitoreando.`;
      } else {
        return `Solo has usado el ${context.budgetUtilization}% de tus presupuestos. ¡Excelente disciplina! Considera poner el extra en tus ahorros.`;
      }
    }
    return "Configura presupuestos para tus categorías de gastos para tener un mejor control de tus finanzas. ¡Ve a la página de Presupuestos para crearlos!";
  }

  // Goals
  if (lowerMessage.includes('meta') || lowerMessage.includes('objetivo')) {
    return "¡Establecer metas financieras es una excelente manera de mantener la motivación! Puedes crear metas de ahorro en la sección de Metas. ¿Te gustaría recibir consejos para alcanzar tus metas más rápido?";
  }

  // Categories
  if (lowerMessage.includes('categorí') || lowerMessage.includes('categoria')) {
    const categories = CATEGORIES.map(c => c.name).join(', ');
    return `SaldoClaro soporta estas categorías de gastos: ${categories}. Cuando añades un gasto, se categoriza para ayudarte a entender tus patrones de consumo.`;
  }

  // Help
  if (lowerMessage.includes('ayuda') || lowerMessage.includes('qué puedes hacer') || lowerMessage.includes('funciones')) {
    return "Puedo ayudarte con:\n\n• Analizar tus patrones de gastos\n• Sugerir formas de ahorrar dinero\n• Monitorear el progreso de tu presupuesto\n• Entender tu salud financiera\n• Consejos para alcanzar tus metas de ahorro\n\n¡Solo pregúntame cualquier cosa sobre tus finanzas!";
  }

  // Thank you
  if (lowerMessage.includes('gracias')) {
    return "¡De nada! Déjame saber si tienes alguna otra pregunta sobre tus finanzas. ¡Estoy aquí para ayudar! 💰";
  }

  // Default response
  return "Puedo ayudarte con presupuestos, registro de gastos y ahorro de dinero. Intenta preguntarme:\n\n• \"¿Cómo voy financieramente?\"\n• \"¿A dónde va mi dinero?\"\n• \"¿Cómo puedo ahorrar más?\"\n• \"¿Cuál es el estado de mi presupuesto?\"";
};
