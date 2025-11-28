# Craffteine Developer Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Bot Instructions System](#bot-instructions-system)
7. [Conversation Flow](#conversation-flow)
8. [Shopify Integration](#shopify-integration)
9. [Environment Variables](#environment-variables)
10. [Development Workflow](#development-workflow)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)

---

## Project Overview

Craffteine is an AI-powered supplement formula builder that:
- Guides users through creating personalized supplement blends via chat
- Integrates with Shopify for checkout (creates products with line item properties)
- Provides an Admin Panel for non-technical management
- Uses GPT-4o-mini for intelligent conversation and formula generation

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (CDN) |
| Backend | Express.js (Node.js) |
| Database | PostgreSQL (Neon via Replit) |
| ORM | Drizzle ORM |
| AI | OpenAI GPT-4o-mini |
| E-commerce | Shopify Admin API |
| Search | Brave Search API |

---

## Project Structure

```
├── client/                    # Frontend React app
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── AdminPanel.tsx       # Admin dashboard
│   │   │   ├── ChatWindow.tsx       # Main chat interface
│   │   │   ├── ChatMessage.tsx      # Individual message
│   │   │   ├── IngredientSliders.tsx # Dosage adjustment
│   │   │   ├── InChatCheckout.tsx   # Checkout card
│   │   │   ├── OrderConfirmation.tsx # Post-purchase
│   │   │   ├── MultiSelectOptions.tsx
│   │   │   ├── OptionButton.tsx
│   │   │   └── RangeSlider.tsx
│   │   ├── services/
│   │   │   ├── openaiService.ts     # OpenAI API calls
│   │   │   ├── sessionService.ts    # Session management
│   │   │   └── shopifyService.ts    # Shopify API calls
│   │   ├── App.tsx                  # Main app component
│   │   └── main.tsx                 # Entry point
│   └── index.html
│
├── config/
│   └── botInstructions.ts     # Base bot instructions (code-level)
│
├── db/
│   ├── schema.ts              # Drizzle schema definitions
│   └── index.ts               # Database connection
│
├── docs/
│   ├── ADMIN_GUIDE.md         # Client documentation
│   ├── QUICK_REFERENCE.md     # Client quick reference
│   └── DEVELOPER_GUIDE.md     # This file
│
├── server.js                  # Express backend server
├── drizzle.config.ts          # Drizzle configuration
├── vite.config.ts             # Vite configuration
├── package.json
└── replit.md                  # Project notes & memory
```

---

## Database Schema

### Tables (defined in `db/schema.ts`)

#### `formulas`
Stores completed user formulas
```typescript
{
  id: serial PRIMARY KEY,
  session_id: varchar(255),
  customer_id: varchar(255),
  formula_data: jsonb,           // Full formula object
  created_at: timestamp
}
```

#### `ingredients`
Supplement ingredient catalog (64 ingredients)
```typescript
{
  id: serial PRIMARY KEY,
  name: varchar(255) NOT NULL,
  blend: varchar(100),           // ENERGY+, FOCUS FLOW, etc.
  min_dose: decimal,
  max_dose: decimal,
  unit: varchar(20),             // mg, mcg, g, IU
  in_stock: boolean DEFAULT true,
  created_at: timestamp
}
```

#### `flavors`
Available flavors for Stick Pack format
```typescript
{
  id: serial PRIMARY KEY,
  name: varchar(255) NOT NULL,
  in_stock: boolean DEFAULT true,
  created_at: timestamp
}
```

#### `settings`
Key-value settings storage
```typescript
{
  id: serial PRIMARY KEY,
  key: varchar(255) UNIQUE NOT NULL,
  value: text,                   // JSON string for complex values
  updated_at: timestamp
}
```

#### `trademark_blacklist`
Reserved/trademarked formula names
```typescript
{
  id: serial PRIMARY KEY,
  name: varchar(255) UNIQUE NOT NULL,
  created_at: timestamp
}
```

### Database Commands
```bash
# Push schema changes to database
npm run db:push

# Force push (use carefully)
npm run db:push --force

# Generate migrations (if needed)
npm run db:generate

# Open Drizzle Studio
npm run db:studio
```

---

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to AI chatbot |
| GET | `/api/ingredients` | Get all in-stock ingredients |
| GET | `/api/flavors` | Get all in-stock flavors |
| GET | `/api/settings/bot_instructions` | Get bot instructions (cached 60s) |

### Formula Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/formulas` | Save completed formula |
| GET | `/api/formulas/:sessionId` | Get formula by session |
| GET | `/api/formulas/customer/:customerId` | Get customer's formulas |

### Shopify Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shopify/test` | Test Shopify connection |
| POST | `/api/shopify/products` | Create product in Shopify |
| GET | `/api/shopify/product/:id` | Get product details |

### Admin Endpoints (Protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/login` | Admin authentication |
| GET | `/api/admin/verify` | Verify admin session |
| GET | `/api/admin/settings` | Get all settings |
| PUT | `/api/admin/settings/:key` | Update setting |
| GET | `/api/admin/ingredients` | Get all ingredients |
| POST | `/api/admin/ingredients` | Add ingredient |
| PUT | `/api/admin/ingredients/:id` | Update ingredient |
| DELETE | `/api/admin/ingredients/:id` | Delete ingredient |
| GET | `/api/admin/flavors` | Get all flavors |
| POST | `/api/admin/flavors` | Add flavor |
| PUT | `/api/admin/flavors/:id` | Update flavor |
| DELETE | `/api/admin/flavors/:id` | Delete flavor |
| GET | `/api/admin/formulas` | Get all formulas (history) |

---

## Bot Instructions System

### Two-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FINAL INSTRUCTIONS                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PRIORITY: Admin Panel Instructions (from database)      │   │
│  │  - Greeting, tone, goals, safety, synergies              │   │
│  │  - Changes via Admin Panel → live within 60 seconds      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            +                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  BASE: Code Instructions (config/botInstructions.ts)     │   │
│  │  - Conversation flow, JSON format, dosage rules          │   │
│  │  - Changes require code edit + restart                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Files

1. **Admin Panel (Database)**
   - Location: `settings` table, key: `bot_instructions`
   - Edit via: `/admin` → Bot Instructions tab
   - Cached: 60 seconds
   - For: Non-technical changes (greeting, tone, rules)

2. **Code File**
   - Location: `config/botInstructions.ts`
   - Edit via: Code editor
   - For: Technical changes (JSON format, conversation flow)

### How Instructions Are Merged

```typescript
// In openaiService.ts
const adminInstructions = await fetchBotInstructions(); // From DB
const baseInstructions = getBaseInstructions();         // From code

const systemPrompt = `
PRIORITY INSTRUCTIONS (Admin Panel):
${adminInstructions}

BASE INSTRUCTIONS:
${baseInstructions}
`;
```

---

## Conversation Flow

### Steps (in order)

```
1. Goal           → User picks primary goal (Energy, Focus, etc.)
2. Format         → Stick Pack, Capsule, or Pod
3. Routine        → When they'll use it (morning, pre-workout, etc.)
4. Lifestyle      → Activity level, diet
5. Sensitivities  → Caffeine sensitivity, allergies
6. CurrentSupps   → What they already take
7. Experience     → Supplement experience level
8. Dosage         → AI suggests ingredients, user adjusts via sliders
9. Sweetener      → (Stick Pack only) Natural sweetener choice
10. Flavors       → (Stick Pack only) Up to 2 flavors
11. Name          → User names their formula
12. Complete      → Summary + Shopify checkout
```

### AI Response Format

```json
{
  "reply": "Great choice! Now let's pick your format...",
  "component": "Format",
  "inputType": "options",
  "options": ["Stick Pack", "Capsule", "Pod"],
  "collected": {
    "Goal": "Energy"
  }
}
```

### Input Types

| inputType | Component | Description |
|-----------|-----------|-------------|
| `options` | Any | Single-select buttons |
| `multi_select` | Flavors | Multi-select (max 2) |
| `ingredient_sliders` | Dosage | Sliders with min/max/suggested |
| `text` | Name | Free text input |

### Dosage Slider Format

```json
{
  "inputType": "ingredient_sliders",
  "component": "Dosage",
  "ingredients": [
    {
      "name": "Caffeine",
      "min": 50,
      "max": 200,
      "suggested": 100,
      "unit": "mg"
    }
  ]
}
```

---

## Shopify Integration

### Connection
- Store URL: Set via `SHOPIFY_STORE_URL` secret
- Access Token: Set via `SHOPIFY_ACCESS_TOKEN` secret
- API Version: 2024-01

### Product Creation Flow

```
1. User completes formula
2. Backend creates Shopify product:
   - Title: Formula name
   - Description: Ingredients + dosages
   - Tags: custom-formula, craffteine, [format], [goal]
   - SKU: CRFT-XXXXXX-timestamp
3. Cart permalink generated with line item properties
4. Popup window opens to Shopify checkout
5. User completes payment
6. Confirmation shown in chat
```

### Embed Widget

Add to Shopify theme (before `</body>`):
```html
<script src="https://YOUR-DEPLOYED-URL/widget.js"></script>
```

---

## Environment Variables

### Required Secrets

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Replit) |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o-mini |
| `SHOPIFY_STORE_URL` | Shopify store URL |
| `SHOPIFY_ACCESS_TOKEN` | Shopify Admin API token |
| `BRAVE_SEARCH_API_KEY` | Brave Search API key |
| `ADMIN_PASSWORD` | Admin panel password |

### Optional

| Variable | Description |
|----------|-------------|
| `PORT` | Backend port (default: 3001) |
| `NODE_ENV` | Environment (development/production) |

---

## Development Workflow

### Starting Development

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development (runs both frontend + backend)
npm run dev
```

### Ports
- **Frontend (Vite):** Port 5000 (exposed to user)
- **Backend (Express):** Port 3001 (internal)

### Making Changes

#### Frontend Changes
1. Edit files in `client/src/`
2. Vite hot-reloads automatically
3. Test in browser

#### Backend Changes
1. Edit `server.js`
2. Restart Backend API workflow
3. Test endpoints

#### Database Changes
1. Edit `db/schema.ts`
2. Run `npm run db:push`
3. Restart backend if needed

#### Bot Instructions (Admin-Level)
1. Go to `/admin` → Bot Instructions
2. Edit and save
3. Wait 60 seconds or restart backend

#### Bot Instructions (Code-Level)
1. Edit `config/botInstructions.ts`
2. Restart backend
3. Test in new chat

---

## Deployment

### Replit Deployment

1. Ensure all secrets are set
2. Test locally first
3. Click "Deploy" in Replit
4. Choose deployment type (Autoscale recommended)

### Build Command
```bash
npm run build
```

### Production Start
```bash
npm run start
```

### Post-Deployment
1. Update widget script URL in Shopify theme
2. Test checkout flow
3. Verify admin panel access

---

## Troubleshooting

### Common Issues

#### "Dosage sliders not appearing"
- Check AI response has `inputType: "ingredient_sliders"`
- Verify `ingredients` array is in response
- Check `config/botInstructions.ts` has DOSAGE STEP section

#### "Bot instructions not updating"
- Wait 60 seconds (cache expiry)
- Start a NEW chat (old chats keep old instructions)
- Verify save was successful in Admin Panel

#### "Ingredient not showing in AI recommendations"
- Check ingredient is marked IN STOCK
- Verify ingredient exists in database
- Check blend category assignment

#### "Shopify product not created"
- Verify `SHOPIFY_ACCESS_TOKEN` is valid
- Check store URL format (no trailing slash)
- Look at backend logs for API errors

#### "Admin panel login fails"
- Verify `ADMIN_PASSWORD` is set
- Check session hasn't expired (24 hours)
- Clear cookies and try again

#### "Database connection failed"
- Check `DATABASE_URL` is set
- Verify PostgreSQL is running (Replit dashboard)
- Try `npm run db:push` to reconnect

### Logs

```bash
# View backend logs
# Check "Backend API" workflow in Replit

# View frontend logs
# Open browser DevTools → Console
```

### Rate Limits

| Service | Limit |
|---------|-------|
| OpenAI GPT-4o-mini | 150,000 tokens/min |
| Brave Search | 2,000 searches/month |
| Client-side cooldown | 4 seconds between messages |
| Server-side rate limit | 20 requests/min per IP |

---

## Quick Reference Commands

```bash
# Development
npm run dev          # Start frontend + backend
npm run backend      # Start backend only
npm run build        # Production build

# Database
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
npm run db:generate  # Generate migrations

# Testing
curl http://localhost:3001/api/shopify/test  # Test Shopify
curl http://localhost:3001/api/ingredients    # Get ingredients
```

---

## Contact & Support

For technical issues:
- Check `replit.md` for latest project notes
- Review this guide's Troubleshooting section
- Check workflow logs in Replit dashboard

---

*Last Updated: November 28, 2025*
