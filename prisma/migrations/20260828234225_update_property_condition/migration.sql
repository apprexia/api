/*
  Warnings:

  - The values [RECENT,RENOVE,BON_ETAT,A_RENOVER] on the enum `PropertyCondition` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PropertyCondition_new" AS ENUM ('NEUF', 'ANCIEN', 'INCONNU');
ALTER TABLE "public"."Analysis" ALTER COLUMN "propertyCondition" DROP DEFAULT;
ALTER TABLE "Analysis" ALTER COLUMN "propertyCondition" TYPE "PropertyCondition_new" USING ("propertyCondition"::text::"PropertyCondition_new");
ALTER TYPE "PropertyCondition" RENAME TO "PropertyCondition_old";
ALTER TYPE "PropertyCondition_new" RENAME TO "PropertyCondition";
DROP TYPE "public"."PropertyCondition_old";
ALTER TABLE "Analysis" ALTER COLUMN "propertyCondition" SET DEFAULT 'INCONNU';
COMMIT;
