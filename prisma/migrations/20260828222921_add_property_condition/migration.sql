-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('NEUF', 'RECENT', 'RENOVE', 'BON_ETAT', 'A_RENOVER', 'INCONNU');

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "propertyCondition" "PropertyCondition" NOT NULL DEFAULT 'INCONNU',
ADD COLUMN     "propertyConditionConfidence" DOUBLE PRECISION,
ADD COLUMN     "propertyConditionSignals" TEXT[] DEFAULT ARRAY[]::TEXT[];
