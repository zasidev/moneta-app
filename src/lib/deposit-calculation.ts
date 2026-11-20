export type DepositTerms = {
  principal: number;
  annual_rate: number;
  start_date: string;
  end_date?: string | null;
};

export function italianDay(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(date);
}

export function depositValue(terms: DepositTerms, today = italianDay()) {
  const end = terms.end_date && terms.end_date < today ? terms.end_date : today;
  const days = Math.max(0, Math.floor((Date.parse(end) - Date.parse(terms.start_date)) / 86_400_000));
  const dailyInterest = Number(terms.principal) * Number(terms.annual_rate) / 100 / 365;
  const interest = dailyInterest * days;
  return { days, dailyInterest, interest, value: Number(terms.principal) + interest };
}