export type RsvpStatus = "YES" | "MAYBE" | "NO";

// Libellés affichés — le statut lui-même (YES/MAYBE/NO) reste la valeur
// envoyée à l'API, seul l'affichage est en français.
export const RSVP_LABELS: Record<RsvpStatus, string> = {
  YES: "OUI",
  MAYBE: "PEUT-ÊTRE",
  NO: "NON",
};

export const RSVP_COLORS: Record<RsvpStatus, string> = {
  YES: "#22c55e",
  MAYBE: "#f59e0b",
  NO: "#ef4444",
};
