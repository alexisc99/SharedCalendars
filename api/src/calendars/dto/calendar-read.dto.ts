import { ApiProperty } from '@nestjs/swagger';
import { MemberRole } from '@prisma/client';

export class CalendarReadDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, required: false }) color?: string | null;
  @ApiProperty() isPremium!: boolean;

  @ApiProperty({ enum: MemberRole }) role!: MemberRole;

  @ApiProperty() membersCount!: number;
  @ApiProperty() eventsCount!: number;

  @ApiProperty() publicIcsEnabled!: boolean;

  @ApiProperty() createdAt!: Date;
}
