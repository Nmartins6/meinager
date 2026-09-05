-- CreateEnum
CREATE TYPE "FinancialEntryStatus" AS ENUM ('PENDING', 'PARTIAL', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialEntryOrigin" AS ENUM ('MANUAL', 'DUPLICATED', 'ORDER', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "financial_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "client_id" UUID,
    "source_entry_id" UUID,
    "description" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "FinancialEntryOrigin" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_settlements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "settled_at" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "reversed_at" TIMESTAMPTZ(3),
    "reversal_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_entries_organization_id_due_date_idx" ON "financial_entries"("organization_id", "due_date");

-- CreateIndex
CREATE INDEX "financial_entries_organization_id_status_idx" ON "financial_entries"("organization_id", "status");

-- CreateIndex
CREATE INDEX "financial_entries_period_id_category_id_idx" ON "financial_entries"("period_id", "category_id");

-- CreateIndex
CREATE INDEX "financial_entries_client_id_idx" ON "financial_entries"("client_id");

-- CreateIndex
CREATE INDEX "financial_entries_source_entry_id_idx" ON "financial_entries"("source_entry_id");

-- CreateIndex
CREATE INDEX "financial_settlements_organization_id_settled_at_idx" ON "financial_settlements"("organization_id", "settled_at");

-- CreateIndex
CREATE INDEX "financial_settlements_entry_id_settled_at_idx" ON "financial_settlements"("entry_id", "settled_at");

-- CreateIndex
CREATE INDEX "financial_settlements_account_id_settled_at_idx" ON "financial_settlements"("account_id", "settled_at");

-- AddCheckConstraint
ALTER TABLE "financial_entries"
ADD CONSTRAINT "financial_entries_amount_check"
CHECK ("amount" >= 0);

-- AddCheckConstraint
ALTER TABLE "financial_entries"
ADD CONSTRAINT "financial_entries_cancellation_check"
CHECK (
    (
        "status" = 'CANCELLED'
        AND "cancelled_at" IS NOT NULL
    )
    OR
    (
        "status" <> 'CANCELLED'
        AND "cancelled_at" IS NULL
    )
);

-- AddCheckConstraint
ALTER TABLE "financial_entries"
ADD CONSTRAINT "financial_entries_duplication_check"
CHECK (
    (
        "origin" = 'DUPLICATED'
        AND "source_entry_id" IS NOT NULL
        AND "source_entry_id" <> "id"
    )
    OR
    (
        "origin" <> 'DUPLICATED'
        AND "source_entry_id" IS NULL
    )
);

-- AddCheckConstraint
ALTER TABLE "financial_settlements"
ADD CONSTRAINT "financial_settlements_amount_check"
CHECK ("amount" > 0);

-- AddCheckConstraint
ALTER TABLE "financial_settlements"
ADD CONSTRAINT "financial_settlements_reversal_check"
CHECK (
    (
        "reversed_at" IS NULL
        AND "reversal_reason" IS NULL
    )
    OR
    (
        "reversed_at" IS NOT NULL
        AND "reversal_reason" IS NOT NULL
        AND length(trim("reversal_reason")) > 0
    )
);

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_source_entry_id_fkey" FOREIGN KEY ("source_entry_id") REFERENCES "financial_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "financial_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_settlements" ADD CONSTRAINT "financial_settlements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
