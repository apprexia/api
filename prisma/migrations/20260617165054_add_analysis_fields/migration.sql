/*
  Warnings:

  - A unique constraint covering the columns `[userId,analysisId]` on the table `Favorite` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "marketPosition" TEXT,
ADD COLUMN     "negotiationPotential" INTEGER,
ADD COLUMN     "riskLevel" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_analysisId_key" ON "Favorite"("userId", "analysisId");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
