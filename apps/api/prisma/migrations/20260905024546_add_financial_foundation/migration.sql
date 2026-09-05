-- CreateEnum
CREATE TYPE "FinancialPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FinancialRevenueSource" AS ENUM ('ENTRIES', 'MANUAL_TOTAL');

-- CreateEnum
CREATE TYPE "FinancialCategoryType" AS ENUM ('REVENUE', 'FIXED_EXPENSE', 'VARIABLE_EXPENSE');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'CHECKING_ACCOUNT', 'SAVINGS_ACCOUNT', 'DIGITAL_WALLET', 'OTHER');

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "year" SMALLINT NOT NULL,
    "month" SMALLINT NOT NULL,
    "status" "FinancialPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "revenue_source" "FinancialRevenueSource" NOT NULL DEFAULT 'ENTRIES',
    "manual_revenue" DECIMAL(14,2),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "type" "FinancialCategoryType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "financial_periods"
ADD CONSTRAINT "financial_periods_year_check"
CHECK ("year" BETWEEN 1 AND 9999);

-- AddCheckConstraint
ALTER TABLE "financial_periods"
ADD CONSTRAINT "financial_periods_month_check"
CHECK ("month" BETWEEN 1 AND 12);

-- AddCheckConstraint
ALTER TABLE "financial_periods"
ADD CONSTRAINT "financial_periods_revenue_source_check"
CHECK (
    (
        "revenue_source" = 'ENTRIES'
        AND "manual_revenue" IS NULL
    )
    OR
    (
        "revenue_source" = 'MANUAL_TOTAL'
        AND "manual_revenue" IS NOT NULL
        AND "manual_revenue" >= 0
    )
);

-- CreateIndex
CREATE INDEX "financial_periods_organization_id_status_idx" ON "financial_periods"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_organization_id_year_month_key" ON "financial_periods"("organization_id", "year", "month");

-- CreateIndex
CREATE INDEX "financial_categories_organization_id_is_active_idx" ON "financial_categories"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_organization_id_type_normalized_name_key" ON "financial_categories"("organization_id", "type", "normalized_name");

-- CreateIndex
CREATE INDEX "financial_accounts_organization_id_is_active_idx" ON "financial_accounts"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "financial_accounts_organization_id_normalized_name_key" ON "financial_accounts"("organization_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
