/*
  Warnings:

  - You are about to drop the column `commune` on the `DvfTransaction` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "DvfTransaction_codePostal_typeLocal_idx";

-- DropIndex
DROP INDEX "DvfTransaction_commune_idx";

-- DropIndex
DROP INDEX "DvfTransaction_commune_typeLocal_idx";

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "dvfKey" TEXT;

-- AlterTable
ALTER TABLE "DvfTransaction" DROP COLUMN "commune",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "year" INTEGER;

-- CreateIndex
CREATE INDEX "DvfTransaction_city_idx" ON "DvfTransaction"("city");

-- CreateIndex
CREATE INDEX "DvfTransaction_city_typeLocal_idx" ON "DvfTransaction"("city", "typeLocal");

-- CreateIndex
CREATE INDEX "DvfTransaction_city_codePostal_idx" ON "DvfTransaction"("city", "codePostal");

-- CreateIndex
CREATE INDEX "DvfTransaction_year_city_idx" ON "DvfTransaction"("year", "city");

-- CreateIndex
CREATE INDEX "DvfTransaction_year_city_typeLocal_idx" ON "DvfTransaction"("year", "city", "typeLocal");
