import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating contract configuration to Mantle...');

  // Read new ABI
  const abiPath = path.join(__dirname, '../src/blockchain/abi/StomaTradeNew.json');
  const newAbi = fs.readFileSync(abiPath, 'utf-8');

  // Mantle Sepolia configuration
  const mantleConfig = {
    name: 'StomaTrade',
    description: 'StomaTrade Contract on Mantle Sepolia',
    chainId: 'eip155:5001',
    contractAddress: '0x08A2cefa99A8848cD3aC34620f49F115587dcE28',
    abi: newAbi,
    rpcUrl: 'https://rpc.sepolia.mantle.xyz',
  };

  // Check if record exists
  const existing = await prisma.appProject.findFirst({
    where: { name: 'StomaTrade' },
  });

  if (existing) {
    console.log('✅ Found existing StomaTrade record, updating...');
    await prisma.appProject.update({
      where: { id: existing.id },
      data: {
        chainId: mantleConfig.chainId,
        contractAddress: mantleConfig.contractAddress,
        abi: mantleConfig.abi,
        description: mantleConfig.description,
        rpcUrl: mantleConfig.rpcUrl,
      },
    });
    console.log('✅ Updated successfully!');
  } else {
    console.log('✅ No existing record, creating new...');
    await prisma.appProject.create({
      data: mantleConfig,
    });
    console.log('✅ Created successfully!');
  }

  console.log('\n📊 Current configuration:');
  console.log(`Contract Address: ${mantleConfig.contractAddress}`);
  console.log(`Chain ID: ${mantleConfig.chainId}`);
  console.log(`Network: Mantle Sepolia Testnet`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
