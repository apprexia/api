-- AlterTable
ALTER TABLE "CommuneIndicator" ADD COLUMN     "localScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "CommuneIndicator_codeDepartement_idx" ON "CommuneIndicator"("codeDepartement");
