-- CreateTable
CREATE TABLE "Prisoner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "slug" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Image" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prisonerId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "Image_prisonerId_fkey" FOREIGN KEY ("prisonerId") REFERENCES "Prisoner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Season" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "startsAt" DATETIME,
    "endsAt" DATETIME
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prisonerId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "choice" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vote_prisonerId_fkey" FOREIGN KEY ("prisonerId") REFERENCES "Prisoner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vote_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prisonerId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "forgiveCount" INTEGER NOT NULL,
    "notForgiveCount" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    CONSTRAINT "Result_prisonerId_fkey" FOREIGN KEY ("prisonerId") REFERENCES "Prisoner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Result_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
