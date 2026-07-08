/*
  Warnings:

  - You are about to drop the column `estimatedValue` on the `Analysis` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Analysis" DROP COLUMN "estimatedValue",
ADD COLUMN     "dvfReferenceValue" DOUBLE PRECISION,
ADD COLUMN     "estimatedValueHigh" DOUBLE PRECISION,
ADD COLUMN     "estimatedValueLow" DOUBLE PRECISION,
ADD COLUMN     "marketAdjustment" TEXT;
