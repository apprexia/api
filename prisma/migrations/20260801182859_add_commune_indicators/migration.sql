-- CreateTable
CREATE TABLE "CommuneIndicator" (
    "codeInsee" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "codeDepartement" TEXT,
    "region" TEXT,
    "population" INTEGER,
    "evolutionPopulation5Years" DOUBLE PRECISION,
    "medianPriceM2" DOUBLE PRECISION,
    "medianHousePriceM2" DOUBLE PRECISION,
    "medianApartmentPriceM2" DOUBLE PRECISION,
    "dvfTransactions" INTEGER,
    "priceEvolution5Years" DOUBLE PRECISION,
    "dpeAB" DOUBLE PRECISION,
    "passoiresDpe" DOUBLE PRECISION,
    "schoolIndex" DOUBLE PRECISION,
    "fiberCoverage" DOUBLE PRECISION,
    "icpeSurface" DOUBLE PRECISION,
    "sevesoSurface" DOUBLE PRECISION,
    "floodRisk" DOUBLE PRECISION,
    "doctorAccess" DOUBLE PRECISION,
    "propertyTaxRate" DOUBLE PRECISION,
    "propertyTaxM2" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommuneIndicator_pkey" PRIMARY KEY ("codeInsee")
);

-- CreateIndex
CREATE INDEX "CommuneIndicator_commune_idx" ON "CommuneIndicator"("commune");
