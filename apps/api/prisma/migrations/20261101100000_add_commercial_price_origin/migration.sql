-- Legacy documents retain an unknown origin. No existing value is inferred.
CREATE TYPE "public"."CommercialPriceOrigin" AS ENUM ('CATALOG', 'MANUAL');

ALTER TABLE "public"."financial_quote_items"
  ADD COLUMN "price_origin" "public"."CommercialPriceOrigin",
  ADD COLUMN "pricing_version_id" UUID,
  ADD CONSTRAINT "financial_quote_items_price_origin_check" CHECK (
    ("price_origin" IS NOT NULL OR "pricing_version_id" IS NULL)
    AND ("price_origin" IS DISTINCT FROM 'MANUAL'::"public"."CommercialPriceOrigin" OR "pricing_version_id" IS NULL)
    AND ("price_origin" IS DISTINCT FROM 'CATALOG'::"public"."CommercialPriceOrigin" OR "product_id" IS NOT NULL)
  );

ALTER TABLE "public"."order_items"
  ADD COLUMN "price_origin" "public"."CommercialPriceOrigin",
  ADD COLUMN "pricing_version_id" UUID,
  ADD CONSTRAINT "order_items_price_origin_check" CHECK (
    ("price_origin" IS NOT NULL OR "pricing_version_id" IS NULL)
    AND ("price_origin" IS DISTINCT FROM 'MANUAL'::"public"."CommercialPriceOrigin" OR "pricing_version_id" IS NULL)
    AND ("price_origin" IS DISTINCT FROM 'CATALOG'::"public"."CommercialPriceOrigin" OR "product_id" IS NOT NULL)
  );

CREATE INDEX "financial_quote_items_org_product_version_idx"
  ON "public"."financial_quote_items"("organization_id", "product_id", "pricing_version_id");
CREATE INDEX "order_items_org_product_version_idx"
  ON "public"."order_items"("organization_id", "product_id", "pricing_version_id");

ALTER TABLE "public"."financial_quote_items"
  ADD CONSTRAINT "financial_quote_items_pricing_version_fkey"
  FOREIGN KEY ("organization_id", "product_id", "pricing_version_id")
  REFERENCES "public"."pricing_calculation_versions"("organization_id", "product_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "public"."order_items"
  ADD CONSTRAINT "order_items_pricing_version_fkey"
  FOREIGN KEY ("organization_id", "product_id", "pricing_version_id")
  REFERENCES "public"."pricing_calculation_versions"("organization_id", "product_id", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
