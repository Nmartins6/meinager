-- Normalize id's generated during migration flow.
-- FKs use ON UPDATE CASCADE, preserving orders, history and flow.

UPDATE "order_workflows"
SET "id" = gen_random_uuid()
WHERE "id"::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

UPDATE "order_workflow_stages"
SET "id" = gen_random_uuid()
WHERE "id"::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

UPDATE "order_stage_transitions"
SET "id" = gen_random_uuid()
WHERE "id"::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';