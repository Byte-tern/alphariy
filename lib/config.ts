// Все пороги — ДЕМО-допущения команды, не критерии Альфа-Банка. Заменить после ответов эксперта.
export const CFG = {
  rulesVersion: 'demo-2026.10',
  refiMin: 3, refiMax: 12,
  bondMinAmount: 300, bondMinTerm: 24,
  bondPrepMonths: 4,
  bondProjectConsult: 500, // С2: проект от этой суммы → облигации как консультация
  syndAmount: 1000, syndStages: 3,
  rate: { loan: 0.19, refi: 0.16, bonds: 0.16 },
  refiFee: 6, // разовые расходы рефинансирования (комиссия, досрочное погашение)
  bondFee: 6, bondFeeRepeat: 2, // разовые расходы выпуска; повторный выпуск дешевле
  groupFactor: 3.2, // долг группы ≈ долг компании × коэффициент (демо), если финансы централизованы
  maxContacts30: 5, emailGapDays: 60, notNowDays: 90, ignoreDays: 60,
  backThreshold: 2, compareThreshold: 2, idleSec: 45,
}
// source: mock — заглушка вместо выхода банковского look-alike. Это не вероятности.
export const MOCK_SCORES: Record<string, number> = { loan: 0.62, refi: 0.55, lease: 0.5, bonds: 0.48, synd: 0.44, cfa: 0.31 }
// Ручные веса признаков ранжирования (идея Алана: усилить вес новых фич). Демо-допущение.
export const RANK_W = { old: 0.35, urgency: 0.40, intent: 0.25 }
export const CAND_KEEP = 0.7 // доля кандидатов, которую пропускает генерация кандидатов
