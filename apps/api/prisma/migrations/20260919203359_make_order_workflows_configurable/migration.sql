-- CreateEnum
CREATE TYPE "OrderStageCategory" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED'
);

-- CreateEnum
CREATE TYPE "OrderStageTransitionType" AS ENUM (
  'CREATED',
  'ADVANCED',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "order_workflows" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "normalized_name" VARCHAR(100) NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "order_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_workflow_stages" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "workflow_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "position" INTEGER NOT NULL,
  "category" "OrderStageCategory" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "order_workflow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_stage_transitions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "type" "OrderStageTransitionType" NOT NULL,
  "previous_stage_id" UUID,
  "next_stage_id" UUID,
  "actor_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_stage_transitions_pkey" PRIMARY KEY ("id")
);

-- Add new references as nullable while existing orders are migrated.
ALTER TABLE "orders"
  ADD COLUMN "workflow_id" UUID,
  ADD COLUMN "current_stage_id" UUID;

-- One generic default workflow for every organization.
INSERT INTO "order_workflows" (
  "id",
  "organization_id",
  "name",
  "normalized_name",
  "is_default",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  md5('order-workflow:default:' || organization."id"::text)::uuid,
  organization."id",
  'Fluxo padrão',
  'fluxo padrao',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations" AS organization;

INSERT INTO "order_workflow_stages" (
  "id",
  "organization_id",
  "workflow_id",
  "name",
  "position",
  "category",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  md5(
    'order-workflow-stage:default:' ||
    stage."key" ||
    ':' ||
    organization."id"::text
  )::uuid,
  organization."id",
  md5('order-workflow:default:' || organization."id"::text)::uuid,
  stage."name",
  stage."position",
  stage."category",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations" AS organization
CROSS JOIN (
  VALUES
    ('pending', 'Pendente', 1, 'PENDING'::"OrderStageCategory"),
    ('in-progress', 'Em andamento', 2, 'IN_PROGRESS'::"OrderStageCategory"),
    ('completed', 'Concluído', 3, 'COMPLETED'::"OrderStageCategory")
) AS stage("key", "name", "position", "category");

-- Existing orders keep their prior flow as configuration, not as a system rule.
INSERT INTO "order_workflows" (
  "id",
  "organization_id",
  "name",
  "normalized_name",
  "is_default",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  md5('order-workflow:migrated:' || organization."organization_id"::text)::uuid,
  organization."organization_id",
  'Fluxo migrado',
  'fluxo migrado',
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "organization_id"
  FROM "orders"
) AS organization;

INSERT INTO "order_workflow_stages" (
  "id",
  "organization_id",
  "workflow_id",
  "name",
  "position",
  "category",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  md5(
    'order-workflow-stage:migrated:' ||
    stage."key" ||
    ':' ||
    organization."organization_id"::text
  )::uuid,
  organization."organization_id",
  md5(
    'order-workflow:migrated:' ||
    organization."organization_id"::text
  )::uuid,
  stage."name",
  stage."position",
  stage."category",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "organization_id"
  FROM "orders"
) AS organization
CROSS JOIN (
  VALUES
    ('awaiting-art-approval', 'Aguardando aprovação de arte', 1, 'PENDING'::"OrderStageCategory"),
    ('awaiting-release', 'Aguardando liberação', 2, 'PENDING'::"OrderStageCategory"),
    ('in-production', 'Em produção', 3, 'IN_PROGRESS'::"OrderStageCategory"),
    ('ready', 'Pronto', 4, 'IN_PROGRESS'::"OrderStageCategory"),
    ('delivered', 'Entregue', 5, 'COMPLETED'::"OrderStageCategory")
) AS stage("key", "name", "position", "category");

-- Associate each existing order with the migrated workflow and its current stage.
UPDATE "orders" AS "order"
SET
  "workflow_id" = md5(
    'order-workflow:migrated:' ||
    "order"."organization_id"::text
  )::uuid,
  "current_stage_id" = CASE
    WHEN "order"."status"::text = 'DELIVERED'
      OR (
        "order"."status"::text = 'CANCELLED'
        AND "order"."delivered_at" IS NOT NULL
      )
      THEN md5(
        'order-workflow-stage:migrated:delivered:' ||
        "order"."organization_id"::text
      )::uuid

    WHEN "order"."status"::text = 'READY'
      OR (
        "order"."status"::text = 'CANCELLED'
        AND "order"."ready_at" IS NOT NULL
      )
      THEN md5(
        'order-workflow-stage:migrated:ready:' ||
        "order"."organization_id"::text
      )::uuid

    WHEN "order"."status"::text = 'IN_PRODUCTION'
      OR (
        "order"."status"::text = 'CANCELLED'
        AND "order"."released_at" IS NOT NULL
      )
      THEN md5(
        'order-workflow-stage:migrated:in-production:' ||
        "order"."organization_id"::text
      )::uuid

    WHEN "order"."status"::text = 'AWAITING_RELEASE'
      OR (
        "order"."status"::text = 'CANCELLED'
        AND "order"."art_approved_at" IS NOT NULL
      )
      THEN md5(
        'order-workflow-stage:migrated:awaiting-release:' ||
        "order"."organization_id"::text
      )::uuid

    ELSE md5(
      'order-workflow-stage:migrated:awaiting-art-approval:' ||
      "order"."organization_id"::text
    )::uuid
  END;

-- Preserve the old specific statuses as generic statuses.
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "OrderStatus_new" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "orders"
ALTER COLUMN "status" TYPE "OrderStatus_new"
USING (
  CASE "status"::text
    WHEN 'AWAITING_ART_APPROVAL' THEN 'PENDING'
    WHEN 'AWAITING_RELEASE' THEN 'PENDING'
    WHEN 'IN_PRODUCTION' THEN 'IN_PROGRESS'
    WHEN 'READY' THEN 'IN_PROGRESS'
    WHEN 'DELIVERED' THEN 'COMPLETED'
    WHEN 'CANCELLED' THEN 'CANCELLED'
  END
)::"OrderStatus_new";

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";

ALTER TABLE "orders"
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ALTER COLUMN "workflow_id" SET NOT NULL,
  ALTER COLUMN "current_stage_id" SET NOT NULL;

-- Rebuild the lifecycle history from existing timestamps.
INSERT INTO "order_stage_transitions" (
  "id",
  "organization_id",
  "order_id",
  "type",
  "previous_stage_id",
  "next_stage_id",
  "actor_user_id",
  "created_at"
)
SELECT
  md5('order-stage-transition:created:' || "order"."id"::text)::uuid,
  "order"."organization_id",
  "order"."id",
  'CREATED',
  NULL,
  md5(
    'order-workflow-stage:migrated:awaiting-art-approval:' ||
    "order"."organization_id"::text
  )::uuid,
  NULL,
  "order"."created_at"
FROM "orders" AS "order";

INSERT INTO "order_stage_transitions" (
  "id",
  "organization_id",
  "order_id",
  "type",
  "previous_stage_id",
  "next_stage_id",
  "actor_user_id",
  "created_at"
)
SELECT
  md5('order-stage-transition:art-approved:' || "order"."id"::text)::uuid,
  "order"."organization_id",
  "order"."id",
  'ADVANCED',
  md5(
    'order-workflow-stage:migrated:awaiting-art-approval:' ||
    "order"."organization_id"::text
  )::uuid,
  md5(
    'order-workflow-stage:migrated:awaiting-release:' ||
    "order"."organization_id"::text
  )::uuid,
  NULL,
  "order"."art_approved_at"
FROM "orders" AS "order"
WHERE "order"."art_approved_at" IS NOT NULL;

INSERT INTO "order_stage_transitions" (
  "id",
  "organization_id",
  "order_id",
  "type",
  "previous_stage_id",
  "next_stage_id",
  "actor_user_id",
  "created_at"
)
SELECT
  md5('order-stage-transition:released:' || "order"."id"::text)::uuid,
  "order"."organization_id",
  "order"."id",
  'ADVANCED',
  md5(
    'order-workflow-stage:migrated:awaiting-release:' ||
    "order"."organization_id"::text
  )::uuid,
  md5(
    'order-workflow-stage:migrated:in-production:' ||
    "order"."organization_id"::text
  )::uuid,
  NULL,
  "order"."released_at"
FROM "orders" AS "order"
WHERE "order"."released_at" IS NOT NULL;

INSERT INTO "order_stage_transitions" (
  "id",
  "organization_id",
  "order_id",
  "type",
  "previous_stage_id",
  "next_stage_id",
  "actor_user_id",
  "created_at"
)
SELECT
  md5('order-stage-transition:ready:' || "order"."id"::text)::uuid,
  "order"."organization_id",
  "order"."id",
  'ADVANCED',
  md5(
    'order-workflow-stage:migrated:in-production:' ||
    "order"."organization_id"::text
  )::uuid,
  md5(
    'order-workflow-stage:migrated:ready:' ||
    "order"."organization_id"::text
  )::uuid,
  NULL,
  "order"."ready_at"
FROM "orders" AS "order"
WHERE "order"."ready_at" IS NOT NULL;

INSERT INTO "order_stage_transitions" (
  "id",
  "organization_id",
  "order_id",
  "type",
  "previous_stage_id",
  "next_stage_id",
  "actor_user_id",
  "created_at"
)
SELECT
  md5('order-stage-transition:delivered:' || "order"."id"::text)::uuid,
  "order"."organization_id",
  "order"."id",
  'ADVANCED',
  md5(
    'order-workflow-stage:migrated:ready:' ||
    "order"."organization_id"::text
  )::uuid,
  md5(
    'order-workflow-stage:migrated:delivered:' ||
    "order"."organization_id"::text
  )::uuid,
  NULL,
  "order"."delivered_at"
FROM "orders" AS "order"
WHERE "order"."delivered_at" IS NOT NULL;

INSERT INTO "order_stage_transitions" (
  "id",
  "organization_id",
  "order_id",
  "type",
  "previous_stage_id",
  "next_stage_id",
  "actor_user_id",
  "created_at"
)
SELECT
  md5('order-stage-transition:cancelled:' || "order"."id"::text)::uuid,
  "order"."organization_id",
  "order"."id",
  'CANCELLED',
  "order"."current_stage_id",
  NULL,
  NULL,
  COALESCE("order"."cancelled_at", "order"."updated_at")
FROM "orders" AS "order"
WHERE "order"."status" = 'CANCELLED';

-- Legacy timestamps are now represented by stage transition history.
ALTER TABLE "orders"
  DROP COLUMN "art_approved_at",
  DROP COLUMN "delivered_at",
  DROP COLUMN "ready_at",
  DROP COLUMN "released_at";

-- CreateIndex
CREATE INDEX "order_workflows_organization_id_is_default_is_active_idx"
  ON "order_workflows"("organization_id", "is_default", "is_active");

CREATE UNIQUE INDEX "order_workflows_organization_id_id_key"
  ON "order_workflows"("organization_id", "id");

CREATE UNIQUE INDEX "order_workflows_organization_id_normalized_name_key"
  ON "order_workflows"("organization_id", "normalized_name");

CREATE UNIQUE INDEX "order_workflows_one_default_per_organization"
  ON "order_workflows"("organization_id")
  WHERE "is_default";

CREATE INDEX "order_workflow_stages_organization_id_workflow_id_is_active_idx"
  ON "order_workflow_stages"("organization_id", "workflow_id", "is_active");

CREATE UNIQUE INDEX "order_workflow_stages_organization_id_id_key"
  ON "order_workflow_stages"("organization_id", "id");

CREATE UNIQUE INDEX "order_workflow_stages_workflow_id_position_key"
  ON "order_workflow_stages"("workflow_id", "position");

CREATE INDEX "order_stage_transitions_organization_id_order_id_created_at_idx"
  ON "order_stage_transitions"("organization_id", "order_id", "created_at");

CREATE INDEX "orders_organization_id_current_stage_id_idx"
  ON "orders"("organization_id", "current_stage_id");

-- AddForeignKey
ALTER TABLE "order_workflows"
  ADD CONSTRAINT "order_workflows_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "order_workflow_stages"
  ADD CONSTRAINT "order_workflow_stages_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "order_workflow_stages"
  ADD CONSTRAINT "order_workflow_stages_organization_id_workflow_id_fkey"
  FOREIGN KEY ("organization_id", "workflow_id")
  REFERENCES "order_workflows"("organization_id", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_organization_id_workflow_id_fkey"
  FOREIGN KEY ("organization_id", "workflow_id")
  REFERENCES "order_workflows"("organization_id", "id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_organization_id_current_stage_id_fkey"
  FOREIGN KEY ("organization_id", "current_stage_id")
  REFERENCES "order_workflow_stages"("organization_id", "id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "order_stage_transitions"
  ADD CONSTRAINT "order_stage_transitions_organization_id_fkey"
  FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "order_stage_transitions"
  ADD CONSTRAINT "order_stage_transitions_organization_id_order_id_fkey"
  FOREIGN KEY ("organization_id", "order_id")
  REFERENCES "orders"("organization_id", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "order_stage_transitions"
  ADD CONSTRAINT "order_stage_transitions_organization_id_previous_stage_id_fkey"
  FOREIGN KEY ("organization_id", "previous_stage_id")
  REFERENCES "order_workflow_stages"("organization_id", "id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "order_stage_transitions"
  ADD CONSTRAINT "order_stage_transitions_organization_id_next_stage_id_fkey"
  FOREIGN KEY ("organization_id", "next_stage_id")
  REFERENCES "order_workflow_stages"("organization_id", "id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "order_stage_transitions"
  ADD CONSTRAINT "order_stage_transitions_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;