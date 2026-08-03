-- CreateTable
CREATE TABLE "LocationCache" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "codePostal" TEXT NOT NULL,
    "radius" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "schools" JSONB,
    "hospitals" JSONB,
    "doctors" JSONB,
    "pharmacies" JSONB,
    "transport" JSONB,
    "shops" JSONB,
    "restaurants" JSONB,
    "totalPlaces" INTEGER NOT NULL DEFAULT 0,
    "locationScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationCache_city_idx" ON "LocationCache"("city");

-- CreateIndex
CREATE INDEX "LocationCache_codePostal_idx" ON "LocationCache"("codePostal");

-- CreateIndex
CREATE UNIQUE INDEX "LocationCache_city_codePostal_radius_key" ON "LocationCache"("city", "codePostal", "radius");
