-- Rename legacy initial workflows when "Fluxo geral" is available.
UPDATE "order_workflows" AS workflow
SET
  "name" = 'Fluxo geral',
  "normalized_name" = 'fluxo geral',
  "updated_at" = CURRENT_TIMESTAMP
WHERE workflow."normalized_name" = 'fluxo padrao'
  AND NOT EXISTS (
    SELECT 1
    FROM "order_workflows" AS existing
    WHERE existing."organization_id" = workflow."organization_id"
      AND existing."id" <> workflow."id"
      AND existing."normalized_name" = 'fluxo geral'
  );

-- Preserve uniqueness if an organization already has a "Fluxo geral".
UPDATE "order_workflows" AS workflow
SET
  "name" = 'Fluxo inicial ' || workflow."id"::text,
  "normalized_name" = 'fluxo inicial ' || workflow."id"::text,
  "updated_at" = CURRENT_TIMESTAMP
WHERE workflow."normalized_name" = 'fluxo padrao';