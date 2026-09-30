export type BillingPeriod = 'monthly' | 'annual';

export interface IndividualPlan {
  id: 'individual_monthly';
  target: 'INDIVIDUAL';
  label: string;
  priceCents: number;
  currency: 'EUR';
  periodDays: 30;
}

export interface GroupSeatTier {
  id: string;
  label: string;
  maxSeats: number;
  monthlyPriceCents: number;
  // "10 mois pour le prix de 12" — mêmes proportions que le plan individuel,
  // simple à communiquer.
  annualPriceCents: number;
}

// Comparable direct : Cozi Family Organizer (app de calendrier familial,
// même catégorie) facture son premium ~30-40$/AN, pas par mois — les prix
// "SaaS pro" (Slack/Notion) n'ont rien à faire ici.
export const INDIVIDUAL_PLAN: IndividualPlan = {
  id: 'individual_monthly',
  target: 'INDIVIDUAL',
  label: 'Premium individuel',
  priceCents: 499,
  currency: 'EUR',
  periodDays: 30,
};

// Segmentation par type d'acheteur, pas juste par volume : en dessous, le
// payeur sort l'argent de sa propre poche (famille, amis) — le prix doit
// rester proche de l'individuel. Le palier "Organisation" cible des clubs,
// équipes sportives, entreprises — un budget, pas un portefeuille perso —
// d'où l'écart net avec le palier du dessous plutôt qu'une dégression
// linéaire au siège.
export const GROUP_SEAT_TIERS: GroupSeatTier[] = [
  {
    id: 'group_small',
    label: 'Famille & amis',
    maxSeats: 15,
    monthlyPriceCents: 699,
    annualPriceCents: 6990,
  },
  {
    id: 'group_medium',
    label: 'Groupe étendu',
    maxSeats: 50,
    monthlyPriceCents: 1299,
    annualPriceCents: 12990,
  },
  {
    id: 'group_large',
    label: 'Organisation (club, équipe, entreprise)',
    maxSeats: 300,
    monthlyPriceCents: 3499,
    annualPriceCents: 34990,
  },
];

export const TRIAL_DAYS = 14;
export const REFERRAL_THRESHOLD = 3;
export const REFERRAL_REWARD_DAYS = 30;
// Fenêtre après l'inscription pendant laquelle accepter une invitation
// compte comme "a rejoint l'app grâce à ce lien" (proxy imparfait mais
// suffisant sans système de code de parrainage dédié au signup).
export const REFERRAL_ATTRIBUTION_WINDOW_HOURS = 72;

export function tierForSeats(seats: number): GroupSeatTier | undefined {
  return GROUP_SEAT_TIERS.find((t) => seats <= t.maxSeats);
}

export function groupPriceCents(seats: number, period: BillingPeriod): number {
  const tier = tierForSeats(seats);
  if (!tier) {
    throw new Error(`No tier available for ${seats} seats`);
  }
  return period === 'annual' ? tier.annualPriceCents : tier.monthlyPriceCents;
}

export function groupPeriodDays(period: BillingPeriod): number {
  return period === 'annual' ? 365 : 30;
}
