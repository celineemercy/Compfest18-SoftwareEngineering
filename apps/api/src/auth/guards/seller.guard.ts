import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth.types';

@Injectable()
export class SellerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user.roles.includes(Role.SELLER)) {
      throw new ForbiddenException('Seller role required');
    }

    return true;
  }
}
