/*
  Warnings:

  - You are about to drop the column `doctors` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `hospitals` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `locationScore` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `pharmacies` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `restaurants` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `schools` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `shops` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `totalPlaces` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `transport` on the `LocationCache` table. All the data in the column will be lost.
  - Added the required column `data` to the `LocationCache` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LocationCache_city_idx";

-- DropIndex
DROP INDEX "LocationCache_codePostal_idx";

-- AlterTable
ALTER TABLE "LocationCache" DROP COLUMN "doctors",
DROP COLUMN "hospitals",
DROP COLUMN "latitude",
DROP COLUMN "locationScore",
DROP COLUMN "longitude",
DROP COLUMN "pharmacies",
DROP COLUMN "restaurants",
DROP COLUMN "schools",
DROP COLUMN "shops",
DROP COLUMN "totalPlaces",
DROP COLUMN "transport",
ADD COLUMN     "data" JSONB NOT NULL;
