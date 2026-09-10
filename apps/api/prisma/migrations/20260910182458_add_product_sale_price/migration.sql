-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sale_price" DECIMAL(14,2);

-- AddConstraint
ALTER TABLE "products"
ADD CONSTRAINT "products_sale_price_check"
CHECK (
  ("sale_price" IS NULL)
  OR (("sale_price" >= 0) AND ("sale_price" <> 'NaN'::numeric))
);
