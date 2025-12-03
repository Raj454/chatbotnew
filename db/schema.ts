import { pgTable, varchar, text, timestamp, serial, boolean, decimal } from 'drizzle-orm/pg-core';

export const ingredients = pgTable('ingredients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  blend: varchar('blend', { length: 100 }).notNull(), // e.g., 'Craffteine® ENERGY+'
  category: varchar('category', { length: 50 }), // Optional category for filtering
  dosageMin: decimal('dosage_min', { precision: 10, scale: 2 }).notNull(),
  dosageMax: decimal('dosage_max', { precision: 10, scale: 2 }).notNull(),
  dosageSuggested: decimal('dosage_suggested', { precision: 10, scale: 2 }),
  unit: varchar('unit', { length: 20 }).default('mg'),
  description: text('description'),
  inStock: boolean('in_stock').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const blends = pgTable('blends', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayOrder: serial('display_order'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const flavors = pgTable('flavors', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  inStock: boolean('in_stock').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sweeteners = pgTable('sweeteners', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  inStock: boolean('in_stock').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const formulas = pgTable('formulas', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  shopifyCustomerId: varchar('shopify_customer_id', { length: 100 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  customerName: varchar('customer_name', { length: 255 }),
  goalComponent: varchar('goal_component', { length: 50 }),
  formatComponent: varchar('format_component', { length: 50 }),
  routineComponent: varchar('routine_component', { length: 50 }),
  lifestyleComponent: varchar('lifestyle_component', { length: 50 }),
  sensitivitiesComponent: varchar('sensitivities_component', { length: 255 }),
  currentSupplementsComponent: varchar('current_supplements_component', { length: 255 }),
  experienceComponent: varchar('experience_component', { length: 50 }),
  ingredientsComponent: text('ingredients_component'), // JSON string
  sweetnessComponent: varchar('sweetness_component', { length: 50 }),
  sweetenerComponent: varchar('sweetener_component', { length: 100 }),
  flavorsComponent: text('flavors_component'), // JSON string
  formulaNameComponent: varchar('formula_name_component', { length: 255 }),
  formulaData: text('formula_data'), // Full formula JSON
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const trademarkBlacklist = pgTable('trademark_blacklist', {
  id: serial('id').primaryKey(),
  keyword: varchar('keyword', { length: 255 }).notNull().unique(),
  reason: varchar('reason', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  description: varchar('description', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow(),
});
