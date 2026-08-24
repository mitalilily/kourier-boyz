-- Migration: move all imported platform-prefixed objects into the Kourier Boyz namespace.
-- Safe to rerun: objects already using kourier_boyz_* are left untouched.

BEGIN;

DO $$
DECLARE
  rec RECORD;
  new_name TEXT;
  source_prefix TEXT;
  source_prefixes TEXT[] := ARRAY[
    'route' || 'ship_',
    'ship' || 'lifi_',
    'mera' || 'courierwala_'
  ];
BEGIN
  FOREACH source_prefix IN ARRAY source_prefixes LOOP
    FOR rec IN
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename LIKE source_prefix || '%'
    LOOP
      new_name := regexp_replace(rec.tablename, '^' || source_prefix, 'kourier_boyz_');
      IF to_regclass(format('%I.%I', rec.schemaname, new_name)) IS NULL THEN
        EXECUTE format('ALTER TABLE %I.%I RENAME TO %I', rec.schemaname, rec.tablename, new_name);
      END IF;
    END LOOP;

    FOR rec IN
      SELECT schemaname, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE source_prefix || '%'
    LOOP
      new_name := regexp_replace(rec.indexname, '^' || source_prefix, 'kourier_boyz_');
      IF to_regclass(format('%I.%I', rec.schemaname, new_name)) IS NULL THEN
        EXECUTE format('ALTER INDEX %I.%I RENAME TO %I', rec.schemaname, rec.indexname, new_name);
      END IF;
    END LOOP;

    FOR rec IN
      SELECT sequence_schema, sequence_name
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
        AND sequence_name LIKE source_prefix || '%'
    LOOP
      new_name := regexp_replace(rec.sequence_name, '^' || source_prefix, 'kourier_boyz_');
      IF to_regclass(format('%I.%I', rec.sequence_schema, new_name)) IS NULL THEN
        EXECUTE format(
          'ALTER SEQUENCE %I.%I RENAME TO %I',
          rec.sequence_schema,
          rec.sequence_name,
          new_name
        );
      END IF;
    END LOOP;

    FOR rec IN
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        con.conname AS constraint_name
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND con.conname LIKE source_prefix || '%'
    LOOP
      new_name := regexp_replace(rec.constraint_name, '^' || source_prefix, 'kourier_boyz_');
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint existing
        WHERE existing.conrelid = format('%I.%I', rec.schema_name, rec.table_name)::regclass
          AND existing.conname = new_name
      ) THEN
        EXECUTE format(
          'ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I',
          rec.schema_name,
          rec.table_name,
          rec.constraint_name,
          new_name
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
