import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  mixin,
  Type,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth.types';

export function ActiveRoleGuard(...allowedRoles: Role[]): Type<CanActivate> {
  @Injectable()
  class RoleGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const activeRole = request.user.activeRole;

      if (!activeRole || !allowedRoles.includes(activeRole)) {
        throw new ForbiddenException(
          `${allowedRoles.join(' or ')} active role required`,
        );
      }

      return true;
    }
  }

  return mixin(RoleGuard);
}
