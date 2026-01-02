/*
  Warnings:

  - Added the required column `rpcUrl` to the `AppProject` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AppProject" ADD COLUMN     "rpcUrl" TEXT NOT NULL DEFAULT 'https://rpc.sepolia.mantle.xyz';
