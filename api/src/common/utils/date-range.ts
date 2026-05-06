import { BadRequestException } from '@nestjs/common';

export function assertValidRange(from?: string, to?: string) {
  if (!from || !to) return;

  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

  // class-validator gère déjà les formats; ici on évite juste le range inversé
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return;

  if (fromMs > toMs) {
    throw new BadRequestException('"from" must be <= "to"');
  }
}
