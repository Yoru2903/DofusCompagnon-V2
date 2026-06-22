import type { PrismaClient, User } from '@prisma/client';
import type { MembershipRole } from './core.types.js';

export class CoreRepository {
  constructor(private readonly db: PrismaClient) {}

  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  findUserByUsername(username: string) {
    return this.db.user.findUnique({ where: { username } });
  }

  findUserWithMembership(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { group: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
  }

  createUser(input: {
    username: string;
    displayName: string;
    email: string;
    passwordHash: string;
  }) {
    return this.db.user.create({ data: input });
  }

  createGroup(input: { name: string; description?: string; createdBy: string }) {
    return this.db.group.create({ data: input });
  }

  createMembership(input: { userId: string; groupId: string; role: MembershipRole }) {
    return this.db.membership.create({ data: input });
  }

  findDefaultUser() {
    return this.db.user.findUnique({ where: { username: 'default' } });
  }

  async createDefaultGroupMembership(user: User) {
    return this.db.group.create({
      data: {
        name: 'Groupe par defaut',
        description: 'Groupe local cree automatiquement pour le developpement courant.',
        createdBy: user.id,
        memberships: {
          create: {
            userId: user.id,
            role: 'admin',
          },
        },
      },
      include: { memberships: true },
    });
  }
}
