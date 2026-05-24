import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default prisma;
