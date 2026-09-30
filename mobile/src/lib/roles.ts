export type MemberRole = "owner" | "admin" | "editor" | "viewer" | "member";

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Chef",
  admin: "Administrateur",
  editor: "Éditeur",
  viewer: "Spectateur",
  member: "Membre",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as MemberRole] ?? role;
}
