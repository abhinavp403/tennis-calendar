// Rankings snapshot keys come in two forms:
//   "YYYY-MM"    — legacy monthly (Jan–Jun 2026), treated as that month's last day
//   "YYYY-MM-DD" — bi-weekly, the exact Monday the rankings reflect
// Single normalization point so Calendar and RankingsDialog can't drift apart.
export function rankingKeyDate(key) {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m, 0); // day 0 of next month = last day of this month
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const isDateKey = key => /^\d{4}-\d{2}-\d{2}$/.test(key ?? '');
