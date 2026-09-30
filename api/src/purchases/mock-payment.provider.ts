import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentProvider, PurchaseResult } from './payment-provider';

/**
 * Bac à sable : accepte tout achat instantanément, sans jamais toucher
 * d'argent réel. Sert à construire et tester tout le flux (écran de
 * pricing, activation, gestion des sièges, annulation) avant de brancher un
 * vrai prestataire — nécessaire pour publier sur les stores, qui imposent
 * leurs propres achats intégrés.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async purchase(): Promise<PurchaseResult> {
    return { providerRef: `mock_${randomUUID()}` };
  }

  async cancel(): Promise<void> {
    // rien à faire côté prestataire pour un mock
  }
}
