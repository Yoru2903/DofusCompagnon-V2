import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError } from '../../shared/errors/api-error.js';
import type { AuthenticatedUser, AuthTokenPayload, MembershipRole } from './core.types.js';
import type { CreateUserInput, LoginInput } from './core.validator.js';
import { createUserSchema, loginSchema, roleSchema } from './core.validator.js';
import type { CoreRepository } from './core.repository.js';

const tokenTtl = '7d';

export class CoreService {
  constructor(
    private readonly repository: CoreRepository,
    private readonly jwtSecret: string,
  ) {}

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, passwordHash: string) {
    return bcrypt.compare(password, passwordHash);
  }

  generateJwt(payload: AuthTokenPayload) {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: tokenTtl });
  }

  validateJwt(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret);

      if (
        typeof payload !== 'object' ||
        typeof payload.userId !== 'string' ||
        typeof payload.groupId !== 'string'
      ) {
        throw new Error('Invalid payload');
      }

      return {
        userId: payload.userId,
        groupId: payload.groupId,
        role: roleSchema.parse(payload.role),
      };
    } catch {
      throw new ApiError(401, 'AUTH_INVALID_TOKEN', 'Authentification invalide.');
    }
  }

  async createUser(rawInput: CreateUserInput) {
    const input = createUserSchema.parse(rawInput);
    const existingEmail = await this.repository.findUserByEmail(input.email);

    if (existingEmail) {
      throw new ApiError(409, 'USER_EMAIL_ALREADY_EXISTS', 'Cet email est deja utilise.');
    }

    const existingUsername = await this.repository.findUserByUsername(input.username);

    if (existingUsername) {
      throw new ApiError(409, 'USER_USERNAME_ALREADY_EXISTS', 'Ce nom utilisateur est deja utilise.');
    }

    const passwordHash = await this.hashPassword(input.password);
    const user = await this.repository.createUser({
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      passwordHash,
    });
    const group = await this.repository.createGroup({
      name: `${input.displayName}`,
      description: 'Groupe personnel cree a l inscription.',
      createdBy: user.id,
    });
    const membership = await this.repository.createMembership({
      userId: user.id,
      groupId: group.id,
      role: 'admin',
    });

    return this.authResponse({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      groupId: group.id,
      role: membership.role as MembershipRole,
    });
  }

  async login(rawInput: LoginInput) {
    const input = loginSchema.parse(rawInput);
    const user = await this.repository.findUserByEmail(input.email);

    if (!user || !user.isActive) {
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Identifiants invalides.');
    }

    const isPasswordValid = await this.verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Identifiants invalides.');
    }

    return this.createSessionForUser(user.id);
  }

  async getAuthenticatedUser(payload: AuthTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.repository.findUserWithMembership(payload.userId);
    const membership = user?.memberships.find((entry) => entry.groupId === payload.groupId);

    if (!user || !user.isActive || !membership) {
      throw new ApiError(401, 'AUTH_INVALID_TOKEN', 'Authentification invalide.');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      groupId: membership.groupId,
      role: membership.role as MembershipRole,
    };
  }

  async ensureDefaultUserAndGroup() {
    const existing = await this.repository.findDefaultUser();

    if (existing) {
      return this.createSessionForUser(existing.id);
    }

    const passwordHash = await this.hashPassword('default-password');
    const user = await this.repository.createUser({
      username: 'default',
      displayName: 'Utilisateur par defaut',
      email: 'default@dofuscompagnon.local',
      passwordHash,
    });
    await this.repository.createDefaultGroupMembership(user);

    return this.createSessionForUser(user.id);
  }

  private async createSessionForUser(userId: string) {
    const user = await this.repository.findUserWithMembership(userId);
    const membership = user?.memberships[0];

    if (!user || !membership) {
      throw new ApiError(401, 'AUTH_NO_MEMBERSHIP', 'Aucun groupe associe a cet utilisateur.');
    }

    return this.authResponse({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      groupId: membership.groupId,
      role: membership.role as MembershipRole,
    });
  }

  private authResponse(user: AuthenticatedUser) {
    return {
      user,
      token: this.generateJwt({
        userId: user.id,
        groupId: user.groupId,
        role: user.role,
      }),
    };
  }
}
