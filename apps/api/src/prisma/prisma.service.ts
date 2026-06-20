import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import '../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // 1. Create a native connection pool using the URL from your .env
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 2. Wrap the pool in the Prisma Postgres adapter
    const adapter = new PrismaPg(pool);
    
    // 3. Hand the adapter to the PrismaClient
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
