import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SelectRoleDto {
  @IsEnum(Role)
  role: Role;
}
