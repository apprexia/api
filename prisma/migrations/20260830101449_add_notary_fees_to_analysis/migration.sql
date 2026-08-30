-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "estimatedNotaryFees" DECIMAL(12,2),
ADD COLUMN     "notaryFeeRate" DECIMAL(6,4);
