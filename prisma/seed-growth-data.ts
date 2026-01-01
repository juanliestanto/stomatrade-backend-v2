import { PrismaClient, ROLES } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding growth data for 4 months (Sep 2025 - Dec 2025)...\n');

  const now = new Date('2025-12-29');
  const months = [
    { month: 9, year: 2025, name: 'Sep 2025', projectCount: 4, investorCount: 3, userCount: 5 },
    { month: 10, year: 2025, name: 'Oct 2025', projectCount: 5, investorCount: 4, userCount: 4 },
    { month: 11, year: 2025, name: 'Nov 2025', projectCount: 3, investorCount: 5, userCount: 5 },
    { month: 12, year: 2025, name: 'Dec 2025', projectCount: 4, investorCount: 3, userCount: 3 },
  ];

  const existingCollector = await prisma.collector.findFirst();
  if (!existingCollector) {
    console.log('❌ No collector found. Please run main seed first.');
    return;
  }

  const existingFarmers = await prisma.farmer.findMany({ take: 3 });
  const existingLands = await prisma.land.findMany({ take: 3 });

  if (existingFarmers.length === 0 || existingLands.length === 0) {
    console.log('❌ No farmers or lands found. Please run main seed first.');
    return;
  }

  let totalProjects = 0;
  let totalInvestors = 0;
  let totalUsers = 0;

  for (const monthData of months) {
    console.log(`\n📅 ${monthData.name}:`);

    for (let i = 0; i < monthData.projectCount; i++) {
      const dayInMonth = Math.floor(Math.random() * 28) + 1;
      const createdAt = new Date(monthData.year, monthData.month - 1, dayInMonth, 10, 0, 0);

      const farmer = existingFarmers[i % existingFarmers.length];
      const land = existingLands[i % existingLands.length];

      const commodities = ['Rice', 'Coffee', 'Corn', 'Wheat', 'Soybean'];
      const commodity = commodities[Math.floor(Math.random() * commodities.length)];

      await prisma.project.create({
        data: {
          name: `${commodity} Project ${monthData.name} #${i + 1}`,
          collectorId: existingCollector.id,
          farmerId: farmer.id,
          landId: land.id,
          commodity: commodity,
          volume: Math.floor(Math.random() * 5000) + 2000,
          profitShare: Math.floor(Math.random() * 15) + 15,
          sendDate: new Date(monthData.year, monthData.month, 15),
          status: 'ACTIVE',
          createdAt: createdAt,
          updatedAt: createdAt,
        },
      });

      totalProjects++;
    }

    console.log(`   ✅ Projects: ${monthData.projectCount}`);

    for (let i = 0; i < monthData.investorCount; i++) {
      const dayInMonth = Math.floor(Math.random() * 28) + 1;
      const createdAt = new Date(monthData.year, monthData.month - 1, dayInMonth, 12, 0, 0);

      const walletNum = Math.floor(Math.random() * 1000000);
      await prisma.user.create({
        data: {
          walletAddress: `0x${walletNum.toString(16).padStart(40, '0')}`,
          role: ROLES.INVESTOR,
          balance: (Math.floor(Math.random() * 500000) + 100000).toString(),
          createdAt: createdAt,
          updatedAt: createdAt,
        },
      });

      totalInvestors++;
    }

    console.log(`   ✅ Investors: ${monthData.investorCount}`);

    for (let i = 0; i < monthData.userCount; i++) {
      const dayInMonth = Math.floor(Math.random() * 28) + 1;
      const createdAt = new Date(monthData.year, monthData.month - 1, dayInMonth, 14, 0, 0);

      const roles = [ROLES.INVESTOR, ROLES.COLLECTOR, ROLES.STAFF];
      const role = roles[Math.floor(Math.random() * roles.length)];

      const walletNum = Math.floor(Math.random() * 1000000);
      await prisma.user.create({
        data: {
          walletAddress: `0x${walletNum.toString(16).padStart(40, '0')}`,
          role: role,
          balance: (Math.floor(Math.random() * 300000) + 50000).toString(),
          createdAt: createdAt,
          updatedAt: createdAt,
        },
      });

      totalUsers++;
    }

    console.log(`   ✅ Users: ${monthData.userCount}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 Growth data seeding completed!');
  console.log('═'.repeat(60));
  console.log(`Total Projects Added: ${totalProjects}`);
  console.log(`Total Investors Added: ${totalInvestors}`);
  console.log(`Total Users Added: ${totalUsers}`);
  console.log('═'.repeat(60));
  console.log('\n📊 Data distributed across 4 months (Sep - Dec 2025)');
  console.log('✅ Ready for analytics API testing!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
