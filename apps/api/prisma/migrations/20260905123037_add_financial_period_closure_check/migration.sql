-- AddCheckConstraint
ALTER TABLE "financial_periods"
ADD CONSTRAINT "financial_periods_closure_check"
CHECK (
  (
    "status" = 'OPEN'::"FinancialPeriodStatus"
    AND "closed_at" IS NULL
  )
  OR
  (
    "status" = 'CLOSED'::"FinancialPeriodStatus"
    AND "closed_at" IS NOT NULL
  )
);