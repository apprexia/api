-- CreateIndex
CREATE INDEX "DvfTransaction_surface_idx" ON "DvfTransaction"("surface");

-- CreateIndex
CREATE INDEX "DvfTransaction_dateMutation_idx" ON "DvfTransaction"("dateMutation");

-- CreateIndex
CREATE INDEX "DvfTransaction_codePostal_typeLocal_idx" ON "DvfTransaction"("codePostal", "typeLocal");

-- CreateIndex
CREATE INDEX "DvfTransaction_commune_typeLocal_idx" ON "DvfTransaction"("commune", "typeLocal");
