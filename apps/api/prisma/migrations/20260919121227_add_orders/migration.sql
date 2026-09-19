-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_ART_APPROVAL', 'AWAITING_RELEASE', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_ART_APPROVAL',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "art_approved_at" TIMESTAMPTZ(3),
    "released_at" TIMESTAMPTZ(3),
    "ready_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
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

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_organization_id_status_idx" ON "orders"("organization_id", "status");

-- CreateIndex
CREATE INDEX "orders_organization_id_client_id_created_at_idx" ON "orders"("organization_id", "client_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_organization_id_id_key" ON "orders"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_organization_id_number_key" ON "orders"("organization_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_organization_id_quote_id_key" ON "orders"("organization_id", "quote_id");

-- CreateIndex
CREATE INDEX "order_items_organization_id_order_id_idx" ON "order_items"("organization_id", "order_id");

-- CreateIndex
CREATE INDEX "order_items_organization_id_product_id_idx" ON "order_items"("organization_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_position_key" ON "order_items"("order_id", "position");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_quote_id_fkey" FOREIGN KEY ("organization_id", "quote_id") REFERENCES "financial_quotes"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_client_id_fkey" FOREIGN KEY ("organization_id", "client_id") REFERENCES "clients"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_order_id_fkey" FOREIGN KEY ("organization_id", "order_id") REFERENCES "orders"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_product_id_fkey" FOREIGN KEY ("organization_id", "product_id") REFERENCES "products"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial integrity checks for orders
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_number_check"
    CHECK ("number" > 0),
  ADD CONSTRAINT "orders_subtotal_check"
    CHECK ("subtotal" <> 'NaN'::numeric AND "subtotal" >= 0),
  ADD CONSTRAINT "orders_discount_check"
    CHECK ("discount" <> 'NaN'::numeric AND "discount" >= 0),
  ADD CONSTRAINT "orders_total_check"
    CHECK (
      "total" <> 'NaN'::numeric
      AND "total" >= 0
      AND "discount" <= "subtotal"
      AND "total" = "subtotal" - "discount"
    );

-- Financial integrity checks for order items
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_position_check"
    CHECK ("position" > 0),
  ADD CONSTRAINT "order_items_quantity_check"
    CHECK ("quantity" <> 'NaN'::numeric AND "quantity" > 0),
  ADD CONSTRAINT "order_items_unit_price_check"
    CHECK ("unit_price" <> 'NaN'::numeric AND "unit_price" >= 0),
  ADD CONSTRAINT "order_items_total_check"
    CHECK (
      "total" <> 'NaN'::numeric
      AND "total" >= 0
      AND "total" = ROUND("quantity" * "unit_price", 2)
    );