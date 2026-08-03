/*
  Warnings:

  - A unique constraint covering the columns `[city,codePostal,radius,latitudeKey,longitudeKey]` on the table `LocationCache` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `latitudeKey` to the `LocationCache` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitudeKey` to the `LocationCache` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LocationCache_city_codePostal_radius_key";

-- DropIndex
DROP INDEX "LocationCache_latitude_longitude_idx";

-- AlterTable
ALTER TABLE "LocationCache" ADD COLUMN     "latitudeKey" TEXT NOT NULL,
ADD COLUMN     "longitudeKey" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LocationCache_city_codePostal_radius_latitudeKey_longitudeK_key" ON "LocationCache"("city", "codePostal", "radius", "latitudeKey", "longitudeKey");
