import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inserting test story for Jane Doe...');
  
  // Find Jane Doe user
  const jane = await prisma.user.findUnique({
    where: { email: 'friend@example.com' },
  });

  if (!jane) {
    throw new Error('Jane Doe user not found! Run create-test-user.ts first.');
  }

  // Create an active text story
  const story = await prisma.story.create({
    data: {
      userId: jane.id,
      type: 'TEXT',
      bgColor: 'linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%)',
      fontStyle: 'font-story-cursive',
      caption: 'Hey there! How do you like my new story updates? Swipe up to reply!',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });

  console.log('Successfully created test story for Jane Doe:', story);
}

main()
  .catch((e) => {
    console.error('Error creating friend story:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
