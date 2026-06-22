export type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  groupId: string;
  role: 'admin' | 'contributor' | 'member' | 'readonly';
};

export type AuthSession = {
  user: AuthenticatedUser;
  token: string;
};
