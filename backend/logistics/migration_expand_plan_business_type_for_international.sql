ALTER TABLE plans
  ALTER COLUMN business_type TYPE varchar(20);

ALTER TABLE user_plans
  ALTER COLUMN business_type TYPE varchar(20);
