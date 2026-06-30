import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SellerGuard } from './seller.guard';

describe('SellerGuard', () => {
  const guard = new SellerGuard();

  function contextWithActiveRole(activeRole?: Role) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { activeRole },
        }),
      }),
    } as ExecutionContext;
  }

  it('allows active sellers', () => {
    expect(guard.canActivate(contextWithActiveRole(Role.SELLER))).toBe(
      true,
    );
  });

  it('rejects inactive sellers', () => {
    expect(() => guard.canActivate(contextWithActiveRole(Role.BUYER))).toThrow(
      ForbiddenException,
    );
  });
});
