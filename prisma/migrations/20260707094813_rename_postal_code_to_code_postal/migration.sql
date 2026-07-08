/*
  Warnings:

  - You are about to drop the column `postalCode` on the `Analysis` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Analysis" DROP COLUMN "postalCode",
ADD COLUMN     "codePostal" TEXT;
