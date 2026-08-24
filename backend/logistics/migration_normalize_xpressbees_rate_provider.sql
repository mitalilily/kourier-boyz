UPDATE shipping_rates
SET service_provider = 'xpressbees'
WHERE lower(trim(coalesce(service_provider, ''))) IN ('xpressbess', 'xpressbee', 'xpress bees');
