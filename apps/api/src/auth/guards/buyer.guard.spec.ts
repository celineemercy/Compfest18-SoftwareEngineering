import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BuyerGuard } from './buyer.guard';

describe('BuyerGuard', () => {
  const guard = new BuyerGuard();

  function contextWithRoles(roles: Role[]) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles },
        }),
      }),
    } as ExecutionContext;
  }

  it('allows buyers', () => {
    expect(guard.canActivate(contextWithRoles([Role.BUYER]))).toBe(true);
  });

  it('rejects non-buyers', () => {
    expect(() => guard.canActivate(contextWithRoles([Role.SELLER]))).toThrow(
      ForbiddenException,
    );
  });
});
