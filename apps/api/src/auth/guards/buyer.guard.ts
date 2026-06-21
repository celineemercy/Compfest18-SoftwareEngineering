import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth.types';

@Injectable()
export class BuyerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user.roles.includes(Role.BUYER)) {
      throw new ForbiddenException('Buyer role required');
    }

    return true;
  }
}
