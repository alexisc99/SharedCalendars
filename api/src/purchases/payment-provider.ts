/**
 * Abstraction du prestataire de paiement. Aujourd'hui seule une
 * implémentation "mock" existe (bac à sable, aucun argent réel) — le jour où
 * on branche un vrai prestataire (RevenueCat pour englober achats intégrés
 * Apple/Google + Stripe, ou Stripe seul), on ajoute une nouvelle classe qui
 * implémente cette interface et on change juste le binding dans
 * PurchasesModule. PurchasesService n'a rien à connaître de plus.
 */
export interface PurchaseResult {
  providerRef: string;
}

export interface PaymentProvider {
  readonly name: string;
  purchase(input: { userId: string; planId: string }): Promise<PurchaseResult>;
  cancel(input: { providerRef: string }): Promise<void>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
