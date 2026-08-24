update shipping_rates
   set mode = 'air',
       last_updated = now()
 where lower(coalesce(service_provider, '')) = 'dtdc'
   and lower(coalesce(business_type, '')) = 'b2c'
   and courier_id = 4002;

update shipping_rates
   set mode = 'surface',
       last_updated = now()
 where lower(coalesce(service_provider, '')) = 'dtdc'
   and lower(coalesce(business_type, '')) = 'b2c'
   and courier_id = 4001;
