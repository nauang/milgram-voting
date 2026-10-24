-- CreateTable
CREATE TABLE "Prisoner" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Prisoner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "prisonerId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "prisonerId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "choice" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" SERIAL NOT NULL,
    "prisonerId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "forgiveCount" INTEGER NOT NULL,
    "notForgiveCount" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prisoner_number_key" ON "Prisoner"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Prisoner_slug_key" ON "Prisoner"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Image_prisonerId_season_key" ON "Image"("prisonerId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE INDEX "Vote_prisonerId_seasonId_idx" ON "Vote"("prisonerId", "seasonId");

-- CreateIndex
CREATE INDEX "Vote_voterKey_prisonerId_createdAt_idx" ON "Vote"("voterKey", "prisonerId", "createdAt");

-- CreateIndex
CREATE INDEX "Vote_seasonId_prisonerId_choice_idx" ON "Vote"("seasonId", "prisonerId", "choice");

-- CreateIndex
CREATE UNIQUE INDEX "Result_prisonerId_seasonId_key" ON "Result"("prisonerId", "seasonId");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_prisonerId_fkey" FOREIGN KEY ("prisonerId") REFERENCES "Prisoner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_prisonerId_fkey" FOREIGN KEY ("prisonerId") REFERENCES "Prisoner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_prisonerId_fkey" FOREIGN KEY ("prisonerId") REFERENCES "Prisoner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
