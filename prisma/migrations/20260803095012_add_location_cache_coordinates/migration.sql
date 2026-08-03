/*
  Warnings:

  - Added the required column `latitude` to the `LocationCache` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `LocationCache` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LocationCache" ADD COLUMN     "latitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "longitude" DOUBLE PRECISION NOT NULL;

-- CreateIndex
CREATE INDEX "LocationCache_latitude_longitude_idx" ON "LocationCache"("latitude", "longitude");
