import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async create(data: Prisma.UserCreateInput) {
    // 1. Check if email or username is already taken
    const existingEmail = await this.findByEmail(data.email);
    if (existingEmail) throw new ConflictException('Email already in use');

    const existingUser = await this.findByUsername(data.username);
    if (existingUser) throw new ConflictException('Username already taken');

    // 2. Create the user with default BUYER role if none provided
    return this.prisma.user.create({
      data: {
        ...data,
        roles: data.roles || [Role.BUYER],
      },
    });
  }
}
