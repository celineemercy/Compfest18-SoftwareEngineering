import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SellerGuard } from './seller.guard';

describe('SellerGuard', () => {
  const guard = new SellerGuard();

  function contextWithRoles(roles: Role[]) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles },
        }),
      }),
    } as ExecutionContext;
  }

  it('allows sellers', () => {
    expect(guard.canActivate(contextWithRoles([Role.BUYER, Role.SELLER]))).toBe(
      true,
    );
  });

  it('rejects non-sellers', () => {
    expect(() => guard.canActivate(contextWithRoles([Role.BUYER]))).toThrow(
      ForbiddenException,
    );
  });
});
