import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ActiveRoleGuard } from './active-role.guard';

describe('ActiveRoleGuard', () => {
  function guardFor(...roles: Role[]) {
    const GuardClass = ActiveRoleGuard(...roles);
    return new GuardClass();
  }

  function contextWithUser(activeRole: Role | undefined, roles: Role[] = []) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            activeRole,
            roles,
          },
        }),
      }),
    } as ExecutionContext;
  }

  it('allows access when the active role is permitted and owned', () => {
    const guard = guardFor(Role.BUYER);

    expect(guard.canActivate(contextWithUser(Role.BUYER, [Role.BUYER]))).toBe(
      true,
    );
  });

  it('allows a selected active role that is owned by a multi-role user', () => {
    const guard = guardFor(Role.SELLER);

    expect(
      guard.canActivate(contextWithUser(Role.SELLER, [Role.BUYER, Role.SELLER])),
    ).toBe(true);
  });

  it('rejects buyer-only routes for a non-buyer active role', () => {
    const guard = guardFor(Role.BUYER);

    expect(() =>
      guard.canActivate(contextWithUser(Role.SELLER, [Role.SELLER])),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests with no active role selected', () => {
    const guard = guardFor(Role.BUYER);

    expect(() => guard.canActivate(contextWithUser(undefined, [Role.BUYER]))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects an owned role when it is not the selected active role', () => {
    const guard = guardFor(Role.SELLER);

    expect(() =>
      guard.canActivate(contextWithUser(Role.BUYER, [Role.BUYER, Role.SELLER])),
    ).toThrow(ForbiddenException);
  });

  it('rejects an active role that is not owned by the user', () => {
    const guard = guardFor(Role.ADMIN);

    expect(() =>
      guard.canActivate(contextWithUser(Role.ADMIN, [Role.BUYER])),
    ).toThrow(ForbiddenException);
  });
});
