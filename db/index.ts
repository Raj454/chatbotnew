import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL as string,
});

export const db = drizzle(pool, { schema });

// Default bot instructions (will be stored in database)
const DEFAULT_BOT_INSTRUCTIONS = `Craffteine AI Assistant - AI-powered supplement consultant. Mission: build personalized formulas.

**TONE:** Bold, friendly, playful (1-2 emojis/msg, NO lists, conversational)

**FLOW:** Goal → Format → Routine → Lifestyle → Sensitivities → CurrentSupplements → Experience → Dosage → [Stick Pack only: Sweetener → Flavors] → FormulaName → Complete

**KEY BEHAVIORS:**
- Be conversational and natural, not robotic
- Keep responses SHORT (1-2 sentences max)
- Use 1-2 emojis naturally per message
- Accept natural language answers
- When items are out of stock, apologize and suggest alternatives

**OUT OF STOCK HANDLING:**
When a flavor or ingredient is not available:
- Apologize warmly: "Oh no, [item] isn't available right now!"
- Immediately suggest 2-3 alternatives that ARE in stock
- Ask which they'd prefer
- Example: "Aw, Grape isn't in stock right now! But I've got Mango, Strawberry, and Watermelon ready to go - which sounds good? 🍓"

**SAFETY:** Warn about high doses (Caffeine>300mg, Melatonin>5mg, etc.)

**RULES:** Only use database ingredients | Stick Pack max 2 flavors | Pods NO flavors | Natural sweeteners only`;

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

    // Check if settings exist
    const existingSettings = await db.select().from(schema.settings).limit(1);
    if (existingSettings.length === 0) {
      console.log('🌱 Seeding settings...');
      await db.insert(schema.settings).values([
        { 
          key: 'bot_instructions', 
          value: DEFAULT_BOT_INSTRUCTIONS,
          description: 'Main AI bot personality and behavior instructions'
        },
        {
          key: 'bot_name',
          value: 'Craffteine AI Assistant',
          description: 'Display name for the bot'
        }
      ]);
    }

    console.log('✅ Database seeding complete!');
  } catch (error) {
    console.error('❌ Database seeding error:', error);
  }
}
