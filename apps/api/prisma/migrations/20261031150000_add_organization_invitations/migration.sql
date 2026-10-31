-- Existing sessions have no trustworthy organization context. Require fresh login.
UPDATE "public"."sessions" SET "revoked_at" = CURRENT_TIMESTAMP WHERE "revoked_at" IS NULL;

ALTER TABLE "public"."sessions" ADD COLUMN "active_organization_id" UUID;
ALTER TABLE "public"."sessions" ADD COLUMN "context_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_context_version_nonnegative_check" CHECK ("context_version" >= 0);

CREATE INDEX "sessions_active_organization_id_idx" ON "public"."sessions"("active_organization_id");

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_active_membership_fkey"
  FOREIGN KEY ("active_organization_id", "user_id")
  REFERENCES "public"."organization_members"("organization_id", "user_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "public"."organization_invitations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "normalized_email" VARCHAR(254) NOT NULL,
  "role" "public"."OrganizationRole" NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "accepted_by_user_id" UUID,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "accepted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_invitations_role_check" CHECK ("role" <> 'OWNER'::"public"."OrganizationRole"),
  CONSTRAINT "organization_invitations_lifecycle_check" CHECK (
    ("accepted_at" IS NULL) = ("accepted_by_user_id" IS NULL)
    AND NOT ("accepted_at" IS NOT NULL AND "revoked_at" IS NOT NULL)
    AND "expires_at" > "created_at"
  )
);

CREATE UNIQUE INDEX "organization_invitations_token_hash_key" ON "public"."organization_invitations"("token_hash");
CREATE INDEX "organization_invitations_organization_id_created_at_idx" ON "public"."organization_invitations"("organization_id", "created_at");
CREATE INDEX "organization_invitations_normalized_email_expires_at_idx" ON "public"."organization_invitations"("normalized_email", "expires_at");

ALTER TABLE "public"."organization_invitations"
  ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_invitations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_invitations_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
