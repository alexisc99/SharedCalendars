export type GroupCalendarStats = {
  calendarId: string;
  groupPlanId: string;

  plan: {
    isActive: boolean;
    expiresAt: string | null;
    daysToExpiration: number | null;
    gracePeriodDays: number;
    isInGracePeriod: boolean;
  };

  seats: {
    total: number | null;
    used: number;
    remaining: number | null;
  };

  activity: {
    last7Days: number;
    last30Days: number;
    topContributors: Array<{ userId: string; actions: number }>;
  };
};
