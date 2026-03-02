-- AlterTable
ALTER TABLE "cards"
ADD COLUMN "unique_views_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "views_log"
ADD COLUMN "ip_hash" VARCHAR(64),
ADD COLUMN "is_unique" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "path" TEXT NOT NULL,
    "message" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "views_log_card_id_ip_hash_viewed_at_idx" ON "views_log"("card_id", "ip_hash", "viewed_at");

-- CreateIndex
CREATE INDEX "error_logs_type_occurred_at_idx" ON "error_logs"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "error_logs_occurred_at_idx" ON "error_logs"("occurred_at");
