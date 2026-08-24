CREATE TABLE IF NOT EXISTS invoice_sequences (
  user_id uuid NOT NULL,
  last_sequence bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_sequences_pkey'
  ) THEN
    ALTER TABLE invoice_sequences
    ADD CONSTRAINT invoice_sequences_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoice_sequences_user_id_users_id_fk'
  ) THEN
    ALTER TABLE invoice_sequences
    ADD CONSTRAINT invoice_sequences_user_id_users_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE;
  END IF;
END $$;
