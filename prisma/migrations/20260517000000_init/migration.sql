-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "GameVariant" AS ENUM ('TEXAS_HOLDEM', 'PLO4');

-- CreateEnum
CREATE TYPE "TableVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('OPEN', 'RUNNING', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HandPhase" AS ENUM ('WAITING', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'COMPLETE');

-- CreateEnum
CREATE TYPE "PlayerActionType" AS ENUM ('FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BUY_IN', 'CASH_OUT', 'TOURNAMENT_BUY_IN', 'TOURNAMENT_PAYOUT', 'ADMIN_ADJUSTMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYPAL', 'SUMUP');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('SNG', 'MTT');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTERING', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerPaymentId" TEXT,
    "amountUsd" DECIMAL(10,2) NOT NULL,
    "creditsGranted" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokerTable" (
    "id" TEXT NOT NULL,
    "variant" "GameVariant" NOT NULL,
    "visibility" "TableVisibility" NOT NULL,
    "status" "TableStatus" NOT NULL DEFAULT 'OPEN',
    "hostUserId" TEXT,
    "inviteCode" TEXT,
    "name" TEXT,
    "maxSeats" INTEGER NOT NULL DEFAULT 9,
    "smallBlind" INTEGER NOT NULL,
    "bigBlind" INTEGER NOT NULL,
    "minBuyIn" INTEGER NOT NULL,
    "maxBuyIn" INTEGER NOT NULL,
    "tournamentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokerTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSeat" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "userId" TEXT,
    "stack" INTEGER NOT NULL DEFAULT 0,
    "isSittingOut" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hand" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "handNumber" INTEGER NOT NULL,
    "dealerSeatIndex" INTEGER NOT NULL,
    "boardCards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "potTotal" INTEGER NOT NULL DEFAULT 0,
    "phase" "HandPhase" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Hand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandPlayerCards" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cards" TEXT[],
    "revealed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HandPlayerCards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandAction" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seatIndex" INTEGER NOT NULL,
    "action" "PlayerActionType" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "street" "HandPhase" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" "GameVariant" NOT NULL,
    "type" "TournamentType" NOT NULL,
    "visibility" "TableVisibility" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "hostUserId" TEXT,
    "buyIn" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "startingStack" INTEGER NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "playersPerTable" INTEGER NOT NULL DEFAULT 9,
    "blindStructure" JSONB NOT NULL,
    "prizeStructure" JSONB NOT NULL,
    "scheduledStartAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentRegistration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stack" INTEGER NOT NULL,
    "finishPlace" INTEGER,
    "eliminatedAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PokerTable_inviteCode_key" ON "PokerTable"("inviteCode");

-- CreateIndex
CREATE INDEX "PokerTable_visibility_status_idx" ON "PokerTable"("visibility", "status");

-- CreateIndex
CREATE INDEX "PokerTable_tournamentId_idx" ON "PokerTable"("tournamentId");

-- CreateIndex
CREATE INDEX "PokerTable_inviteCode_idx" ON "PokerTable"("inviteCode");

-- CreateIndex
CREATE INDEX "TableSeat_userId_idx" ON "TableSeat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TableSeat_tableId_seatIndex_key" ON "TableSeat"("tableId", "seatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "TableSeat_tableId_userId_key" ON "TableSeat"("tableId", "userId");

-- CreateIndex
CREATE INDEX "Hand_tableId_startedAt_idx" ON "Hand"("tableId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hand_tableId_handNumber_key" ON "Hand"("tableId", "handNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HandPlayerCards_handId_userId_key" ON "HandPlayerCards"("handId", "userId");

-- CreateIndex
CREATE INDEX "HandAction_handId_idx" ON "HandAction"("handId");

-- CreateIndex
CREATE INDEX "Tournament_status_visibility_idx" ON "Tournament"("status", "visibility");

-- CreateIndex
CREATE INDEX "Tournament_scheduledStartAt_idx" ON "Tournament"("scheduledStartAt");

-- CreateIndex
CREATE INDEX "TournamentRegistration_tournamentId_idx" ON "TournamentRegistration"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRegistration_tournamentId_userId_key" ON "TournamentRegistration"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokerTable" ADD CONSTRAINT "PokerTable_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokerTable" ADD CONSTRAINT "PokerTable_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSeat" ADD CONSTRAINT "TableSeat_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "PokerTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSeat" ADD CONSTRAINT "TableSeat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hand" ADD CONSTRAINT "Hand_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "PokerTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandPlayerCards" ADD CONSTRAINT "HandPlayerCards_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandAction" ADD CONSTRAINT "HandAction_handId_fkey" FOREIGN KEY ("handId") REFERENCES "Hand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandAction" ADD CONSTRAINT "HandAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentRegistration" ADD CONSTRAINT "TournamentRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

