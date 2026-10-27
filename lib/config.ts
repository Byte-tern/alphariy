// Все пороги — ДЕМО-допущения команды, не критерии Альфа-Банка. Заменить после ответов эксперта.
export const CFG = {
  rulesVersion: 'demo-2026.10',
  refiMin: 3, refiMax: 12,
  bondMinAmount: 300, bondMinTerm: 24,
  bondPrepMonths: 4,
  syndAmount: 1000, syndStages: 3,
  rate: { loan: 0.19, bonds: 0.16 },
  bondFee: 6,
  maxContacts30: 5, emailGapDays: 60, notNowDays: 90, ignoreDays: 60,
  backThreshold: 2, compareThreshold: 2, idleSec: 45,
}
// source: mock — заглушка вместо выхода банковского look-alike. Это не вероятности.
export const MOCK_SCORES: Record<string, number> = { loan: 0.62, bonds: 0.48, synd: 0.44, cfa: 0.31 }
