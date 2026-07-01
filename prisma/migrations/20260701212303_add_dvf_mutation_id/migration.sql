/*
  Warnings:

  - A unique constraint covering the columns `[mutationId]` on the table `DvfTransaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mutationId` to the `DvfTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "DvfTransaction_dateMutation_idx";

-- DropIndex
DROP INDEX "DvfTransaction_surface_idx";

-- AlterTable
ALTER TABLE "DvfTransaction" ADD COLUMN     "mutationId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DvfTransaction_mutationId_key" ON "DvfTransaction"("mutationId");
