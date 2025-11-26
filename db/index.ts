import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL as string,
});

export const db = drizzle(pool, { schema });

// Seed initial data
export async function seedDatabase() {
  try {
    // Check if ingredients already exist
    const existingIngredients = await db.select().from(schema.ingredients).limit(1);
    if (existingIngredients.length === 0) {
      console.log('🌱 Seeding ingredients...');
      await db.insert(schema.ingredients).values([
        { name: 'Caffeine', category: 'Energy', dosageMin: '50', dosageMax: '200', unit: 'mg' },
        { name: 'L-Theanine', category: 'Focus', dosageMin: '100', dosageMax: '200', unit: 'mg' },
        { name: 'B-Complex', category: 'Energy', dosageMin: '1', dosageMax: '5', unit: 'caps' },
        { name: 'Ginseng', category: 'Energy', dosageMin: '200', dosageMax: '400', unit: 'mg' },
        { name: 'Magnesium', category: 'Sleep', dosageMin: '200', dosageMax: '400', unit: 'mg' },
        { name: 'Melatonin', category: 'Sleep', dosageMin: '0.5', dosageMax: '5', unit: 'mg' },
      ]);
    }

    // Check if flavors already exist
    const existingFlavors = await db.select().from(schema.flavors).limit(1);
    if (existingFlavors.length === 0) {
      console.log('🌱 Seeding flavors...');
      await db.insert(schema.flavors).values([
        { name: 'Mango', inStock: true },
        { name: 'Strawberry', inStock: true },
        { name: 'Watermelon', inStock: true },
        { name: 'Root Beer', inStock: true },
        { name: 'Lemonade', inStock: true },
        { name: 'Green Apple', inStock: true },
      ]);
    }

    // Check if trademark blacklist exists
    const existingBlacklist = await db.select().from(schema.trademarkBlacklist).limit(1);
    if (existingBlacklist.length === 0) {
      console.log('🌱 Seeding trademark blacklist...');
      await db.insert(schema.trademarkBlacklist).values([
        { keyword: 'Red Bull', reason: 'Registered trademark' },
        { keyword: 'Monster', reason: 'Registered trademark' },
        { keyword: '5-Hour Energy', reason: 'Registered trademark' },
        { keyword: 'Gatorade', reason: 'Registered trademark' },
        { keyword: 'Powerade', reason: 'Registered trademark' },
      ]);
    }

    console.log('✅ Database seeding complete!');
  } catch (error) {
    console.error('❌ Database seeding error:', error);
  }
}
