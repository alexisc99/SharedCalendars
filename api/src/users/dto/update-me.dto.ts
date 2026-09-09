import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Champs modifiables par l'utilisateur lui-même via PATCH /users/me.
 * Volontairement restrictif : avant ce DTO, le endpoint acceptait un body
 * non typé et le passait tel quel à prisma.user.update() — n'importe quel
 * champ (isPremium, password, email…) pouvait être écrasé par le client.
 */
export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;
}
