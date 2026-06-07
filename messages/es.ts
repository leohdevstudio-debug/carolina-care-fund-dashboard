const es = {
  header: {
    dashboardTitle: "Dashboard",
    descriptionLine1:
      "Este fondo ha sido creado para apoyar el tratamiento médico de {name}, junto con los gastos de viaje y el apoyo familiar necesario durante este proceso.",
    descriptionLine2:
      "Cada aporte ayuda a aliviar la carga económica y nos permite enfocarnos en lo más importante, su recuperación.",
    descriptionLine3: "Cada donación suma. Muchas gracias por tu apoyo.",
    beneficiary: "Beneficiario",
    baseCurrency: "Moneda base",
    targetAmount: "Meta",
    notSet: "No definido",
  },
  summary: {
    totalReceived: "Total recibido",
    totalSpent: "Total gastado",
    remainingBalance: "Balance restante",
    unallocatedBalance: "Balance no asignado",
    progressToTarget: "Progreso hacia la meta",
  },
  progress: {
    title: "Progreso de recaudación",
    funded: "financiado",
    remaining: "restante",
  },
  sections: {
    expensesByCategory: "Gastos por categoría",
    budgetVsSpent: "Presupuesto vs Gastado",
    recentDonations: "Donaciones recientes",
    recentExpenses: "Gastos recientes",
  },
  table: {
    date: "Fecha",
    donor: "Donante",
    original: "Monto original",
    base: "Monto mostrado",
    category: "Categoría",
    description: "Descripción",
  },
  charts: {
    budget: "Presupuesto",
    spent: "Gastado",
  },
  currency: {
    selectorLabel: "Moneda mostrada",
    loading: "Actualizando tasas",
    unavailable: "Las tasas de cambio no están disponibles. Mostrando AUD.",
    sourcePrefix: "Tasas de",
  },
  footer: {
    baseNote:
      "Todos los montos se reportan en {currency} - Los datos se actualizan cada 30 minutos",
    convertedNote:
      "Los montos en {currency} son conversiones aproximadas desde AUD - Los datos se actualizan cada 30 minutos",
    rateUpdated: "Tasa actualizada {date}",
    fallbackRate: "Usando la última tasa guardada disponible de {date}",
  },
};

export default es;
