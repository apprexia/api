-- CreateTable
CREATE TABLE "ProjectEstimate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyIncome" INTEGER NOT NULL,
    "monthlyCredits" INTEGER NOT NULL DEFAULT 0,
    "downPayment" INTEGER NOT NULL DEFAULT 0,
    "householdSize" INTEGER NOT NULL DEFAULT 1,
    "loanDuration" INTEGER NOT NULL,
    "borrowingCapacity" INTEGER NOT NULL,
    "monthlyPayment" INTEGER NOT NULL,
    "minBudget" INTEGER NOT NULL,
    "maxBudget" INTEGER NOT NULL,
    "targetBudget" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEstimate_userId_key" ON "ProjectEstimate"("userId");

-- AddForeignKey
ALTER TABLE "ProjectEstimate" ADD CONSTRAINT "ProjectEstimate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
