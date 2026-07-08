-- CreateIndex
CREATE INDEX "Analysis_city_idx" ON "Analysis"("city");

-- CreateIndex
CREATE INDEX "Analysis_codePostal_idx" ON "Analysis"("codePostal");

-- CreateIndex
CREATE INDEX "Analysis_city_codePostal_idx" ON "Analysis"("city", "codePostal");
