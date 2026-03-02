-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "avatar_url" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "hashtag" VARCHAR(50),
    "address" TEXT,
    "postcode" VARCHAR(20),
    "email" VARCHAR(100),
    "extra_phone" VARCHAR(30),
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "url" TEXT,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buttons" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "views_log" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device" VARCHAR(20),

    CONSTRAINT "views_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cards_slug_key" ON "cards"("slug");

-- CreateIndex
CREATE INDEX "cards_is_active_idx" ON "cards"("is_active");

-- CreateIndex
CREATE INDEX "cards_created_at_idx" ON "cards"("created_at");

-- CreateIndex
CREATE INDEX "tags_card_id_sort_order_idx" ON "tags"("card_id", "sort_order");

-- CreateIndex
CREATE INDEX "buttons_card_id_sort_order_idx" ON "buttons"("card_id", "sort_order");

-- CreateIndex
CREATE INDEX "views_log_card_id_viewed_at_idx" ON "views_log"("card_id", "viewed_at");

-- CreateIndex
CREATE INDEX "views_log_viewed_at_idx" ON "views_log"("viewed_at");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buttons" ADD CONSTRAINT "buttons_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "views_log" ADD CONSTRAINT "views_log_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
