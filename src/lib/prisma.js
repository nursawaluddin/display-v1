const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');

let prisma;

if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient().$extends(withAccelerate());
} else {
    if (!global.prisma) {
        // Only extend if not already extended or handle singleton carefully.
        // Simplifying for dev:
        global.prisma = new PrismaClient().$extends(withAccelerate());
    }
    prisma = global.prisma;
}

module.exports = prisma;
