import { Role } from '@prisma/client';
import { Request } from 'express';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  roles: Role[];
  createdAt: Date;
  updatedAt: Date;
};

export type JwtPayload = {
  sub: string;
  email: string;
  roles: Role[];
};

export type AuthenticatedRequest = Request & {
  user: AuthUser;
};
