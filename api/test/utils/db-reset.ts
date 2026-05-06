import { PrismaClient } from '@prisma/client';

/**
 * Reset toutes les tables (Postgres) entre tests.
 * Fonctionne bien en DB de test dédiée.
 */
export async function resetDb(prisma: PrismaClient) {
  // Désactive FK le temps du TRUNCATE
  await prisma.$executeRawUnsafe(`DO $$ DECLARE
    r RECORD;
  BEGIN
    -- TRUNCATE toutes les tables du schema public
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
      EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE;';
    END LOOP;
  END $$;`);
}
