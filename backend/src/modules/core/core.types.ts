export const membershipRoles = ['admin', 'contributor', 'member', 'readonly'] as const;

export type MembershipRole = (typeof membershipRoles)[number];

export type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  groupId: string;
  role: MembershipRole;
};

export type AuthTokenPayload = {
  userId: string;
  groupId: string;
  role: MembershipRole;
};
