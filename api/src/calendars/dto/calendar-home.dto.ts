import { MemberRole } from '@prisma/client';

export class CalendarHomeDto {
  calendar!: {
    id: string;
    name: string;
    color?: string | null;
    theme?: string | null;
    isPremium: boolean;
    publicIcsEnabled: boolean;
    role: MemberRole;
  };

  members!: {
    total: number;
    premiumSeats?: {
      total: number;
      used: number;
      remaining: number;
    } | null;
  };

  upcomingEvents!: {
    id: string;
    title: string;
    startDateTime: Date;
    endDateTime: Date;
  }[];

  activity!: {
    last7d: { events: number; comments: number; files: number };
    last30d: { events: number; comments: number; files: number };
  };

  integrations!: {
    google: {
      enabled: boolean;
      syncMode: 'NONE' | 'MANUAL' | 'AUTO';
    };
  };

  permissions!: {
    canEdit: boolean;
    canInvite: boolean;
    canManagePremium: boolean;
  };
}
