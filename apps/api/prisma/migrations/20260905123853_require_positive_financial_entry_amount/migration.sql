-- ReplaceCheckConstraint
ALTER TABLE "financial_entries"
DROP CONSTRAINT "financial_entries_amount_check";

ALTER TABLE "financial_entries"
ADD CONSTRAINT "financial_entries_amount_check"
CHECK ("amount" > 0);