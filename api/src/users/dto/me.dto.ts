export class MeDto {
  user!: {
    id: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
    isPremium: boolean;
    createdAt: Date;
  };

  integrations!: {
    googleConnected: boolean;
  };

  notifications!: {
    unreadCount: number;
    preferences: { type: string; enabled: boolean }[];
  };
}
