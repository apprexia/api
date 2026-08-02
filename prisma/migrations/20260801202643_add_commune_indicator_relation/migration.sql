-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "codeInsee" TEXT,
ADD COLUMN     "communeIndicatorCodeInsee" TEXT;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_communeIndicatorCodeInsee_fkey" FOREIGN KEY ("communeIndicatorCodeInsee") REFERENCES "CommuneIndicator"("codeInsee") ON DELETE SET NULL ON UPDATE CASCADE;
