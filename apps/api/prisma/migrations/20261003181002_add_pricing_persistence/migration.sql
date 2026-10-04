-- CreateEnum
CREATE TYPE "PricingFixedCostMode" AS ENUM ('RATE', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PricingParameterOrigin" AS ENUM ('MANUAL', 'FINANCIAL_AGGREGATE', 'COPIED');

-- CreateEnum
CREATE TYPE "PricingComponentCostSource" AS ENUM ('MANUAL', 'COPIED', 'CATALOG');

-- CreateEnum
CREATE TYPE "PricingFreightMode" AS ENUM ('MANUAL', 'ALLOCATED');

-- CreateEnum
CREATE TYPE "PricingVersionState" AS ENUM ('BUILDING', 'FINALIZED');

-- CreateEnum
CREATE TYPE "PricingComponentCategory" AS ENUM ('DIRECT_COST', 'MATERIAL', 'PACKAGING', 'LABOR', 'FREIGHT', 'OUTSOURCING', 'LOSS', 'OTHER');

-- CreateEnum
CREATE TYPE "PricingClassification" AS ENUM ('BELOW_MINIMUM', 'COST_COVERAGE', 'BELOW_DESIRED_MARGIN', 'DESIRED_MARGIN_MET', 'ABOVE_DESIRED_MARGIN');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "adopted_pricing_version_id" UUID;

-- CreateTable
CREATE TABLE "organization_pricing_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "current_revision_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_pricing_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_pricing_configuration_revisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "configuration_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "fixed_cost_mode" "PricingFixedCostMode",
    "fixed_cost_rate" DECIMAL(12,8),
    "monthly_fixed_cost" DECIMAL(19,6),
    "average_monthly_revenue" DECIMAL(19,6),
    "monthly_labor_cost" DECIMAL(19,6),
    "productive_hours" DECIMAL(19,6),
    "default_desired_margin" DECIMAL(12,8),
    "parameter_origins" JSONB NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pricing_configuration_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_sales_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "current_revision_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pricing_sales_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_sales_profile_revisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_sales_profile_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_deductions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "profile_revision_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" TEXT NOT NULL,
    "rate" DECIMAL(12,8) NOT NULL,
    "origin" "PricingParameterOrigin" NOT NULL,
    "origin_details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_pricing_compositions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "profile_id" UUID,
    "desired_margin" DECIMAL(12,8),
    "labor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "time_minutes" DECIMAL(19,6),
    "freight_mode" "PricingFreightMode",
    "freight_unit_cost" DECIMAL(19,6),
    "freight_total_cost" DECIMAL(19,6),
    "freight_quantity" DECIMAL(19,6),
    "freight_consumed_quantity" DECIMAL(19,6),
    "parameter_origins" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_pricing_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_components" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "composition_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "category" "PricingComponentCategory" NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "cost_source" "PricingComponentCostSource" NOT NULL,
    "stored_unit_cost" DECIMAL(19,6),
    "source_product_id" UUID,
    "origin_details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pricing_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_calculation_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "composition_id" UUID,
    "composition_revision" INTEGER,
    "configuration_revision_id" UUID,
    "profile_revision_id" UUID,
    "state" "PricingVersionState" NOT NULL DEFAULT 'BUILDING',
    "snapshot" JSONB NOT NULL,
    "minimum_price_commercial" TEXT NOT NULL,
    "suggested_price_commercial" TEXT NOT NULL,
    "analyzed_price" TEXT NOT NULL,
    "classification" "PricingClassification" NOT NULL,
    "component_count" INTEGER NOT NULL,
    "deduction_count" INTEGER NOT NULL,
    "formula_version" VARCHAR(60) NOT NULL,
    "snapshot_schema_version" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "finalized_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_calculation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_version_components" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "category" "PricingComponentCategory" NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "effective_unit_cost" DECIMAL(19,6) NOT NULL,
    "total_exact" TEXT NOT NULL,
    "total_display" TEXT NOT NULL,
    "source_product_id" UUID,
    "cost_source" "PricingComponentCostSource" NOT NULL,
    "origin_details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_version_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_version_deductions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" TEXT NOT NULL,
    "rate" DECIMAL(12,8) NOT NULL,
    "amount_exact" TEXT NOT NULL,
    "amount_display" TEXT NOT NULL,
    "origin" "PricingParameterOrigin" NOT NULL,
    "origin_details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_version_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_price_adoptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "previous_version_id" UUID,
    "previous_price" DECIMAL(14,2),
    "new_price" DECIMAL(14,2) NOT NULL,
    "classification" "PricingClassification" NOT NULL,
    "below_minimum_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "justification" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_price_adoptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_configurations_org_active_idx" ON "organization_pricing_configurations"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_configurations_org_id_key" ON "organization_pricing_configurations"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_configurations_org_key" ON "organization_pricing_configurations"("organization_id");

-- CreateIndex
CREATE INDEX "pricing_configuration_revisions_org_effectiveFrom_idx" ON "organization_pricing_configuration_revisions"("organization_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_configuration_revisions_org_id_key" ON "organization_pricing_configuration_revisions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_configuration_revisions_org_config_revision_key" ON "organization_pricing_configuration_revisions"("organization_id", "configuration_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_configuration_revisions_org_config_id_key" ON "organization_pricing_configuration_revisions"("organization_id", "configuration_id", "id");

-- CreateIndex
CREATE INDEX "pricing_sales_profiles_org_active_idx" ON "pricing_sales_profiles"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_sales_profiles_org_id_key" ON "pricing_sales_profiles"("organization_id", "id");

-- CreateIndex
CREATE INDEX "pricing_sales_profile_revisions_org_effectiveFrom_idx" ON "pricing_sales_profile_revisions"("organization_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_sales_profile_revisions_org_id_key" ON "pricing_sales_profile_revisions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_sales_profile_revisions_org_profile_revision_key" ON "pricing_sales_profile_revisions"("organization_id", "profile_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_sales_profile_revisions_org_profile_id_key" ON "pricing_sales_profile_revisions"("organization_id", "profile_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_deductions_org_id_key" ON "pricing_deductions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_deductions_org_profile_revision_position_key" ON "pricing_deductions"("organization_id", "profile_revision_id", "position");

-- CreateIndex
CREATE INDEX "product_pricing_compositions_org_profile_idx" ON "product_pricing_compositions"("organization_id", "profile_id");

-- CreateIndex
CREATE INDEX "product_pricing_compositions_org_active_idx" ON "product_pricing_compositions"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_pricing_compositions_org_id_key" ON "product_pricing_compositions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "product_pricing_compositions_org_product_key" ON "product_pricing_compositions"("organization_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_pricing_compositions_org_product_id_key" ON "product_pricing_compositions"("organization_id", "product_id", "id");

-- CreateIndex
CREATE INDEX "pricing_components_org_source_product_idx" ON "pricing_components"("organization_id", "source_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_components_org_id_key" ON "pricing_components"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_components_org_composition_position_key" ON "pricing_components"("organization_id", "composition_id", "position");

-- CreateIndex
CREATE INDEX "pricing_calculation_versions_org_product_created_at_idx" ON "pricing_calculation_versions"("organization_id", "product_id", "created_at");

-- CreateIndex
CREATE INDEX "pricing_calculation_versions_org_product_composition_idx" ON "pricing_calculation_versions"("organization_id", "product_id", "composition_id");

-- CreateIndex
CREATE INDEX "pricing_calculation_versions_org_config_revision_idx" ON "pricing_calculation_versions"("organization_id", "configuration_revision_id");

-- CreateIndex
CREATE INDEX "pricing_calculation_versions_org_profile_revision_idx" ON "pricing_calculation_versions"("organization_id", "profile_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_calculation_versions_org_id_key" ON "pricing_calculation_versions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_calculation_versions_org_product_number_key" ON "pricing_calculation_versions"("organization_id", "product_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_calculation_versions_org_product_id_key" ON "pricing_calculation_versions"("organization_id", "product_id", "id");

-- CreateIndex
CREATE INDEX "pricing_version_components_org_source_product_idx" ON "pricing_version_components"("organization_id", "source_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_version_components_org_id_key" ON "pricing_version_components"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_version_components_org_version_position_key" ON "pricing_version_components"("organization_id", "version_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_version_deductions_org_id_key" ON "pricing_version_deductions"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_version_deductions_org_version_position_key" ON "pricing_version_deductions"("organization_id", "version_id", "position");

-- CreateIndex
CREATE INDEX "pricing_price_adoptions_org_product_created_at_idx" ON "pricing_price_adoptions"("organization_id", "product_id", "created_at");

-- CreateIndex
CREATE INDEX "pricing_price_adoptions_org_product_version_idx" ON "pricing_price_adoptions"("organization_id", "product_id", "version_id");

-- CreateIndex
CREATE INDEX "pricing_price_adoptions_org_product_previous_version_idx" ON "pricing_price_adoptions"("organization_id", "product_id", "previous_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_price_adoptions_org_id_key" ON "pricing_price_adoptions"("organization_id", "id");

-- CreateIndex
CREATE INDEX "products_organization_id_id_adopted_pricing_version_id_idx" ON "products"("organization_id", "id", "adopted_pricing_version_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_id_adopted_pricing_version_id_fkey" FOREIGN KEY ("organization_id", "id", "adopted_pricing_version_id") REFERENCES "pricing_calculation_versions"("organization_id", "product_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organization_pricing_configurations" ADD CONSTRAINT "pricing_configurations_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organization_pricing_configurations" ADD CONSTRAINT "pricing_configurations_current_revision_fkey" FOREIGN KEY ("organization_id", "id", "current_revision_id") REFERENCES "organization_pricing_configuration_revisions"("organization_id", "configuration_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organization_pricing_configurations" ADD CONSTRAINT "pricing_configurations_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organization_pricing_configurations" ADD CONSTRAINT "pricing_configurations_updated_by_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organization_pricing_configuration_revisions" ADD CONSTRAINT "pricing_configuration_revisions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organization_pricing_configuration_revisions" ADD CONSTRAINT "pricing_configuration_revisions_configuration_fkey" FOREIGN KEY ("organization_id", "configuration_id") REFERENCES "organization_pricing_configurations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "organization_pricing_configuration_revisions" ADD CONSTRAINT "pricing_configuration_revisions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_sales_profiles" ADD CONSTRAINT "pricing_sales_profiles_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_sales_profiles" ADD CONSTRAINT "pricing_sales_profiles_current_revision_fkey" FOREIGN KEY ("organization_id", "id", "current_revision_id") REFERENCES "pricing_sales_profile_revisions"("organization_id", "profile_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_sales_profiles" ADD CONSTRAINT "pricing_sales_profiles_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_sales_profiles" ADD CONSTRAINT "pricing_sales_profiles_updated_by_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_sales_profile_revisions" ADD CONSTRAINT "pricing_sales_profile_revisions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_sales_profile_revisions" ADD CONSTRAINT "pricing_sales_profile_revisions_profile_fkey" FOREIGN KEY ("organization_id", "profile_id") REFERENCES "pricing_sales_profiles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_sales_profile_revisions" ADD CONSTRAINT "pricing_sales_profile_revisions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_deductions" ADD CONSTRAINT "pricing_deductions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_deductions" ADD CONSTRAINT "pricing_deductions_profile_revision_fkey" FOREIGN KEY ("organization_id", "profile_revision_id") REFERENCES "pricing_sales_profile_revisions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "product_pricing_compositions" ADD CONSTRAINT "product_pricing_compositions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "product_pricing_compositions" ADD CONSTRAINT "product_pricing_compositions_product_fkey" FOREIGN KEY ("organization_id", "product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "product_pricing_compositions" ADD CONSTRAINT "product_pricing_compositions_profile_fkey" FOREIGN KEY ("organization_id", "profile_id") REFERENCES "pricing_sales_profiles"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "product_pricing_compositions" ADD CONSTRAINT "product_pricing_compositions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "product_pricing_compositions" ADD CONSTRAINT "product_pricing_compositions_updated_by_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_components" ADD CONSTRAINT "pricing_components_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_components" ADD CONSTRAINT "pricing_components_composition_fkey" FOREIGN KEY ("organization_id", "composition_id") REFERENCES "product_pricing_compositions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_components" ADD CONSTRAINT "pricing_components_source_product_fkey" FOREIGN KEY ("organization_id", "source_product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_calculation_versions" ADD CONSTRAINT "pricing_calculation_versions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_calculation_versions" ADD CONSTRAINT "pricing_calculation_versions_product_fkey" FOREIGN KEY ("organization_id", "product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_calculation_versions" ADD CONSTRAINT "pricing_calculation_versions_composition_fkey" FOREIGN KEY ("organization_id", "product_id", "composition_id") REFERENCES "product_pricing_compositions"("organization_id", "product_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_calculation_versions" ADD CONSTRAINT "pricing_calculation_versions_configuration_revision_fkey" FOREIGN KEY ("organization_id", "configuration_revision_id") REFERENCES "organization_pricing_configuration_revisions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_calculation_versions" ADD CONSTRAINT "pricing_calculation_versions_profile_revision_fkey" FOREIGN KEY ("organization_id", "profile_revision_id") REFERENCES "pricing_sales_profile_revisions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_calculation_versions" ADD CONSTRAINT "pricing_calculation_versions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_version_components" ADD CONSTRAINT "pricing_version_components_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_version_components" ADD CONSTRAINT "pricing_version_components_version_fkey" FOREIGN KEY ("organization_id", "version_id") REFERENCES "pricing_calculation_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_version_components" ADD CONSTRAINT "pricing_version_components_source_product_fkey" FOREIGN KEY ("organization_id", "source_product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_version_deductions" ADD CONSTRAINT "pricing_version_deductions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_version_deductions" ADD CONSTRAINT "pricing_version_deductions_version_fkey" FOREIGN KEY ("organization_id", "version_id") REFERENCES "pricing_calculation_versions"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_price_adoptions" ADD CONSTRAINT "pricing_price_adoptions_organization_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_price_adoptions" ADD CONSTRAINT "pricing_price_adoptions_product_fkey" FOREIGN KEY ("organization_id", "product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_price_adoptions" ADD CONSTRAINT "pricing_price_adoptions_version_fkey" FOREIGN KEY ("organization_id", "product_id", "version_id") REFERENCES "pricing_calculation_versions"("organization_id", "product_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_price_adoptions" ADD CONSTRAINT "pricing_price_adoptions_previous_version_fkey" FOREIGN KEY ("organization_id", "product_id", "previous_version_id") REFERENCES "pricing_calculation_versions"("organization_id", "product_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "pricing_price_adoptions" ADD CONSTRAINT "pricing_price_adoptions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ADR-006: constraints and guards not representable in the Prisma schema.
-- Numeric typmods enforce magnitude/scale, but PostgreSQL coerces excess scale
-- BEFORE CHECK/trigger evaluation. The application must validate original decimal
-- strings before binding values; these guards cannot detect a prior coercion.
-- Rates remain editable even when a calculation would be infeasible. Their
-- supported magnitude/scale is numeric(12,8); the motor alone validates the divisor.
ALTER TABLE "organization_pricing_configuration_revisions"
  ADD CONSTRAINT "pricing_configuration_revisions_revision_check" CHECK (revision > 0),
  ADD CONSTRAINT "pricing_configuration_revisions_currency_check" CHECK (currency = 'BRL'),
  ADD CONSTRAINT "pricing_configuration_revisions_values_check" CHECK (
    (fixed_cost_rate IS NULL OR (fixed_cost_rate >= 0 AND fixed_cost_rate <> 'NaN'::numeric))
    AND (monthly_fixed_cost IS NULL OR (monthly_fixed_cost >= 0 AND monthly_fixed_cost <> 'NaN'::numeric))
    AND (average_monthly_revenue IS NULL OR (average_monthly_revenue >= 0 AND average_monthly_revenue <> 'NaN'::numeric))
    AND (monthly_labor_cost IS NULL OR (monthly_labor_cost >= 0 AND monthly_labor_cost <> 'NaN'::numeric))
    AND (productive_hours IS NULL OR (productive_hours >= 0 AND productive_hours <> 'NaN'::numeric))
    AND (default_desired_margin IS NULL OR (default_desired_margin >= 0 AND default_desired_margin <> 'NaN'::numeric))
  ),
  ADD CONSTRAINT "pricing_configuration_revisions_fixed_cost_check" CHECK ((
    (fixed_cost_mode IS NULL AND fixed_cost_rate IS NULL AND monthly_fixed_cost IS NULL AND average_monthly_revenue IS NULL)
    OR (fixed_cost_mode = 'RATE' AND fixed_cost_rate IS NOT NULL AND monthly_fixed_cost IS NULL AND average_monthly_revenue IS NULL)
    OR (fixed_cost_mode = 'MONTHLY' AND fixed_cost_rate IS NULL AND monthly_fixed_cost IS NOT NULL AND average_monthly_revenue IS NOT NULL AND average_monthly_revenue > 0)
  ) IS TRUE),
  ADD CONSTRAINT "pricing_configuration_revisions_labor_check" CHECK ((
    (monthly_labor_cost IS NULL AND productive_hours IS NULL)
    OR (monthly_labor_cost IS NOT NULL AND productive_hours IS NOT NULL AND productive_hours > 0)
  ) IS TRUE),
  ADD CONSTRAINT "pricing_configuration_revisions_origins_check" CHECK (jsonb_typeof(parameter_origins) = 'object');

ALTER TABLE "pricing_sales_profile_revisions"
  ADD CONSTRAINT "pricing_sales_profile_revisions_revision_check" CHECK (revision > 0),
  ADD CONSTRAINT "pricing_sales_profile_revisions_name_check" CHECK (length(btrim(name)) > 0);

ALTER TABLE "pricing_deductions"
  ADD CONSTRAINT "pricing_deductions_position_check" CHECK (position > 0),
  ADD CONSTRAINT "pricing_deductions_name_check" CHECK (length(btrim(name)) > 0),
  ADD CONSTRAINT "pricing_deductions_rate_check" CHECK (rate >= 0 AND rate <> 'NaN'::numeric),
  ADD CONSTRAINT "pricing_deductions_origin_details_check" CHECK (origin_details IS NULL OR jsonb_typeof(origin_details) = 'object');

ALTER TABLE "product_pricing_compositions"
  ADD CONSTRAINT "product_pricing_compositions_revision_check" CHECK (revision > 0),
  ADD CONSTRAINT "product_pricing_compositions_values_check" CHECK (
    (desired_margin IS NULL OR (desired_margin >= 0 AND desired_margin <> 'NaN'::numeric))
    AND (time_minutes IS NULL OR (time_minutes >= 0 AND time_minutes <> 'NaN'::numeric))
    AND (freight_unit_cost IS NULL OR (freight_unit_cost >= 0 AND freight_unit_cost <> 'NaN'::numeric))
    AND (freight_total_cost IS NULL OR (freight_total_cost >= 0 AND freight_total_cost <> 'NaN'::numeric))
    AND (freight_quantity IS NULL OR (freight_quantity >= 0 AND freight_quantity <> 'NaN'::numeric))
    AND (freight_consumed_quantity IS NULL OR (freight_consumed_quantity >= 0 AND freight_consumed_quantity <> 'NaN'::numeric))
  ),
  ADD CONSTRAINT "product_pricing_compositions_labor_check" CHECK (
    (labor_enabled AND time_minutes IS NOT NULL) OR (NOT labor_enabled AND time_minutes IS NULL)
  ),
  ADD CONSTRAINT "product_pricing_compositions_freight_check" CHECK ((
    (freight_mode IS NULL AND freight_unit_cost IS NULL AND freight_total_cost IS NULL AND freight_quantity IS NULL AND freight_consumed_quantity IS NULL)
    OR (freight_mode = 'MANUAL' AND freight_unit_cost IS NOT NULL AND freight_total_cost IS NULL AND freight_quantity IS NULL AND freight_consumed_quantity IS NULL)
    OR (freight_mode = 'ALLOCATED' AND freight_unit_cost IS NULL AND freight_total_cost IS NOT NULL AND freight_quantity IS NOT NULL AND freight_quantity > 0)
  ) IS TRUE),
  ADD CONSTRAINT "product_pricing_compositions_origins_check" CHECK (jsonb_typeof(parameter_origins) = 'object');

ALTER TABLE "pricing_components"
  ADD CONSTRAINT "pricing_components_position_check" CHECK (position > 0),
  ADD CONSTRAINT "pricing_components_values_check" CHECK (
    quantity >= 0 AND quantity <> 'NaN'::numeric
    AND (stored_unit_cost IS NULL OR (stored_unit_cost >= 0 AND stored_unit_cost <> 'NaN'::numeric))
  ),
  ADD CONSTRAINT "pricing_components_cost_source_check" CHECK (
    (cost_source IN ('MANUAL', 'COPIED') AND stored_unit_cost IS NOT NULL AND source_product_id IS NULL)
    OR (cost_source = 'CATALOG' AND stored_unit_cost IS NULL AND source_product_id IS NOT NULL)
  ),
  ADD CONSTRAINT "pricing_components_origin_details_check" CHECK (origin_details IS NULL OR jsonb_typeof(origin_details) = 'object');

ALTER TABLE "pricing_calculation_versions"
  ADD CONSTRAINT "pricing_calculation_versions_number_check" CHECK (number > 0),
  ADD CONSTRAINT "pricing_calculation_versions_counts_check" CHECK (component_count >= 0 AND deduction_count >= 0),
  ADD CONSTRAINT "pricing_calculation_versions_contract_check" CHECK (snapshot_schema_version > 0 AND length(btrim(formula_version)) > 0),
  ADD CONSTRAINT "pricing_calculation_versions_composition_check" CHECK (
    (composition_id IS NULL AND composition_revision IS NULL)
    OR (composition_id IS NOT NULL AND composition_revision IS NOT NULL AND composition_revision > 0)
  ),
  ADD CONSTRAINT "pricing_calculation_versions_currency_check" CHECK (currency = 'BRL'),
  ADD CONSTRAINT "pricing_calculation_versions_prices_check" CHECK (
    minimum_price_commercial ~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
    AND suggested_price_commercial ~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
    AND analyzed_price ~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
  ),
  ADD CONSTRAINT "pricing_calculation_versions_state_check" CHECK (
    (state = 'BUILDING' AND finalized_at IS NULL) OR (state = 'FINALIZED' AND finalized_at IS NOT NULL)
  ),
  ADD CONSTRAINT "pricing_calculation_versions_snapshot_check" CHECK ((
    jsonb_typeof(snapshot) = 'object'
    AND jsonb_typeof(snapshot -> 'input') = 'object'
    AND jsonb_typeof(snapshot -> 'result') = 'object'
    AND jsonb_typeof(snapshot -> 'context') = 'object'
    AND snapshot #>> '{input,currency}' = currency
    AND snapshot #>> '{result,currency}' = currency
  ) IS TRUE);

ALTER TABLE "pricing_version_components"
  ADD CONSTRAINT "pricing_version_components_position_check" CHECK (position > 0),
  ADD CONSTRAINT "pricing_version_components_values_check" CHECK (
    quantity >= 0 AND quantity <> 'NaN'::numeric
    AND effective_unit_cost >= 0 AND effective_unit_cost <> 'NaN'::numeric
  ),
  ADD CONSTRAINT "pricing_version_components_results_check" CHECK (
    total_exact ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'
    AND total_display ~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
  ),
  ADD CONSTRAINT "pricing_version_components_cost_source_check" CHECK (
    (cost_source IN ('MANUAL', 'COPIED') AND source_product_id IS NULL)
    OR (cost_source = 'CATALOG' AND source_product_id IS NOT NULL)
  ),
  ADD CONSTRAINT "pricing_version_components_origin_details_check" CHECK (origin_details IS NULL OR jsonb_typeof(origin_details) = 'object');

ALTER TABLE "pricing_version_deductions"
  ADD CONSTRAINT "pricing_version_deductions_position_check" CHECK (position > 0),
  ADD CONSTRAINT "pricing_version_deductions_name_check" CHECK (length(btrim(name)) > 0),
  ADD CONSTRAINT "pricing_version_deductions_rate_check" CHECK (rate >= 0 AND rate <> 'NaN'::numeric),
  ADD CONSTRAINT "pricing_version_deductions_results_check" CHECK (
    amount_exact ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'
    AND amount_display ~ '^(0|[1-9][0-9]*)\.[0-9]{2}$'
  ),
  ADD CONSTRAINT "pricing_version_deductions_origin_details_check" CHECK (origin_details IS NULL OR jsonb_typeof(origin_details) = 'object');

ALTER TABLE "pricing_price_adoptions"
  ADD CONSTRAINT "pricing_price_adoptions_prices_check" CHECK (
    new_price >= 0 AND new_price <> 'NaN'::numeric
    AND (previous_price IS NULL OR (previous_price >= 0 AND previous_price <> 'NaN'::numeric))
  ),
  ADD CONSTRAINT "pricing_price_adoptions_confirmation_check" CHECK (
    classification <> 'BELOW_MINIMUM'
    OR (below_minimum_confirmed AND justification IS NOT NULL AND length(btrim(justification)) > 0)
  );

-- Never update/delete historical rows or physically delete editable roots.
CREATE FUNCTION public.pricing_reject_history_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Pricing history/roots cannot be changed by % on %', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER pricing_configuration_revisions_immutable
BEFORE UPDATE OR DELETE ON public."organization_pricing_configuration_revisions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_reject_history_change();
CREATE TRIGGER pricing_profile_revisions_immutable
BEFORE UPDATE OR DELETE ON public."pricing_sales_profile_revisions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_reject_history_change();
CREATE TRIGGER pricing_deductions_immutable
BEFORE UPDATE OR DELETE ON public."pricing_deductions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_reject_history_change();
CREATE TRIGGER pricing_adoptions_immutable
BEFORE UPDATE OR DELETE ON public."pricing_price_adoptions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_reject_history_change();
CREATE TRIGGER pricing_configurations_preserve
BEFORE DELETE ON public."organization_pricing_configurations"
FOR EACH ROW EXECUTE FUNCTION public.pricing_reject_history_change();
CREATE TRIGGER pricing_profiles_preserve
BEFORE DELETE ON public."pricing_sales_profiles"
FOR EACH ROW EXECUTE FUNCTION public.pricing_reject_history_change();
CREATE TRIGGER pricing_compositions_preserve
BEFORE DELETE ON public."product_pricing_compositions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_reject_history_change();

-- Inspect the final row, not the NEW image from an earlier event.
CREATE FUNCTION public.pricing_require_current_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  pointer uuid;
BEGIN
  EXECUTE format('SELECT current_revision_id FROM public.%I WHERE id = $1', TG_TABLE_NAME)
    INTO pointer USING NEW.id;
  IF pointer IS NULL THEN
    RAISE EXCEPTION 'Pricing root % must have a current revision at commit', NEW.id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER pricing_configurations_complete
AFTER INSERT OR UPDATE ON public."organization_pricing_configurations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.pricing_require_current_revision();
CREATE CONSTRAINT TRIGGER pricing_profiles_complete
AFTER INSERT OR UPDATE ON public."pricing_sales_profiles"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.pricing_require_current_revision();

-- Decimal comparison only: never form a cost, divisor, profit or price in SQL.
-- JSON decimals must be strings, even when the projection is numeric.
CREATE FUNCTION public.pricing_decimal_matches(value jsonb, expected numeric) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE
    WHEN jsonb_typeof(value) = 'string' AND value #>> '{}' ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (value #>> '{}')::numeric = expected
    ELSE false
  END;
$$;

CREATE FUNCTION public.pricing_guard_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  actual_count bigint;
  last_position integer;
  item record;
  frozen jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'BUILDING' THEN
      RAISE EXCEPTION 'Pricing version must start BUILDING' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' OR OLD.state = 'FINALIZED' THEN
    RAISE EXCEPTION 'Pricing versions cannot be deleted or changed after finalization' USING ERRCODE = '23514';
  END IF;
  IF NEW.state <> 'FINALIZED'
    OR (to_jsonb(NEW) - 'state' - 'finalized_at') IS DISTINCT FROM (to_jsonb(OLD) - 'state' - 'finalized_at')
    OR NEW.finalized_at IS NULL THEN
    RAISE EXCEPTION 'Only BUILDING -> FINALIZED with state/finalized_at is permitted' USING ERRCODE = '23514';
  END IF;

  -- Arrays use the existing motor contract; context remains an object whose
  -- complete typed contract/authorization will be validated by the application.
  IF jsonb_typeof(NEW.snapshot #> '{result,components}') IS DISTINCT FROM 'array'
    OR jsonb_typeof(NEW.snapshot #> '{result,analysis,deductions}') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Pricing snapshot must contain result component/deduction arrays' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(NEW.snapshot #> '{result,components}') <> NEW.component_count
    OR jsonb_array_length(NEW.snapshot #> '{result,analysis,deductions}') <> NEW.deduction_count
    OR NEW.snapshot #> '{result,minimumPrice,commercial}' IS DISTINCT FROM to_jsonb(NEW.minimum_price_commercial)
    OR NEW.snapshot #> '{result,suggestedPrice,commercial}' IS DISTINCT FROM to_jsonb(NEW.suggested_price_commercial)
    OR NEW.snapshot #> '{result,analysis,price}' IS DISTINCT FROM to_jsonb(NEW.analyzed_price)
    OR NEW.snapshot #> '{result,analysis,classification}' IS DISTINCT FROM to_jsonb(NEW.classification::text)
    OR NEW.snapshot #> '{result,formulaVersion}' IS DISTINCT FROM to_jsonb(NEW.formula_version) THEN
    RAISE EXCEPTION 'Pricing snapshot and summary differ' USING ERRCODE = '23514';
  END IF;

  SELECT count(*), max(position) INTO actual_count, last_position
  FROM public.pricing_version_components WHERE organization_id = NEW.organization_id AND version_id = NEW.id;
  -- UNIQUE(parent, position), positive positions + count/max guarantee 1..N.
  IF actual_count <> NEW.component_count OR coalesce(last_position, 0) <> NEW.component_count THEN
    RAISE EXCEPTION 'Pricing component count/positions differ' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), max(position) INTO actual_count, last_position
  FROM public.pricing_version_deductions WHERE organization_id = NEW.organization_id AND version_id = NEW.id;
  IF actual_count <> NEW.deduction_count OR coalesce(last_position, 0) <> NEW.deduction_count THEN
    RAISE EXCEPTION 'Pricing deduction count/positions differ' USING ERRCODE = '23514';
  END IF;

  FOR item IN SELECT * FROM public.pricing_version_components WHERE organization_id = NEW.organization_id AND version_id = NEW.id LOOP
    frozen := NEW.snapshot #> ARRAY['result', 'components', (item.position - 1)::text];
    IF (frozen -> 'description' = to_jsonb(item.description)
      AND frozen -> 'category' = to_jsonb(item.category::text)
      AND frozen -> 'unit' = to_jsonb(item.unit)
      AND public.pricing_decimal_matches(frozen -> 'quantity', item.quantity)
      AND public.pricing_decimal_matches(frozen -> 'unitCost', item.effective_unit_cost)
      AND frozen #> '{total,exact}' = to_jsonb(item.total_exact)
      AND frozen #> '{total,display}' = to_jsonb(item.total_display)
      AND frozen -> 'origin' = to_jsonb(item.cost_source::text)
      AND (frozen ->> 'productId') IS NOT DISTINCT FROM item.source_product_id::text) IS NOT TRUE THEN
      RAISE EXCEPTION 'Pricing component projection differs at position %', item.position USING ERRCODE = '23514';
    END IF;
  END LOOP;
  FOR item IN SELECT * FROM public.pricing_version_deductions WHERE organization_id = NEW.organization_id AND version_id = NEW.id LOOP
    frozen := NEW.snapshot #> ARRAY['result', 'analysis', 'deductions', (item.position - 1)::text];
    IF (frozen -> 'name' = to_jsonb(item.name)
      AND frozen -> 'category' = to_jsonb(item.category)
      AND public.pricing_decimal_matches(frozen -> 'rate', item.rate)
      AND frozen #> '{amount,exact}' = to_jsonb(item.amount_exact)
      AND frozen #> '{amount,display}' = to_jsonb(item.amount_display)
      AND frozen -> 'origin' = to_jsonb(item.origin::text)) IS NOT TRUE THEN
      RAISE EXCEPTION 'Pricing deduction projection differs at position %', item.position USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_versions_lifecycle
BEFORE INSERT OR UPDATE OR DELETE ON public."pricing_calculation_versions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_guard_version();

CREATE FUNCTION public.pricing_require_finalized_at_commit() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pricing_calculation_versions WHERE id = NEW.id AND state = 'BUILDING') THEN
    RAISE EXCEPTION 'Pricing version % must finalize in its creating transaction', NEW.id USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER pricing_versions_complete
AFTER INSERT OR UPDATE ON public."pricing_calculation_versions"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.pricing_require_finalized_at_commit();

-- Lock both parents when moving a projection; reject writes on either finalized
-- parent. These locks serialize projection writes with version finalization.
CREATE FUNCTION public.pricing_guard_projection() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  parent record;
  old_id uuid;
  new_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id := OLD.version_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_id := NEW.version_id; END IF;
  FOR parent IN
    SELECT id, state FROM public.pricing_calculation_versions
    WHERE id IN (old_id, new_id) ORDER BY id FOR UPDATE
  LOOP
    IF parent.state <> 'BUILDING' THEN
      RAISE EXCEPTION 'Cannot % a projection of finalized version %', TG_OP, parent.id USING ERRCODE = '23514';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_version_components_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."pricing_version_components"
FOR EACH ROW EXECUTE FUNCTION public.pricing_guard_projection();
CREATE TRIGGER pricing_version_deductions_guard
BEFORE INSERT OR UPDATE OR DELETE ON public."pricing_version_deductions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_guard_projection();

-- Reusable guard for current references and future commercial-item triggers.
-- Future referencing tables must attach a trigger calling this guard as well
-- as their organization/product/version FK; a FK alone cannot test state.
CREATE FUNCTION public.pricing_assert_finalized_version(org_id uuid, product_id_arg uuid, version_id_arg uuid)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pricing_calculation_versions
    WHERE organization_id = org_id AND product_id = product_id_arg AND id = version_id_arg AND state = 'FINALIZED'
  ) THEN
    RAISE EXCEPTION 'Pricing reference requires a finalized version of the same organization/product' USING ERRCODE = '23514';
  END IF;
END;
$$;
CREATE FUNCTION public.pricing_guard_product_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.adopted_pricing_version_id IS NOT NULL THEN
    PERFORM public.pricing_assert_finalized_version(NEW.organization_id, NEW.id, NEW.adopted_pricing_version_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_products_finalized_version
BEFORE INSERT OR UPDATE OF adopted_pricing_version_id, organization_id, id ON public."products"
FOR EACH ROW EXECUTE FUNCTION public.pricing_guard_product_version();

CREATE FUNCTION public.pricing_guard_adoption() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  chosen public.pricing_calculation_versions%ROWTYPE;
BEGIN
  PERFORM public.pricing_assert_finalized_version(NEW.organization_id, NEW.product_id, NEW.version_id);
  IF NEW.previous_version_id IS NOT NULL THEN
    PERFORM public.pricing_assert_finalized_version(NEW.organization_id, NEW.product_id, NEW.previous_version_id);
  END IF;
  SELECT * INTO chosen FROM public.pricing_calculation_versions WHERE id = NEW.version_id;
  IF NEW.new_price IS DISTINCT FROM chosen.analyzed_price::numeric OR NEW.classification <> chosen.classification THEN
    RAISE EXCEPTION 'Adoption price/classification must match its frozen analysis' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_adoptions_finalized_version
BEFORE INSERT ON public."pricing_price_adoptions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_guard_adoption();

-- Assembly is tracked by trusted transactional rows, never by tuple xmin.
CREATE FUNCTION public.pricing_guard_revision_deduction_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pricing_internal.revision_builds
    WHERE kind = 'PROFILE' AND revision_id = NEW.profile_revision_id
      AND organization_id = NEW.organization_id AND transaction_id = pg_current_xact_id()::text
  ) THEN
    RAISE EXCEPTION 'Deductions require a profile revision being built in this transaction' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.pricing_guard_revision_deduction_insert() FROM PUBLIC;
CREATE TRIGGER pricing_deductions_revision_creation
BEFORE INSERT ON public."pricing_deductions"
FOR EACH ROW EXECUTE FUNCTION public.pricing_guard_revision_deduction_insert();

-- Validate current catalogue references on composition writes. Later catalogue
-- changes are allowed; the application must re-resolve cost/active/unit on every
-- new calculation. Historical projections never compare against today's cost.
CREATE FUNCTION public.pricing_guard_catalog_component() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  owner_product uuid;
  source record;
BEGIN
  IF NEW.cost_source = 'CATALOG' THEN
    SELECT product_id INTO owner_product FROM public.product_pricing_compositions
    WHERE organization_id = NEW.organization_id AND id = NEW.composition_id;
    IF NEW.source_product_id = owner_product THEN
      RAISE EXCEPTION 'A pricing component cannot reference its own product' USING ERRCODE = '23514';
    END IF;
    SELECT is_active, direct_cost, unit INTO source FROM public.products
    WHERE organization_id = NEW.organization_id AND id = NEW.source_product_id;
    IF NOT FOUND OR NOT source.is_active OR source.direct_cost IS NULL
      OR source.direct_cost < 0
      OR source.direct_cost = 'NaN'::numeric
      OR upper(btrim(source.unit)) <> upper(btrim(NEW.unit)) THEN
      RAISE EXCEPTION 'Catalog component requires active product, cost and compatible unit' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_components_catalog_guard
BEFORE INSERT OR UPDATE ON public."pricing_components"
FOR EACH ROW EXECUTE FUNCTION public.pricing_guard_catalog_component();

-- Reference and commercial price may be written in separate statements of the
-- same adoption transaction. Observe the final product row at commit, allowing
-- either ordering while forbidding a price whose linked analysis is different.
-- A future manual PATCH must explicitly clear the pointer as specified by ADR-006;
-- this guard neither adopts a price nor clears any pointer automatically.
CREATE FUNCTION public.pricing_require_product_analysis_price() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  current_product public.products%ROWTYPE;
  analyzed text;
BEGIN
  SELECT * INTO current_product FROM public.products WHERE id = NEW.id;
  IF FOUND AND current_product.adopted_pricing_version_id IS NOT NULL THEN
    SELECT analyzed_price INTO analyzed FROM public.pricing_calculation_versions
    WHERE organization_id = current_product.organization_id
      AND product_id = current_product.id AND id = current_product.adopted_pricing_version_id;
    IF current_product.sale_price IS DISTINCT FROM analyzed::numeric THEN
      RAISE EXCEPTION 'Product sale price must match its adopted pricing version analysis' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER pricing_products_analysis_price
AFTER INSERT OR UPDATE ON public."products"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.pricing_require_product_analysis_price();

-- Private, short-lived transactional bookkeeping. No business model or financial
-- calculation is added. Rows roll back with savepoints and are removed by the
-- deferred guards. The application role must not own this schema or its objects.
CREATE SCHEMA pricing_internal;
REVOKE ALL ON SCHEMA pricing_internal FROM PUBLIC;
CREATE TABLE pricing_internal.revision_builds (
  kind text NOT NULL,
  revision_id uuid NOT NULL,
  root_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  transaction_id text NOT NULL,
  PRIMARY KEY (kind, revision_id)
);
CREATE TABLE pricing_internal.product_operations (
  transaction_id text NOT NULL,
  organization_id uuid NOT NULL,
  product_id uuid NOT NULL,
  previous_price numeric(14,2),
  previous_version_id uuid,
  product_written boolean NOT NULL DEFAULT false,
  events jsonb NOT NULL DEFAULT '[]',
  PRIMARY KEY (transaction_id, organization_id, product_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA pricing_internal FROM PUBLIC;

CREATE FUNCTION pricing_internal.capture_revision_build() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  root uuid := (to_jsonb(NEW) ->> TG_ARGV[2])::uuid;
BEGIN
  EXECUTE format('SELECT id FROM public.%I WHERE organization_id = $1 AND id = $2 FOR UPDATE', TG_ARGV[1])
    USING NEW.organization_id, root;
  INSERT INTO pricing_internal.revision_builds (kind, revision_id, root_id, organization_id, transaction_id)
  VALUES (TG_ARGV[0], NEW.id, root, NEW.organization_id, pg_current_xact_id()::text);
  RETURN NEW;
END;
$$;
CREATE FUNCTION pricing_internal.complete_revision_build() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  root uuid := (to_jsonb(NEW) ->> TG_ARGV[2])::uuid;
  pointer uuid;
BEGIN
  EXECUTE format('SELECT current_revision_id FROM public.%I WHERE organization_id = $1 AND id = $2', TG_ARGV[1])
    INTO pointer USING NEW.organization_id, root;
  IF pointer IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Every new pricing revision must become current in its creating transaction' USING ERRCODE = '23514';
  END IF;
  DELETE FROM pricing_internal.revision_builds
  WHERE kind = TG_ARGV[0] AND revision_id = NEW.id AND transaction_id = pg_current_xact_id()::text;
  RETURN NULL;
END;
$$;
CREATE FUNCTION pricing_internal.guard_revision_pointer() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  old_number integer;
  new_number integer;
BEGIN
  IF (NEW.id, NEW.organization_id, NEW.created_by_user_id, NEW.created_at)
    IS DISTINCT FROM (OLD.id, OLD.organization_id, OLD.created_by_user_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Pricing root identity/creation metadata are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.current_revision_id IS DISTINCT FROM OLD.current_revision_id THEN
    IF NOT EXISTS (SELECT 1 FROM pricing_internal.revision_builds
      WHERE kind = TG_ARGV[0] AND revision_id = NEW.current_revision_id
        AND root_id = NEW.id AND organization_id = NEW.organization_id
        AND transaction_id = pg_current_xact_id()::text) THEN
      RAISE EXCEPTION 'Current revision must be built for this root in this transaction' USING ERRCODE = '23514';
    END IF;
    EXECUTE format('SELECT revision FROM public.%I WHERE id = $1', TG_ARGV[1]) INTO new_number USING NEW.current_revision_id;
    IF OLD.current_revision_id IS NOT NULL THEN
      EXECUTE format('SELECT revision FROM public.%I WHERE id = $1', TG_ARGV[1]) INTO old_number USING OLD.current_revision_id;
      IF new_number <= old_number THEN
        RAISE EXCEPTION 'Pricing current revision must advance' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_configuration_revision_build
BEFORE INSERT ON public.organization_pricing_configuration_revisions
FOR EACH ROW EXECUTE FUNCTION pricing_internal.capture_revision_build('CONFIGURATION', 'organization_pricing_configurations', 'configuration_id');
CREATE CONSTRAINT TRIGGER pricing_configuration_revision_activate
AFTER INSERT ON public.organization_pricing_configuration_revisions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pricing_internal.complete_revision_build('CONFIGURATION', 'organization_pricing_configurations', 'configuration_id');
CREATE TRIGGER pricing_configuration_pointer_advance
BEFORE UPDATE ON public.organization_pricing_configurations
FOR EACH ROW EXECUTE FUNCTION pricing_internal.guard_revision_pointer('CONFIGURATION', 'organization_pricing_configuration_revisions');
CREATE TRIGGER pricing_profile_revision_build
BEFORE INSERT ON public.pricing_sales_profile_revisions
FOR EACH ROW EXECUTE FUNCTION pricing_internal.capture_revision_build('PROFILE', 'pricing_sales_profiles', 'profile_id');
CREATE CONSTRAINT TRIGGER pricing_profile_revision_activate
AFTER INSERT ON public.pricing_sales_profile_revisions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pricing_internal.complete_revision_build('PROFILE', 'pricing_sales_profiles', 'profile_id');
CREATE TRIGGER pricing_profile_pointer_advance
BEFORE UPDATE ON public.pricing_sales_profiles
FOR EACH ROW EXECUTE FUNCTION pricing_internal.guard_revision_pointer('PROFILE', 'pricing_sales_profile_revisions');

CREATE FUNCTION public.pricing_guard_composition_edit() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF (NEW.id, NEW.organization_id, NEW.product_id, NEW.created_by_user_id, NEW.created_at)
    IS DISTINCT FROM (OLD.id, OLD.organization_id, OLD.product_id, OLD.created_by_user_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Pricing composition identity/creation metadata are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'Pricing composition edit must increment revision by one' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pricing_components
    WHERE organization_id = NEW.organization_id AND composition_id = NEW.id
      AND cost_source = 'CATALOG' AND source_product_id = NEW.product_id) THEN
    RAISE EXCEPTION 'Pricing composition cannot reference its own product' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pricing_composition_edit_guard BEFORE UPDATE ON public.product_pricing_compositions
FOR EACH ROW EXECUTE FUNCTION public.pricing_guard_composition_edit();

-- The first financial write or adoption event captures the real starting state;
-- event-first locks Product too. No client-provided previous state is trusted.
CREATE FUNCTION pricing_internal.capture_product_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  INSERT INTO pricing_internal.product_operations
    (transaction_id, organization_id, product_id, previous_price, previous_version_id, product_written)
  VALUES (pg_current_xact_id()::text, OLD.organization_id, OLD.id, OLD.sale_price, OLD.adopted_pricing_version_id, true)
  ON CONFLICT (transaction_id, organization_id, product_id) DO UPDATE SET product_written = true;
  RETURN NEW;
END;
$$;
CREATE FUNCTION pricing_internal.capture_adoption_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  product public.products%ROWTYPE;
BEGIN
  SELECT * INTO product FROM public.products
  WHERE organization_id = NEW.organization_id AND id = NEW.product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adoption requires a product in its organization' USING ERRCODE = '23514';
  END IF;
  INSERT INTO pricing_internal.product_operations
    (transaction_id, organization_id, product_id, previous_price, previous_version_id)
  VALUES (pg_current_xact_id()::text, product.organization_id, product.id, product.sale_price, product.adopted_pricing_version_id)
  ON CONFLICT DO NOTHING;
  UPDATE pricing_internal.product_operations SET events = events || jsonb_build_array(to_jsonb(NEW))
  WHERE transaction_id = pg_current_xact_id()::text AND organization_id = NEW.organization_id AND product_id = NEW.product_id;
  RETURN NEW;
END;
$$;
CREATE FUNCTION pricing_internal.complete_product_operation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  product_id_arg uuid;
  operation pricing_internal.product_operations%ROWTYPE;
  product public.products%ROWTYPE;
  event jsonb;
  previous_analyzed text;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    product_id_arg := NEW.id;
  ELSE
    product_id_arg := NEW.product_id;
  END IF;
  SELECT * INTO operation FROM pricing_internal.product_operations
  WHERE transaction_id = pg_current_xact_id()::text AND organization_id = NEW.organization_id AND product_id = product_id_arg;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO product FROM public.products WHERE organization_id = operation.organization_id AND id = operation.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adoption product must remain present' USING ERRCODE = '23514';
  END IF;
  IF jsonb_array_length(operation.events) = 0 THEN
    IF product.adopted_pricing_version_id IS NOT NULL THEN
      RAISE EXCEPTION 'Product pricing adoption requires a corresponding event' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NOT operation.product_written THEN
      RAISE EXCEPTION 'Adoption event requires a product write in the same transaction' USING ERRCODE = '23514';
    END IF;
    FOR event IN SELECT value FROM jsonb_array_elements(operation.events) LOOP
      IF (event ->> 'previous_price')::numeric IS DISTINCT FROM operation.previous_price
        OR (event ->> 'previous_version_id')::uuid IS DISTINCT FROM operation.previous_version_id
        OR product.sale_price IS DISTINCT FROM (event ->> 'new_price')::numeric
        OR product.adopted_pricing_version_id IS DISTINCT FROM (event ->> 'version_id')::uuid THEN
        RAISE EXCEPTION 'Adoption event must match the real previous and final product states' USING ERRCODE = '23514';
      END IF;
      IF operation.previous_version_id IS NOT NULL THEN
        SELECT analyzed_price INTO previous_analyzed FROM public.pricing_calculation_versions
        WHERE organization_id = operation.organization_id AND product_id = operation.product_id
          AND id = operation.previous_version_id AND state = 'FINALIZED';
        IF previous_analyzed IS NULL OR previous_analyzed::numeric IS DISTINCT FROM operation.previous_price THEN
          RAISE EXCEPTION 'Previous adopted version must analyze the previous price' USING ERRCODE = '23514';
        END IF;
      END IF;
    END LOOP;
  END IF;
  DELETE FROM pricing_internal.product_operations
  WHERE transaction_id = operation.transaction_id AND organization_id = operation.organization_id AND product_id = operation.product_id;
  RETURN NULL;
END;
$$;
CREATE TRIGGER pricing_capture_product_write BEFORE UPDATE OF sale_price, adopted_pricing_version_id ON public.products
FOR EACH ROW EXECUTE FUNCTION pricing_internal.capture_product_write();
CREATE TRIGGER pricing_capture_adoption_event BEFORE INSERT ON public.pricing_price_adoptions
FOR EACH ROW EXECUTE FUNCTION pricing_internal.capture_adoption_event();
CREATE CONSTRAINT TRIGGER pricing_product_operation_complete
AFTER UPDATE ON public.products DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pricing_internal.complete_product_operation();
CREATE CONSTRAINT TRIGGER pricing_adoption_operation_complete
AFTER INSERT ON public.pricing_price_adoptions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pricing_internal.complete_product_operation();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pricing_internal FROM PUBLIC;

-- Capture the initial parent revision once, regardless of parent/component order.
-- Savepoints roll back both the edit and this private transactional state.
CREATE TABLE pricing_internal.composition_operations (
  transaction_id text NOT NULL,
  organization_id uuid NOT NULL,
  composition_id uuid NOT NULL,
  initial_revision integer NOT NULL,
  created_here boolean NOT NULL,
  PRIMARY KEY (transaction_id, organization_id, composition_id)
);
REVOKE ALL ON TABLE pricing_internal.composition_operations FROM PUBLIC;

CREATE FUNCTION pricing_internal.capture_composition_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.revision <> 1 THEN
      RAISE EXCEPTION 'Pricing composition must start at revision one' USING ERRCODE = '23514';
    END IF;
    INSERT INTO pricing_internal.composition_operations
      (transaction_id, organization_id, composition_id, initial_revision, created_here)
    VALUES (pg_current_xact_id()::text, NEW.organization_id, NEW.id, 1, true);
  ELSE
    INSERT INTO pricing_internal.composition_operations
      (transaction_id, organization_id, composition_id, initial_revision, created_here)
    VALUES (pg_current_xact_id()::text, OLD.organization_id, OLD.id, OLD.revision, false)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION pricing_internal.capture_component_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  component record;
  parent public.product_pricing_compositions%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id, NEW.organization_id, NEW.composition_id, NEW.created_at)
    IS DISTINCT FROM (OLD.id, OLD.organization_id, OLD.composition_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Pricing component identity/creation metadata are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN component := OLD; ELSE component := NEW; END IF;
  SELECT * INTO parent FROM public.product_pricing_compositions
  WHERE organization_id = component.organization_id AND id = component.composition_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing component requires its real organization/composition' USING ERRCODE = '23514';
  END IF;
  INSERT INTO pricing_internal.composition_operations
    (transaction_id, organization_id, composition_id, initial_revision, created_here)
  VALUES (pg_current_xact_id()::text, parent.organization_id, parent.id, parent.revision, false)
  ON CONFLICT DO NOTHING;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE FUNCTION pricing_internal.complete_composition_operation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  org uuid;
  parent_id uuid;
  operation pricing_internal.composition_operations%ROWTYPE;
  final_revision integer;
BEGIN
  IF TG_TABLE_NAME = 'product_pricing_compositions' THEN
    org := NEW.organization_id; parent_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    org := OLD.organization_id; parent_id := OLD.composition_id;
  ELSE
    org := NEW.organization_id; parent_id := NEW.composition_id;
  END IF;
  SELECT * INTO operation FROM pricing_internal.composition_operations
  WHERE transaction_id = pg_current_xact_id()::text AND organization_id = org AND composition_id = parent_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT revision INTO final_revision FROM public.product_pricing_compositions
  WHERE organization_id = org AND id = parent_id;
  IF final_revision IS DISTINCT FROM
    (operation.initial_revision + CASE WHEN operation.created_here THEN 0 ELSE 1 END) THEN
    RAISE EXCEPTION 'Pricing composition/components require exactly one parent revision increment, or initial revision one' USING ERRCODE = '23514';
  END IF;
  DELETE FROM pricing_internal.composition_operations
  WHERE transaction_id = operation.transaction_id AND organization_id = org AND composition_id = parent_id;
  RETURN NULL;
END;
$$;
CREATE TRIGGER pricing_capture_composition_write
BEFORE INSERT OR UPDATE ON public.product_pricing_compositions
FOR EACH ROW EXECUTE FUNCTION pricing_internal.capture_composition_write();
CREATE TRIGGER pricing_capture_component_write
BEFORE INSERT OR UPDATE OR DELETE ON public.pricing_components
FOR EACH ROW EXECUTE FUNCTION pricing_internal.capture_component_write();
CREATE CONSTRAINT TRIGGER pricing_composition_operation_complete
AFTER INSERT OR UPDATE ON public.product_pricing_compositions DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pricing_internal.complete_composition_operation();
CREATE CONSTRAINT TRIGGER pricing_component_operation_complete
AFTER INSERT OR UPDATE OR DELETE ON public.pricing_components DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION pricing_internal.complete_composition_operation();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pricing_internal FROM PUBLIC;
