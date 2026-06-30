import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ActiveRoleGuard } from './active-role.guard';

describe('ActiveRoleGuard', () => {
  function contextWithActiveRole(activeRole?: Role) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { activeRole },
        }),
      }),
    } as ExecutionContext;
  }

  it('allows access when the active role is permitted', () => {
    const guard = new (ActiveRoleGuard(Role.BUYER))();

    expect(guard.canActivate(contextWithActiveRole(Role.BUYER))).toBe(true);
  });

  it('rejects buyer-only routes for a non-buyer active role', () => {
    const guard = new (ActiveRoleGuard(Role.BUYER))();

    expect(() => guard.canActivate(contextWithActiveRole(Role.SELLER))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects requests with no active role selected', () => {
    const guard = new (ActiveRoleGuard(Role.BUYER))();

    expect(() => guard.canActivate(contextWithActiveRole(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
