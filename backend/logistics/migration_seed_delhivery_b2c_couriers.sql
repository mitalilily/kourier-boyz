-- Ensure Delhivery B2C rate-card rows are visible as courier options.
-- Idempotent: safe to run during every service release.

begin;

update shipping_rates
set
  courier_id = case
    when courier_id in (100, 93)
      or lower(coalesce(mode, '')) in ('surface', 's', 'ground')
      or lower(coalesce(courier_name, '')) like '%surface%'
      then 100
    when courier_id in (99, 1, 92)
      or lower(coalesce(mode, '')) in ('air', 'a', 'express', 'e')
      or lower(coalesce(courier_name, '')) like '%air%'
      or lower(coalesce(courier_name, '')) like '%express%'
      then 99
    else courier_id
  end,
  courier_name = case
    when courier_id in (100, 93)
      or lower(coalesce(mode, '')) in ('surface', 's', 'ground')
      or lower(coalesce(courier_name, '')) like '%surface%'
      then 'Delhivery Surface'
    when courier_id in (99, 1, 92)
      or lower(coalesce(mode, '')) in ('air', 'a', 'express', 'e')
      or lower(coalesce(courier_name, '')) like '%air%'
      or lower(coalesce(courier_name, '')) like '%express%'
      then 'Delhivery Air'
    else courier_name
  end,
  service_provider = 'delhivery',
  mode = case
    when courier_id in (99, 1, 92) then 'Air'
    when courier_id in (100, 93) then 'Surface'
    when lower(coalesce(mode, '')) in ('air', 'a', 'express', 'e') then 'Air'
    when lower(coalesce(mode, '')) in ('surface', 's', 'ground') then 'Surface'
    when lower(coalesce(courier_name, '')) like '%surface%' then 'Surface'
    when lower(coalesce(courier_name, '')) like '%air%'
      or lower(coalesce(courier_name, '')) like '%express%' then 'Air'
    else mode
  end,
  last_updated = now()
where lower(business_type) = 'b2c'
  and (
    lower(coalesce(service_provider, '')) = 'delhivery'
    or lower(coalesce(courier_name, '')) like '%delhivery%'
    or courier_id in (99, 100, 1, 92, 93)
  );

with canonical_delhivery_couriers(id, name) as (
  values
    (99, 'Delhivery Air'),
    (100, 'Delhivery Surface')
),
updated_canonical as (
  update couriers c
  set
    name = v.name,
    "isEnabled" = true,
    business_type = case
      when coalesce(c.business_type, '[]'::jsonb) @> '["b2c"]'::jsonb
        then coalesce(c.business_type, '[]'::jsonb)
      else coalesce(c.business_type, '[]'::jsonb) || '["b2c"]'::jsonb
    end,
    updated_at = now()
  from canonical_delhivery_couriers v
  where c.id = v.id
    and lower(c."serviceProvider") = 'delhivery'
  returning c.id
)
insert into couriers (
  id,
  name,
  "serviceProvider",
  "isEnabled",
  business_type,
  created_at,
  updated_at
)
select
  v.id,
  v.name,
  'delhivery',
  true,
  '["b2c"]'::jsonb,
  now(),
  now()
from canonical_delhivery_couriers v
where not exists (
  select 1
  from couriers c
  where c.id = v.id
    and lower(c."serviceProvider") = 'delhivery'
);

with delhivery_rate_couriers as (
  select distinct on (courier_id)
    courier_id::integer as id,
    left(nullif(trim(courier_name), ''), 100) as name
  from shipping_rates
  where lower(business_type) = 'b2c'
    and lower(coalesce(service_provider, '')) = 'delhivery'
    and courier_id is not null
    and courier_id > 0
  order by
    courier_id,
    case
      when lower(coalesce(mode, '')) in ('air', 'a', 'express', 'e') then 0
      when lower(coalesce(courier_name, '')) like '%air%'
        or lower(coalesce(courier_name, '')) like '%express%' then 0
      when lower(coalesce(mode, '')) in ('surface', 's', 'ground') then 1
      when lower(coalesce(courier_name, '')) like '%surface%' then 1
      else 2
    end,
    last_updated desc nulls last,
    created_at desc nulls last
),
valid_delhivery_rate_couriers as (
  select
    id,
    coalesce(name, 'Delhivery') as name
  from delhivery_rate_couriers
),
updated_existing as (
  update couriers c
  set
    name = v.name,
    "isEnabled" = true,
    business_type = case
      when coalesce(c.business_type, '[]'::jsonb) @> '["b2c"]'::jsonb
        then coalesce(c.business_type, '[]'::jsonb)
      else coalesce(c.business_type, '[]'::jsonb) || '["b2c"]'::jsonb
    end,
    updated_at = now()
  from valid_delhivery_rate_couriers v
  where c.id = v.id
    and lower(c."serviceProvider") = 'delhivery'
  returning c.id
)
insert into couriers (
  id,
  name,
  "serviceProvider",
  "isEnabled",
  business_type,
  created_at,
  updated_at
)
select
  v.id,
  v.name,
  'delhivery',
  true,
  '["b2c"]'::jsonb,
  now(),
  now()
from valid_delhivery_rate_couriers v
where not exists (
  select 1
  from couriers c
  where c.id = v.id
    and lower(c."serviceProvider") = 'delhivery'
);

commit;
