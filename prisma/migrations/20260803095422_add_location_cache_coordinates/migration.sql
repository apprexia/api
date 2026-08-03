/*
  Warnings:

  - You are about to drop the column `latitudeKey` on the `LocationCache` table. All the data in the column will be lost.
  - You are about to drop the column `longitudeKey` on the `LocationCache` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[city,codePostal,radius]` on the table `LocationCache` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LocationCache_city_codePostal_radius_latitudeKey_longitudeK_key";

-- AlterTable
ALTER TABLE "LocationCache" DROP COLUMN "latitudeKey",
DROP COLUMN "longitudeKey";

-- CreateIndex
CREATE UNIQUE INDEX "LocationCache_city_codePostal_radius_key" ON "LocationCache"("city", "codePostal", "radius");
