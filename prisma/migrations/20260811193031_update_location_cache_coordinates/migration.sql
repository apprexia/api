/*
  Warnings:

  - A unique constraint covering the columns `[city,codePostal,latitude,longitude,radius]` on the table `LocationCache` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LocationCache_city_codePostal_radius_key";

-- CreateIndex
CREATE UNIQUE INDEX "LocationCache_city_codePostal_latitude_longitude_radius_key" ON "LocationCache"("city", "codePostal", "latitude", "longitude", "radius");
