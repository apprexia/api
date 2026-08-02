/*
  Warnings:

  - You are about to drop the column `communeSummary` on the `Analysis` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Analysis" DROP COLUMN "communeSummary",
ADD COLUMN     "communeAnalysis" TEXT;
