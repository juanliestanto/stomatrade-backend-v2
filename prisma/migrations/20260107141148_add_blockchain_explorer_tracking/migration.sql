/*
  Warnings:

  - Added the required column `explorerUrl` to the `AppProject` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable AppProject: Add explorerUrl with default, then drop default
-- Using Lisk Sepolia as default since that's the current deployment
ALTER TABLE "AppProject" ADD COLUMN "explorerUrl" TEXT NOT NULL DEFAULT 'https://sepolia-blockscout.lisk.com';
ALTER TABLE "AppProject" ALTER COLUMN "explorerUrl" DROP DEFAULT;
ALTER TABLE "AppProject" ALTER COLUMN "rpcUrl" DROP DEFAULT;

-- AlterTable projects: Add blockchain tracking fields (all nullable)
-- These will be populated during project minting from AppProject
ALTER TABLE "projects" ADD COLUMN "chainId" TEXT;
ALTER TABLE "projects" ADD COLUMN "contractAddress" TEXT;
ALTER TABLE "projects" ADD COLUMN "explorerUrl" TEXT;
