-- CreateTable
CREATE TABLE "public_link" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "resumeName" TEXT NOT NULL,
    "autoRelease" BOOLEAN NOT NULL DEFAULT false,
    "latestReleaseId" TEXT,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_release" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "generation" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "runtimeId" TEXT NOT NULL,
    "settingsSha256" TEXT NOT NULL,
    "pdfSha256" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "pdf" BYTEA NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_release_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_link_token_key" ON "public_link"("token");

-- CreateIndex
CREATE UNIQUE INDEX "public_link_userId_resumeId_key" ON "public_link"("userId", "resumeId");

-- CreateIndex
CREATE INDEX "public_release_userId_idx" ON "public_release"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "public_release_linkId_number_key" ON "public_release"("linkId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "public_release_userId_operationId_key" ON "public_release"("userId", "operationId");

-- AddForeignKey
ALTER TABLE "public_link" ADD CONSTRAINT "public_link_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_release" ADD CONSTRAINT "public_release_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "public_link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_release" ADD CONSTRAINT "public_release_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
