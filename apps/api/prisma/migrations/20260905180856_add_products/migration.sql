-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "ProductType" NOT NULL DEFAULT 'PRODUCT',
    "name" VARCHAR(150) NOT NULL,
    "normalized_name" VARCHAR(150) NOT NULL,
    "sku" VARCHAR(60),
    "barcode" VARCHAR(50),
    "unit" VARCHAR(20) NOT NULL,
    "direct_cost" DECIMAL(18,6),
    "track_inventory" BOOLEAN NOT NULL DEFAULT false,
    "minimum_stock" DECIMAL(18,6),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "products"
ADD CONSTRAINT "products_direct_cost_check"
CHECK (
    "direct_cost" IS NULL
    OR "direct_cost" >= 0
);

-- AddCheckConstraint
ALTER TABLE "products"
ADD CONSTRAINT "products_minimum_stock_check"
CHECK (
    "minimum_stock" IS NULL
    OR "minimum_stock" >= 0
);

-- AddCheckConstraint
ALTER TABLE "products"
ADD CONSTRAINT "products_inventory_type_check"
CHECK (
    NOT "track_inventory"
    OR "type" = 'PRODUCT'::"ProductType"
);

-- AddCheckConstraint
ALTER TABLE "products"
ADD CONSTRAINT "products_minimum_stock_tracking_check"
CHECK (
    "track_inventory"
    OR "minimum_stock" IS NULL
);

-- CreateIndex
CREATE INDEX "products_organization_id_normalized_name_idx" ON "products"("organization_id", "normalized_name");

-- CreateIndex
CREATE INDEX "products_organization_id_type_is_active_idx" ON "products"("organization_id", "type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_barcode_key" ON "products"("organization_id", "barcode");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
