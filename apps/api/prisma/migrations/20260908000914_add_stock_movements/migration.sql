/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,id]` on the table `products` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "StockMovementOrigin" AS ENUM ('MANUAL', 'ADJUSTMENT', 'REVERSAL');

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "origin" "StockMovementOrigin" NOT NULL DEFAULT 'MANUAL',
    "quantity" DECIMAL(18,6) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "reversal_of_id" UUID,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_quantity_check"
CHECK (
    "quantity" > 0
    AND "quantity" <> 'NaN'::numeric
);

-- AddCheckConstraint
ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_reason_check"
CHECK (
    length(trim("reason")) >= 3
);

-- AddCheckConstraint
ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_reversal_check"
CHECK (
    (
        "origin" = 'REVERSAL'::"StockMovementOrigin"
        AND "reversal_of_id" IS NOT NULL
        AND "reversal_of_id" <> "id"
    )
    OR
    (
        "origin" <> 'REVERSAL'::"StockMovementOrigin"
        AND "reversal_of_id" IS NULL
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_reversal_of_id_key" ON "stock_movements"("reversal_of_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_product_id_occurred_at_id_idx" ON "stock_movements"("organization_id", "product_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_occurred_at_id_idx" ON "stock_movements"("organization_id", "occurred_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_id_key" ON "products"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_product_id_fkey" FOREIGN KEY ("organization_id", "product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
