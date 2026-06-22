import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../database/prisma.js';
import { CoreRepository } from '../modules/core/core.repository.js';
import { CoreService } from '../modules/core/core.service.js';

const service = new CoreService(new CoreRepository(prisma), 'test-secret');

beforeEach(async () => {
  await prisma.membership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
});

describe('CoreService', () => {
  it('creates a user with a group and returns a valid JWT', async () => {
    const session = await service.createUser({
      username: 'kamasseur',
      displayName: 'Kamasseur',
      email: 'kamasseur@example.test',
      password: 'password-123',
    });

    const payload = service.validateJwt(session.token);

    expect(session.user.email).toBe('kamasseur@example.test');
    expect(session.user.role).toBe('admin');
    expect(payload.userId).toBe(session.user.id);
    expect(payload.groupId).toBe(session.user.groupId);
  });

  it('authenticates an existing user', async () => {
    await service.createUser({
      username: 'craftman',
      displayName: 'Craftman',
      email: 'craftman@example.test',
      password: 'password-123',
    });

    const session = await service.login({
      email: 'craftman@example.test',
      password: 'password-123',
    });

    expect(session.user.username).toBe('craftman');
    expect(service.validateJwt(session.token).role).toBe('admin');
  });

  it('creates and reuses the default user session', async () => {
    const firstSession = await service.ensureDefaultUserAndGroup();
    const secondSession = await service.ensureDefaultUserAndGroup();
    const userCount = await prisma.user.count();
    const groupCount = await prisma.group.count();

    expect(firstSession.user.username).toBe('default');
    expect(secondSession.user.id).toBe(firstSession.user.id);
    expect(userCount).toBe(1);
    expect(groupCount).toBe(1);
  });
});
