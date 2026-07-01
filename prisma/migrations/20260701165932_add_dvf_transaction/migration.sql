-- CreateTable
CREATE TABLE "DvfTransaction" (
    "id" TEXT NOT NULL,
    "dateMutation" TIMESTAMP(3) NOT NULL,
    "commune" TEXT NOT NULL,
    "codePostal" TEXT,
    "typeLocal" TEXT NOT NULL,
    "surface" DOUBLE PRECISION NOT NULL,
    "pieces" INTEGER,
    "valeurFonciere" DOUBLE PRECISION NOT NULL,
    "prixM2" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DvfTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DvfTransaction_commune_idx" ON "DvfTransaction"("commune");

-- CreateIndex
CREATE INDEX "DvfTransaction_codePostal_idx" ON "DvfTransaction"("codePostal");

-- CreateIndex
CREATE INDEX "DvfTransaction_typeLocal_idx" ON "DvfTransaction"("typeLocal");
