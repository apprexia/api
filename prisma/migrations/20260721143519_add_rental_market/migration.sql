-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE');

-- CreateEnum
CREATE TYPE "RoomCategory" AS ENUM ('ALL', 'ONE_TWO', 'THREE_PLUS');

-- CreateEnum
CREATE TYPE "PredictionType" AS ENUM ('COMMUNE', 'MAILLE');

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "analysisConfidence" DOUBLE PRECISION,
ADD COLUMN     "annualCashflow" DOUBLE PRECISION,
ADD COLUMN     "engine" JSONB,
ADD COLUMN     "estimatedRentHigh" DOUBLE PRECISION,
ADD COLUMN     "estimatedRentLow" DOUBLE PRECISION,
ADD COLUMN     "estimatedRentMonthly" DOUBLE PRECISION,
ADD COLUMN     "monthlyCashflow" DOUBLE PRECISION,
ADD COLUMN     "rentConfidence" DOUBLE PRECISION,
ADD COLUMN     "rentPerSquareMeter" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "RentalMarket" (
    "id" SERIAL NOT NULL,
    "zoneId" INTEGER,
    "year" INTEGER NOT NULL,
    "inseeCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "roomCategory" "RoomCategory" NOT NULL,
    "rentMedianM2" DOUBLE PRECISION NOT NULL,
    "rentLowM2" DOUBLE PRECISION NOT NULL,
    "rentHighM2" DOUBLE PRECISION NOT NULL,
    "predictionType" "PredictionType" NOT NULL,
    "observations" INTEGER NOT NULL,
    "observationsArea" INTEGER NOT NULL,
    "adjustedR2" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalMarket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalMarket_inseeCode_idx" ON "RentalMarket"("inseeCode");

-- CreateIndex
CREATE INDEX "RentalMarket_city_idx" ON "RentalMarket"("city");

-- CreateIndex
CREATE UNIQUE INDEX "RentalMarket_year_inseeCode_propertyType_roomCategory_key" ON "RentalMarket"("year", "inseeCode", "propertyType", "roomCategory");
