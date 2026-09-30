import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditModule } from '../audit/audit.module';
import { GroupPlansModule } from '../group-plans/group-plans.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PAYMENT_PROVIDER } from './payment-provider';
import { MockPaymentProvider } from './mock-payment.provider';

@Module({
  imports: [AuditModule, GroupPlansModule],
  controllers: [PurchasesController],
  providers: [
    PurchasesService,
    PrismaService,
    // Seul ce binding change le jour où un vrai prestataire remplace le mock.
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [PurchasesService],
})
export class PurchasesModule {}
