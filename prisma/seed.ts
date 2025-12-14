import { PrismaClient, ROLES, GENDER, SUBMISSION_STATUS, PROJECT_STATUS } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding...');

  // Clear existing data (in development only!)
  console.log('Clearing existing data...');
  await prisma.profitClaim.deleteMany();
  await prisma.profitPool.deleteMany();
  await prisma.investmentPortfolio.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.file.deleteMany();
  await prisma.projectSubmission.deleteMany();
  await prisma.farmerSubmission.deleteMany();
  await prisma.project.deleteMany();
  await prisma.land.deleteMany();
  await prisma.farmer.deleteMany();
  await prisma.collector.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  console.log('Creating users...');
  const admin = await prisma.user.create({
    data: {
      walletAddress: '0x1111111111111111111111111111111111111111',
      role: ROLES.ADMIN,
      balance: '1000000000000000000000000', // 1M IDRX
    },
  });

  const collector1 = await prisma.user.create({
    data: {
      walletAddress: '0x2222222222222222222222222222222222222222',
      role: ROLES.COLLECTOR,
      balance: '500000000000000000000000', // 500K IDRX
    },
  });

  const investor1 = await prisma.user.create({
    data: {
      walletAddress: '0x3333333333333333333333333333333333333333',
      role: ROLES.INVESTOR,
      balance: '2000000000000000000000000', // 2M IDRX
    },
  });

  const investor2 = await prisma.user.create({
    data: {
      walletAddress: '0x4444444444444444444444444444444444444444',
      role: ROLES.INVESTOR,
      balance: '1500000000000000000000000', // 1.5M IDRX
    },
  });

  const investor3 = await prisma.user.create({
    data: {
      walletAddress: '0x5555555555555555555555555555555555555555',
      role: ROLES.INVESTOR,
      balance: '1800000000000000000000000', // 1.8M IDRX
    },
  });

  console.log('✅ Users created (5)');

  // Create Collector Profile
  console.log('Creating collector profile...');
  const collectorProfile = await prisma.collector.create({
    data: {
      userId: collector1.id,
      nik: '3201012345678901',
      name: 'PT Pertanian Sejahtera',
      address: 'Jl. Raya Bogor KM 20, Bogor, Jawa Barat',
    },
  });

  console.log('✅ Collector profile created');

  // Create Farmers
  console.log('Creating farmers...');
  const farmer1 = await prisma.farmer.create({
    data: {
      collectorId: collectorProfile.id,
      nik: '3201019876543210',
      name: 'Budi Santoso',
      age: 45,
      gender: GENDER.MALE,
      address: 'Desa Sukamaju, Kec. Ciawi, Bogor',
      tokenId: 1,
    },
  });

  const farmer2 = await prisma.farmer.create({
    data: {
      collectorId: collectorProfile.id,
      nik: '3201015555666677',
      name: 'Siti Rahayu',
      age: 38,
      gender: GENDER.FEMALE,
      address: 'Desa Makmur, Kec. Cisarua, Bogor',
      tokenId: 2,
    },
  });

  const farmer3 = await prisma.farmer.create({
    data: {
      collectorId: collectorProfile.id,
      nik: '3201017777888899',
      name: 'Ahmad Hidayat',
      age: 42,
      gender: GENDER.MALE,
      address: 'Desa Sejahtera, Kec. Megamendung, Bogor',
      tokenId: 3,
    },
  });

  console.log('✅ Farmers created (3)');

  // Create Lands
  console.log('Creating lands...');
  const land1 = await prisma.land.create({
    data: {
      farmerId: farmer1.id,
      tokenId: 101,
      latitude: -6.5971,
      longitude: 106.8060,
      address: 'Sawah Blok A, Desa Sukamaju, Bogor',
    },
  });

  const land2 = await prisma.land.create({
    data: {
      farmerId: farmer2.id,
      tokenId: 102,
      latitude: -6.6122,
      longitude: 106.8354,
      address: 'Sawah Blok B, Desa Makmur, Bogor',
    },
  });

  const land3 = await prisma.land.create({
    data: {
      farmerId: farmer3.id,
      tokenId: 103,
      latitude: -6.6300,
      longitude: 106.8500,
      address: 'Perkebunan Kopi Blok C, Desa Sejahtera, Bogor',
    },
  });

  console.log('✅ Lands created (3)');

  // Create Projects
  console.log('Creating projects...');
  const project1 = await prisma.project.create({
    data: {
      tokenId: 1001,
      collectorId: collectorProfile.id,
      farmerId: farmer1.id,
      landId: land1.id,
      commodity: 'Rice',
      name: 'Rice Premium Grade A Harvest Q1 2026',
      volume: 5000,
      volumeDecimal: 18,
      profitShare: 25,
      sendDate: new Date('2026-03-15'),
      status: PROJECT_STATUS.ACTIVE,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      tokenId: 1002,
      collectorId: collectorProfile.id,
      farmerId: farmer2.id,
      landId: land2.id,
      commodity: 'Coffee',
      name: 'Arabica Coffee Premium Harvest 2026',
      volume: 3000,
      volumeDecimal: 18,
      profitShare: 30,
      sendDate: new Date('2026-04-20'),
      status: PROJECT_STATUS.ACTIVE,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      tokenId: 1003,
      collectorId: collectorProfile.id,
      farmerId: farmer3.id,
      landId: land3.id,
      commodity: 'Corn',
      name: 'Sweet Corn Organic Harvest 2026',
      volume: 4500,
      volumeDecimal: 18,
      profitShare: 20,
      sendDate: new Date('2026-05-10'),
      status: PROJECT_STATUS.ACTIVE,
    },
  });

  console.log('✅ Projects created (3)');

  // Create Project Submissions
  console.log('Creating project submissions...');
  await prisma.projectSubmission.create({
    data: {
      projectId: project1.id,
      valueProject: '150000000000000000000000', // 150K IDRX
      maxCrowdFunding: '100000000000000000000000', // 100K IDRX
      metadataCid: 'QmRiceProject123',
      status: SUBMISSION_STATUS.MINTED,
      submittedBy: collector1.walletAddress,
      approvedBy: admin.walletAddress,
      mintedTokenId: 1001,
    },
  });

  await prisma.projectSubmission.create({
    data: {
      projectId: project2.id,
      valueProject: '120000000000000000000000', // 120K IDRX
      maxCrowdFunding: '80000000000000000000000', // 80K IDRX
      metadataCid: 'QmCoffeeProject456',
      status: SUBMISSION_STATUS.MINTED,
      submittedBy: collector1.walletAddress,
      approvedBy: admin.walletAddress,
      mintedTokenId: 1002,
    },
  });

  await prisma.projectSubmission.create({
    data: {
      projectId: project3.id,
      valueProject: '90000000000000000000000', // 90K IDRX
      maxCrowdFunding: '60000000000000000000000', // 60K IDRX
      metadataCid: 'QmCornProject789',
      status: SUBMISSION_STATUS.MINTED,
      submittedBy: collector1.walletAddress,
      approvedBy: admin.walletAddress,
      mintedTokenId: 1003,
    },
  });

  console.log('✅ Project submissions created (3)');

  // Create Files (project images)
  console.log('Creating project files...');
  await prisma.file.create({
    data: {
      reffId: project1.id,
      url: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800',
      type: 'image/jpeg',
    },
  });

  await prisma.file.create({
    data: {
      reffId: project2.id,
      url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
      type: 'image/jpeg',
    },
  });

  await prisma.file.create({
    data: {
      reffId: project3.id,
      url: 'https://images.unsplash.com/photo-1551836022-8b2858c9c69b?w=800',
      type: 'image/jpeg',
    },
  });

  console.log('✅ Project files created (3)');

  // Create Investments
  console.log('Creating investments...');
  await prisma.investment.create({
    data: {
      userId: investor1.id,
      projectId: project1.id,
      amount: '30000000000000000000000', // 30K IDRX
      receiptTokenId: 5001,
      transactionHash: '0xabc123def456',
      blockNumber: 12345,
    },
  });

  await prisma.investment.create({
    data: {
      userId: investor2.id,
      projectId: project1.id,
      amount: '20000000000000000000000', // 20K IDRX
      receiptTokenId: 5002,
      transactionHash: '0xdef789ghi012',
      blockNumber: 12346,
    },
  });

  await prisma.investment.create({
    data: {
      userId: investor1.id,
      projectId: project2.id,
      amount: '25000000000000000000000', // 25K IDRX
      receiptTokenId: 5003,
      transactionHash: '0xjkl345mno678',
      blockNumber: 12347,
    },
  });

  await prisma.investment.create({
    data: {
      userId: investor3.id,
      projectId: project2.id,
      amount: '15000000000000000000000', // 15K IDRX
      receiptTokenId: 5004,
      transactionHash: '0xpqr901stu234',
      blockNumber: 12348,
    },
  });

  await prisma.investment.create({
    data: {
      userId: investor2.id,
      projectId: project3.id,
      amount: '18000000000000000000000', // 18K IDRX
      receiptTokenId: 5005,
      transactionHash: '0xvwx567yza890',
      blockNumber: 12349,
    },
  });

  await prisma.investment.create({
    data: {
      userId: investor3.id,
      projectId: project3.id,
      amount: '12000000000000000000000', // 12K IDRX
      receiptTokenId: 5006,
      transactionHash: '0xbcd123efg456',
      blockNumber: 12350,
    },
  });

  console.log('✅ Investments created (6)');

  // Create Investment Portfolios
  console.log('Creating investment portfolios...');
  await prisma.investmentPortfolio.create({
    data: {
      userId: investor1.id,
      totalInvested: '55000000000000000000000', // 55K IDRX
      totalProfit: '13750000000000000000000', // 13.75K IDRX (25% avg ROI)
      totalClaimed: '10000000000000000000000', // 10K IDRX
      activeInvestments: 2,
      completedInvestments: 0,
      avgROI: 25.0,
    },
  });

  await prisma.investmentPortfolio.create({
    data: {
      userId: investor2.id,
      totalInvested: '38000000000000000000000', // 38K IDRX
      totalProfit: '8550000000000000000000', // 8.55K IDRX
      totalClaimed: '6000000000000000000000', // 6K IDRX
      activeInvestments: 2,
      completedInvestments: 0,
      avgROI: 22.5,
    },
  });

  await prisma.investmentPortfolio.create({
    data: {
      userId: investor3.id,
      totalInvested: '27000000000000000000000', // 27K IDRX
      totalProfit: '6750000000000000000000', // 6.75K IDRX
      totalClaimed: '4000000000000000000000', // 4K IDRX
      activeInvestments: 2,
      completedInvestments: 0,
      avgROI: 25.0,
    },
  });

  console.log('✅ Investment portfolios created (3)');

  // Create Profit Pools
  console.log('Creating profit pools...');
  await prisma.profitPool.create({
    data: {
      projectId: project1.id,
      totalDeposited: '15000000000000000000000', // 15K IDRX
      totalClaimed: '10000000000000000000000', // 10K IDRX
      remainingProfit: '5000000000000000000000', // 5K IDRX
      lastDepositAt: new Date(),
    },
  });

  await prisma.profitPool.create({
    data: {
      projectId: project2.id,
      totalDeposited: '14000000000000000000000', // 14K IDRX
      totalClaimed: '10000000000000000000000', // 10K IDRX
      remainingProfit: '4000000000000000000000', // 4K IDRX
      lastDepositAt: new Date(),
    },
  });

  await prisma.profitPool.create({
    data: {
      projectId: project3.id,
      totalDeposited: '8000000000000000000000', // 8K IDRX
      totalClaimed: '4000000000000000000000', // 4K IDRX
      remainingProfit: '4000000000000000000000', // 4K IDRX
      lastDepositAt: new Date(),
    },
  });

  console.log('✅ Profit pools created (3)');

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log('- Users: 5 (1 Admin, 1 Collector, 3 Investors)');
  console.log('- Collectors: 1');
  console.log('- Farmers: 3');
  console.log('- Lands: 3');
  console.log('- Projects: 3 (All Active, All Minted)');
  console.log('- Project Submissions: 3 (All Minted)');
  console.log('- Project Files/Images: 3');
  console.log('- Investments: 6');
  console.log('- Investment Portfolios: 3');
  console.log('- Profit Pools: 3');
  console.log('\n✨ Database ready for testing!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
