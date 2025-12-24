// index.ts
// Query your database using the Accelerate Client extension

import { PrismaClient } from './generated/prisma/client.js'
import { withAccelerate } from '@prisma/extension-accelerate'

const prisma = new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL ?? '',
}).$extends(withAccelerate())

// Example query to create a user based on the example schema

async function main() {
    try {
        const user = await prisma.user.create({
            data: {
                name: 'Alice',
                email: `alice-${Date.now()}@prisma.io`, // Unique email
            },
        })
        console.log(user)
    } catch (e) {
        if ((e as any).code === 'P2002') {
            console.log("User already exists, skipping creation");
            const existing = await prisma.user.findFirst({ where: { email: 'alice@prisma.io' } });
            console.log(existing);
        } else {
            throw e;
        }
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
