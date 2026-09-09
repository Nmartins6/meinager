/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,id]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "financial_quotes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_until" DATE,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_quote_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "product_id" UUID,
    "position" INTEGER NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financial_quotes_organization_id_status_idx" ON "financial_quotes"("organization_id", "status");

-- CreateIndex
CREATE INDEX "financial_quotes_organization_id_client_id_created_at_idx" ON "financial_quotes"("organization_id", "client_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "financial_quotes_organization_id_id_key" ON "financial_quotes"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_quotes_organization_id_number_key" ON "financial_quotes"("organization_id", "number");

-- CreateIndex
CREATE INDEX "financial_quote_items_organization_id_quote_id_idx" ON "financial_quote_items"("organization_id", "quote_id");

-- CreateIndex
CREATE INDEX "financial_quote_items_organization_id_product_id_idx" ON "financial_quote_items"("organization_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_quote_items_quote_id_position_key" ON "financial_quote_items"("quote_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "clients_organization_id_id_key" ON "clients"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "financial_quotes" ADD CONSTRAINT "financial_quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_quotes" ADD CONSTRAINT "financial_quotes_organization_id_client_id_fkey" FOREIGN KEY ("organization_id", "client_id") REFERENCES "clients"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_quote_items" ADD CONSTRAINT "financial_quote_items_organization_id_quote_id_fkey" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "financial_quotes"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_quote_items" ADD CONSTRAINT "financial_quote_items_organization_id_product_id_fkey" FOREIGN KEY ("organization_id", "product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add financial integrity checks
ALTER TABLE "financial_quotes"
  ADD CONSTRAINT "financial_quotes_number_check"
    CHECK (number > 0),
  ADD CONSTRAINT "financial_quotes_totals_check"
    CHECK (
      subtotal <> 'NaN'::numeric
      AND subtotal >= 0
      AND discount <> 'NaN'::numeric
      AND discount >= 0
      AND discount <= subtotal
      AND total <> 'NaN'::numeric
      AND total >= 0
      AND total = subtotal - discount
    );

ALTER TABLE "financial_quote_items"
  ADD CONSTRAINT "financial_quote_items_position_check"
    CHECK (position > 0),
  ADD CONSTRAINT "financial_quote_items_quantity_check"
    CHECK (quantity <> 'NaN'::numeric AND quantity > 0),
  ADD CONSTRAINT "financial_quote_items_unit_price_check"
    CHECK (unit_price <> 'NaN'::numeric AND unit_price >= 0),
  ADD CONSTRAINT "financial_quote_items_total_check"
    CHECK (
      total <> 'NaN'::numeric
      AND total >= 0
      AND total = ROUND(quantity * unit_price, 2)
    );