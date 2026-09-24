CREATE UNIQUE INDEX "order_workflows_one_default_per_organization"
ON "order_workflows" ("organization_id")
WHERE "is_default" = true;