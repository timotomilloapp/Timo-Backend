-- DropForeignKey
ALTER TABLE "appetizers" DROP CONSTRAINT IF EXISTS "appetizers_areaId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "appetizers_areaId_idx";

-- AlterTable
ALTER TABLE "appetizers" DROP COLUMN "areaId";

-- CreateTable
CREATE TABLE "appetizer_details" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "appetizerId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "appetizer_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appetizer_details_appetizerId_areaId_key" ON "appetizer_details"("appetizerId", "areaId");

-- CreateIndex
CREATE UNIQUE INDEX "appetizers_date_key" ON "appetizers"("date");

-- AddForeignKey
ALTER TABLE "appetizer_details" ADD CONSTRAINT "appetizer_details_appetizerId_fkey" FOREIGN KEY ("appetizerId") REFERENCES "appetizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appetizer_details" ADD CONSTRAINT "appetizer_details_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
