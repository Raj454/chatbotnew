# Craffteine AI Formula Builder - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Frontend Structure](#frontend-structure)
4. [Backend Structure](#backend-structure)
5. [Database Schema](#database-schema)
6. [AI System Instructions](#ai-system-instructions)
7. [Conversation Flow](#conversation-flow)
8. [Function Calling System](#function-calling-system)
9. [Data Flow & Processing](#data-flow--processing)
10. [API Endpoints](#api-endpoints)
11. [Shopify Integration](#shopify-integration)
12. [Deployment](#deployment)
13. [Configuration & Environment Variables](#configuration--environment-variables)

---

## Project Overview

### What is Craffteine?
Craffteine is an AI-powered supplement formula builder that guides users through creating personalized energy supplement blends in a natural, conversational way. The bot can be embedded into Shopify stores as an interactive product configurator.

### Key Features
- **AI-Powered Conversations** - Uses GPT-4o-mini for intelligent, natural dialogue
- **Guided Configuration** - Strict workflow ensures all required information is collected
- **Off-Topic Handling** - Can answer random questions (weather, news, math) without losing context
- **Personalized Dosages** - Suggests ingredient amounts based on user profile
- **Safety Checks** - Warns about dangerous ingredient combinations
- **Database Persistence** - Saves formulas to PostgreSQL
- **Shopify Integration** - Seamless embedding and data passing to Shopify

---

## Architecture

### Tech Stack
```
Frontend:
├─ React 18 (UI framework)
├─ TypeScript (type safety)
├─ Vite (build tool & dev server)
├─ Tailwind CSS (styling)
└─ OpenAI API (GPT-4o-mini)

Backend:
├─ Node.js (runtime)
├─ Express (web framework)
├─ Drizzle ORM (database)
├─ Brave Search API (web search)
└─ PostgreSQL (database)
```

### System Architecture Diagram
```
┌─────────────────────────────────────────┐
│         Shopify Store (iframe)          │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼────────┐
        │  React Frontend │
        │   (Port 5000)   │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
OpenAI API  Express Backend  PostgreSQL
(GPT-4o)    (Port 3001)      Database
             │
      ┌──────┼──────┐
      ▼             ▼
  Brave API    Database ORM
  (Search)    (Drizzle)
```

---

## Frontend Structure

### Component Hierarchy
```
App.tsx (Main component - manages conversation state)
├── Header
│   ├── Logo (Craffteine branding)
│   └── New Chat Button (when chat started)
├── Landing Page (initial screen)
│   ├── Icon
│   ├── Headline
│   ├── Description
│   └── Start Chat Button
└── ChatWindow.tsx (active conversation)
    ├── Message List (Bot & User messages)
    ├── Input Handler (buttons, sliders, text input)
    └── Selection Processing
```

### Key Files

#### `App.tsx` - Main Application Component
**Responsibilities:**
- Manages conversation state (messages, formula, typing status)
- Handles user selections and API calls to OpenAI
- Implements rate limiting (4-second cooldown between messages)
- Normalizes user input to structured values
- Saves formulas to database
- Manages session data

**Key Functions:**
- `normalizeValue()` - Converts casual user responses to structured data
- `handleStart()` - Initializes new conversation
- `handleSelection()` - Processes user input and calls AI

**State Management:**
```typescript
{
  messages: Message[],           // Chat history
  isTyping: boolean,              // AI is generating response
  hasStarted: boolean,            // Chat has begun
  formula: Formula,               // Collected user selections
  proceedUrl: string | null,      // Checkout URL
  cooldownRemainingMs: number     // Rate limit timer
}
```

#### `ChatWindow.tsx` - Chat Display Component
**Responsibilities:**
- Renders all messages (bot and user)
- Shows different input types based on bot response
- Handles button clicks, slider adjustments, text input
- Displays loading states

**Input Types:**
- `buttons` - Multiple choice selections
- `slider` - Dosage amount selection
- `text` - Free-form user input (for off-topic questions)

#### Message Types
```typescript
interface Message {
  id: string,
  sender: 'bot' | 'user',
  text: string,
  inputType?: string,              // 'buttons' | 'slider' | 'text'
  component?: string,              // Current step: 'Goal', 'Format', etc.
  options?: string[],              // Button options
  sliderConfig?: {                 // Slider configuration
    min: number,
    max: number,
    step: number
  },
  ingredients?: Ingredient[],      // For dosage step
  isComplete?: boolean,            // Formula finished
  formulaSummary?: FormulaSummary  // Final summary
}
```

### Natural Language Processing

The bot understands casual user responses and converts them to structured values:

```typescript
// Input: "energy boost in the morning"
// Output: Goal = "Energy", Routine = "Morning"

Case 'Goal':
  "energy", "tired", "coffee" → "Energy"
  "focus", "concentrate" → "Focus"
  "hydration", "water" → "Hydration"
  "sleep", "rest", "bed" → "Sleep"
  "recover", "gym", "workout" → "Recovery"

Case 'Format':
  "powder", "stick", "packet" → "Stick Pack"
  "pill", "capsule", "tablet" → "Capsule"
  "pod" → "Pod"

Case 'Routine':
  "morning", "breakfast" → "Morning"
  "afternoon", "lunch" → "Afternoon"
  "evening", "night" → "Evening"
  "all day" → "All day"

Case 'Lifestyle':
  "active", "gym", "athlete" → "Active"
  "desk", "office", "sedentary" → "Sedentary"
  "moderate", "sometimes" → "Moderate"
```

---

## Backend Structure

### Express Server (`server.js`)

**Port:** 3001 (internal) - proxied through frontend

**Key Middleware:**
- CORS - Allow cross-origin requests
- JSON parsing - Handle JSON request bodies
- Rate limiting - 20 requests per minute per IP
- Static file serving - Serve built frontend

### API Endpoints

#### 1. Web Search
```
GET /api/search?q={query}

Purpose: Search the web for off-topic questions
Auth: Rate limited (20/min per IP)
Response:
{
  "success": true,
  "data": "1. Title\n   Description\n\n2. Title\n   Description"
}
```

#### 2. Get Ingredients
```
GET /api/ingredients

Purpose: Return all available ingredients with dosage info
Response:
{
  "success": true,
  "ingredients": [
    {
      "id": 1,
      "name": "Caffeine",
      "min": 50,
      "max": 300,
      "unit": "mg",
      "blends": ["Energy", "Focus"]
    }
  ]
}
```

#### 3. Get Formulas
```
GET /api/formulas?sessionId={id}

Purpose: Retrieve saved formulas for a session
Response:
{
  "success": true,
  "formulas": [
    {
      "id": 1,
      "sessionId": "...",
      "goalComponent": "Energy",
      "formatComponent": "Stick Pack",
      "formulaData": {...}
    }
  ]
}
```

#### 4. Save Formula
```
POST /api/formulas

Purpose: Save a completed formula to database
Body:
{
  "sessionId": "...",
  "shopifyCustomerId": "...",
  "goalComponent": "Energy",
  "formatComponent": "Stick Pack",
  ...all formula fields
}
Response: { "success": true, "id": 123 }
```

#### 5. Get Flavors
```
GET /api/flavors

Purpose: Return available flavor options
Response:
{
  "success": true,
  "flavors": ["Mango", "Watermelon", "Strawberry", ...]
}
```

---

## Database Schema

### Tables

#### `ingredients`
```sql
CREATE TABLE ingredients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) UNIQUE NOT NULL,     -- "Caffeine", "Taurine", etc.
  blend VARCHAR(100) NOT NULL,           -- "Energy", "Focus", "Recovery"
  min INT NOT NULL,                      -- Minimum dosage
  max INT NOT NULL,                      -- Maximum dosage
  unit VARCHAR(20) NOT NULL,             -- "mg", "IU", "g"
  description TEXT,
  safety_note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

Examples:
- id: 1, name: "Caffeine", blend: "Energy", min: 50, max: 300, unit: "mg"
- id: 2, name: "L-Theanine", blend: "Energy", min: 100, max: 200, unit: "mg"
```

#### `flavors`
```sql
CREATE TABLE flavors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50),                  -- "Fruit", "Candy", "Classic"
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

Examples:
- Mango, Watermelon, Strawberry Banana, Sour Cherry, etc.
```

#### `formulas`
```sql
CREATE TABLE formulas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(255) NOT NULL,
  shopify_customer_id VARCHAR(255),
  goal_component VARCHAR(100),
  format_component VARCHAR(100),
  routine_component VARCHAR(100),
  lifestyle_component VARCHAR(100),
  sensitivities_component TEXT,
  current_supplements_component TEXT,
  experience_component VARCHAR(100),
  ingredients_component TEXT,             -- JSON stringified
  sweetness_component VARCHAR(100),
  sweetener_component VARCHAR(100),
  flavors_component TEXT,                 -- JSON stringified
  formula_name_component VARCHAR(255),
  formula_data LONGTEXT,                  -- Full formula as JSON
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### `trademark_blacklist`
```sql
CREATE TABLE trademark_blacklist (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) UNIQUE NOT NULL,     -- Trademarked names to avoid
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## AI System Instructions

### System Prompt (Sent to GPT-4o-mini)

The AI receives detailed instructions that include:

#### 1. Identity & Personality
```
"Craffteine AI Assistant - AI-powered supplement consultant.
Mission: Build personalized formulas.
Tone: Bold, friendly, playful (1-2 emojis per message, NO lists)"
```

#### 2. Conversation Flow
```
Goal → Format → Routine → Lifestyle → Sensitivities → CurrentSupplements 
→ Experience → Dosage → [Stick Pack: Sweetener → Flavors] → FormulaName → Complete
```

#### 3. Function Calling Rules
The AI can call these functions for off-topic questions:
```
- getCurrentTime() → "what time is it?"
- getCurrentDate() → "what's the date?"
- getWeather(location) → "what's the weather?"
- calculate(expression) → "what's 25 * 4?"
- searchWeb(query) → news, facts, general knowledge
```

**Protocol for off-topic:**
1. Call appropriate function
2. For searchWeb: **Include FULL search results** in response
3. For others: Answer briefly (1 sentence)
4. **Return to SAME component** (never advance)

#### 4. Ingredient Database
The AI receives the complete list of available ingredients:
```
Energy: Caffeine 50-300mg, L-Theanine 100-200mg, Beta-Alanine 3-5g, ...
Focus: Caffeine 50-300mg, L-Theanine 100-200mg, Alpha-GPC 300-600mg, ...
Recovery: BCAAs 5-10g, Creatine 3-5g, L-Glutamine 5-10g, ...
```

#### 5. Dosage Personalization
```
Beginner/Sedentary:    40-60% of maximum
Moderate/Active:       60-80% of maximum
Experienced/Athlete:   80-100% of maximum
Caffeine-sensitive:    30-50% of maximum
```

#### 6. Safety Rules
```
Warn if:
- Caffeine > 300mg
- Taurine > 2000mg
- Zinc > 40mg
- Vitamin D3 > 4000 IU
- Melatonin > 5mg
- Protein > 50g
- Fiber > 15g
```

#### 7. Format Constraints
```
Stick Pack:
  - Single-serve powder
  - Maximum 2 flavors
  - Consider dry weight and solubility
  - Suggest total grams and per-serve volume

Capsule:
  - Dry fill format
  - Max ~800mg per capsule
  - Note if multiple units per serving required
  - Consider realistic serving size

Pod:
  - Concentrated liquid or soluble puck
  - NO flavors allowed
  - Consider solubility and volume
```

#### 8. Response Format
```
JSON Structure (Always):
{
  "text": "Message to show user",
  "inputType": "buttons" | "slider" | "text",
  "component": "Goal" | "Format" | etc.,
  "options": ["Option 1", "Option 2"] or null,
  "sliderConfig": {
    "min": 0,
    "max": 100,
    "step": 5
  } or null,
  "ingredients": [
    {
      "name": "Caffeine",
      "suggested": 150,
      "min": 50,
      "max": 300,
      "unit": "mg"
    }
  ] or null,
  "isComplete": false,
  "formulaSummary": {
    "goal": "Energy",
    "format": "Stick Pack",
    ...all components
  } or null
}
```

---

## Conversation Flow

### Step-by-Step Breakdown

#### 1. Goal Selection
**Bot Message:** "Let's create your perfect wellness formula! 💜✨ What's your main goal - Energy, Focus, Hydration, Sleep, or Recovery?"

**User Options:**
- Energy
- Focus
- Hydration
- Sleep
- Recovery

**Backend Action:** Saves to `formula.Goal`

---

#### 2. Format Selection
**Bot Message:** "Nice! How would you like your formula - Stick Packs (powder), Capsules (pills), or Pods?"

**User Options:**
- Stick Pack
- Capsule
- Pod

**Backend Action:** Saves to `formula.Format`

---

#### 3. Routine Selection
**Bot Message:** "When do you usually need that [Goal] - morning, afternoon, evening, or all day?"

**User Options:**
- Morning
- Afternoon
- Evening
- All day

**Backend Action:** Saves to `formula.Routine`

---

#### 4. Lifestyle Assessment
**Bot Message:** "Are you pretty active, or more of a desk job kind of person?"

**User Options:**
- Sedentary (desk job)
- Moderate (mix of both)
- Active (gym, sports)

**Backend Action:** Saves to `formula.Lifestyle` + Affects dosage calculations

---

#### 5. Sensitivities Check
**Bot Message:** "Any sensitivities or allergies I should know about?"

**User Input:** Free text
**Options if they say no:**
- No sensitivities
- Caffeine sensitive
- Other [free text]

**Backend Action:** Saves to `formula.Sensitivities` + Used for ingredient filtering

---

#### 6. Current Supplements
**Bot Message:** "What supplements are you currently taking, if any?"

**User Input:** Free text (e.g., "Multivitamin and Vitamin D")

**Backend Action:** Saves to `formula.CurrentSupplements` + Used to avoid conflicts

---

#### 7. Experience Level
**Bot Message:** "How experienced are you with supplements?"

**User Options:**
- Beginner (never or rarely take)
- Intermediate (take some regularly)
- Advanced (regular user, know what works)

**Backend Action:** Saves to `formula.Experience` + Affects dosage levels

---

#### 8. Dosage Selection
**Bot Message:** "Here are your ingredients with suggested dosages for your profile 💪"

**Displays:**
- Interactive sliders for each ingredient
- Suggested value based on experience + lifestyle
- Min/max ranges

**User Action:** Adjusts each ingredient with slider

**Backend Action:** Saves to `formula.Dosage` as JSON map

---

#### 9. Sweetener Selection (Stick Pack Only)
**Bot Message:** "Which natural sweetener do you prefer?"

**User Options:**
- Stevia
- Monk Fruit
- Allulose
- Erythritol

**Backend Action:** Saves to `formula.Sweetener`

---

#### 10. Flavor Selection (Stick Pack Only)
**Bot Message:** "Pick up to 2 flavors for your blend 🍓"

**User Options:**
- Mango
- Watermelon
- Strawberry Banana
- Sour Cherry
- And 15+ more...

**Backend Action:** Saves to `formula.Flavors`

---

#### 11. Formula Naming
**Bot Message:** "What should we call your custom blend?"

**User Input:** Free text
**Example:** "Morning Energy Boost", "My Focus Formula"

**Backend Action:** Saves to `formula.FormulaName`

---

#### 12. Completion & Checkout
**Bot Message:** "Here's your custom formula! 🎉 [Summary] Ready to checkout?"

**Displays:**
- Full formula summary
- All ingredients with dosages
- Proceeding to Shopify link

**Backend Action:**
1. Saves complete formula to database
2. Creates checkout URL with all parameters
3. Displays "Add to Cart" button

---

## Function Calling System

### How Off-Topic Questions Work

#### Scenario: User Asks "What's the weather?"

**Step 1: AI Detection**
```
User: "What's the weather in New York?"
AI recognizes: Off-topic question → Need to call function
```

**Step 2: Function Call**
```
AI generates function call:
{
  "name": "getWeather",
  "arguments": {
    "location": "New York"
  }
}
```

**Step 3: Frontend Execution**
```typescript
// In utils/tools.ts
export const getWeather = async (location) => {
  // This would call a weather API
  // For now, returns cached data
  return {
    success: true,
    data: "70°F, Partly Cloudy"
  }
}
```

**Step 4: Result Back to AI**
```
Frontend sends function result to OpenAI:
{
  "role": "function",
  "name": "getWeather",
  "content": "70°F, Partly Cloudy"
}
```

**Step 5: AI Response with Context**
```
AI then responds:
{
  "text": "It's 70°F and partly cloudy in New York! ☀️
           Now, back to your formula - are you pretty active or more of a desk job person?",
  "component": "Lifestyle",  // ← Same as before!
  "inputType": "buttons",
  "options": ["Sedentary", "Moderate", "Active"]
}
```

**Key Point:** The component stays the same - conversation never loses track!

### Function Types & Behavior

| Function | Type | Response | Example |
|----------|------|----------|---------|
| `getCurrentTime` | Quick | "3:45 PM" | "What time is it?" |
| `getCurrentDate` | Quick | "Monday, Nov 24, 2025" | "What's today?" |
| `getWeather` | Quick | "70°F, Sunny" | "What's the weather?" |
| `calculate` | Quick | "100" | "What's 25 * 4?" |
| `searchWeb` | Full | [Full search results] | "What's the news?" |

**Important:** Only `searchWeb` returns full results. Others get 1-sentence answers.

---

## Data Flow & Processing

### Complete User Journey

```
1. USER STARTS CHAT
   ├─ Frontend: setHasStarted(true)
   ├─ Frontend: Call getNextStep(OPENAI_API_KEY, [], {})
   ├─ Backend: OpenAI returns first question
   └─ UI: Display question with input options

2. USER SELECTS OPTION
   ├─ Frontend: Normalize user value (e.g., "energy" → "Energy")
   ├─ Frontend: Create user message object
   ├─ Frontend: Add to messages array
   ├─ Frontend: Update formula state
   ├─ Rate Limiter: Check 4-second cooldown
   └─ Continue to next step

3. SEND TO OPENAI
   ├─ Frontend: Call getNextStep(OPENAI_API_KEY, messages, formula)
   │
   └─ Backend: services/openaiService.ts
      ├─ Prepare message history with system prompt
      ├─ Include current formula state
      ├─ Send to OpenAI API
      ├─ Wait for response
      └─ Return structured JSON response

4. OPENAI DECISION TREE
   ├─ Is question off-topic?
   │  ├─ YES: Call appropriate function
   │  │   ├─ Collect function result
   │  │   ├─ Answer question briefly
   │  │   └─ Return to SAME component
   │  │
   │  └─ NO: Process next component
   │      ├─ Extract from formula
   │      ├─ Generate question
   │      └─ Return inputType + options
   │
   └─ Is formula complete?
      ├─ YES: Generate summary → send to Shopify
      └─ NO: Continue to next component

5. FRONTEND UPDATES
   ├─ Parse JSON response
   ├─ Extract text, inputType, component
   ├─ Display to user with appropriate UI
   └─ Wait for next input

6. DATABASE OPERATIONS
   ├─ Formula state saved automatically
   └─ When complete: Full formula saved to PostgreSQL
      ├─ Table: formulas
      ├─ Includes: session_id, all components, formula_data JSON
      └─ Retrieval: By sessionId or shopifyCustomerId

7. CHECKOUT PROCESS
   ├─ Generate URL with query parameters
   ├─ Create link to Shopify product page
   ├─ Pass all formula data as URL params
   └─ User clicks → Shopify page loads with pre-selected options
```

### Message Format Example

```typescript
// User sends: "energy boost"
// App normalizes to: "Energy"

Message sent to OpenAI:
{
  role: "user",
  content: "The user selected: Energy"
}

Current Formula State:
{
  Goal: "Energy"
}

System Prompt includes:
- All available ingredients
- Safety rules
- Dosage guidelines
- Current step logic

OpenAI Response:
{
  text: "Awesome! Energy it is! 💪 How would you like your formula - 
         Stick Packs (powder), Capsules (pills), or Pods?",
  inputType: "buttons",
  component: "Format",
  options: ["Stick Pack", "Capsule", "Pod"],
  isComplete: false
}

Frontend displays:
┌─────────────────────────────────────────┐
│ Awesome! Energy it is! 💪 How would      │
│ you like your formula - Stick Packs    │
│ (powder), Capsules (pills), or Pods?   │
│                                         │
│ [ Stick Pack ] [ Capsule ] [ Pod ]      │
└─────────────────────────────────────────┘
```

---

## API Endpoints (Detailed)

### 1. POST /api/chat
**Frontend → Backend: Send message & get AI response**

```javascript
Request Body:
{
  "messages": [
    { "id": "msg1", "sender": "user", "text": "Energy" },
    { "id": "msg2", "sender": "bot", "text": "What format?" }
  ],
  "formula": {
    "Goal": "Energy",
    "Format": "Stick Pack"
  }
}

Response:
{
  "id": "msg3",
  "sender": "bot",
  "text": "Great! When do you need it?",
  "inputType": "buttons",
  "component": "Routine",
  "options": ["Morning", "Afternoon", "Evening", "All day"]
}
```

### 2. GET /api/search
**Frontend → Backend: Web search for off-topic questions**

```javascript
Request: GET /api/search?q=news%20today%20in%20US

Response:
{
  "success": true,
  "data": "1. Breaking News Title\n   Short description of the article\n\n
           2. Another News Title\n   Description here\n\n
           3. Third News Item\n   Description"
}
```

### 3. POST /api/formulas
**Frontend → Backend: Save completed formula to database**

```javascript
Request Body:
{
  "sessionId": "session_123abc",
  "shopifyCustomerId": "gid://shopify/Customer/123",
  "goalComponent": "Energy",
  "formatComponent": "Stick Pack",
  "routineComponent": "Morning",
  "lifestyleComponent": "Moderate",
  "sensitivitiesComponent": "None",
  "currentSupplementsComponent": "Multivitamin",
  "experienceComponent": "Intermediate",
  "ingredientsComponent": "Caffeine, L-Theanine",
  "sweetnessComponent": "Medium",
  "sweetenerComponent": "Stevia",
  "flavorsComponent": ["Mango", "Watermelon"],
  "formulaNameComponent": "Morning Energy Blend",
  "formulaData": { ...complete formula object }
}

Response:
{
  "success": true,
  "id": 42
}
```

### 4. GET /api/formulas
**Frontend → Backend: Retrieve user's saved formulas**

```javascript
Request: GET /api/formulas?sessionId=session_123abc

Response:
{
  "success": true,
  "formulas": [
    {
      "id": 42,
      "sessionId": "session_123abc",
      "goalComponent": "Energy",
      "formatComponent": "Stick Pack",
      "formulaData": { ...full formula },
      "createdAt": "2025-11-24T15:30:00Z"
    }
  ]
}
```

### 5. GET /api/ingredients
**Frontend → Backend: Get all available ingredients**

```javascript
Response:
{
  "success": true,
  "ingredients": [
    {
      "id": 1,
      "name": "Caffeine",
      "blend": "Energy",
      "min": 50,
      "max": 300,
      "unit": "mg",
      "description": "Central nervous system stimulant"
    },
    {
      "id": 2,
      "name": "L-Theanine",
      "blend": "Energy",
      "min": 100,
      "max": 200,
      "unit": "mg",
      "description": "Promotes calm focus"
    }
  ]
}
```

---

## Shopify Integration

### Embedding Methods

#### Method 1: Full-Page Embed (Recommended)
```html
<!-- In Shopify Pages → Show HTML -->
<div style="width: 100%; max-width: 1200px; margin: 0 auto; padding: 20px;">
    <iframe 
        src="https://your-replit-app.replit.dev?embed=true&theme=light"
        width="100%"
        height="750"
        frameborder="0"
        allow="clipboard-write"
        style="border: none; border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);"
    ></iframe>
</div>
```

#### Method 2: Widget Loader (Fixed Chat Bubble)
```html
<!-- In Shopify store footer or theme -->
<script src="https://your-replit-app.replit.dev/widget-loader.js"></script>
```

Creates a fixed chat bubble in bottom-right corner of store.

### Data Flow to Shopify

**Step 1: Formula Completion**
```
User completes all steps → Formula object ready
```

**Step 2: URL Generation**
```typescript
const queryParams = new URLSearchParams();
Object.entries(finalFormula).forEach(([key, val]) => {
  if (key === 'Dosage') {
    // Parse dosage object and create ingredient_* params
    const dosageMap = JSON.parse(val);
    Object.entries(dosageMap).forEach(([ingredientName, dosage]) => {
      queryParams.append(`ingredient_${ingredientName}`, `${dosage}mg`);
    });
  } else {
    queryParams.append(key, val);
  }
});

// Result: ?Goal=Energy&Format=Stick+Pack&...&ingredient_Caffeine=150mg
```

**Step 3: Redirect to Shopify**
```
Button: "Proceed to Checkout"
URL: https://crafftein.myshopify.com/products/customize-crafttein-formula?Goal=Energy&Format=Stick+Pack&...
```

**Step 4: Shopify Product Page**
```
Shopify reads URL parameters and:
1. Pre-selects the chosen format
2. Pre-fills ingredient selections
3. Shows total dosages
4. Calculates pricing
5. User proceeds to checkout
```

---

## Deployment

### Development Environment
```bash
# Terminal 1: Start Backend
npm run backend          # Runs on Port 3001

# Terminal 2: Start Frontend  
npm run dev            # Runs on Port 5000 (exposed via proxy)
```

### Production Deployment (Render/Replit)

```bash
# Build frontend
npm run build           # Creates dist/ folder

# Run backend (serves frontend from dist/)
npm start              # Backend runs on port specified by PORT env var
```

**Deployment Checklist:**
- [ ] Set `VITE_OPENAI_API_KEY` secret
- [ ] Set `BRAVE_SEARCH_API_KEY` secret
- [ ] Set `DATABASE_URL` for PostgreSQL
- [ ] Set `SESSION_SECRET` for sessions
- [ ] Build frontend (`npm run build`)
- [ ] Start backend (`npm start`)
- [ ] Test web search functionality
- [ ] Test database save/retrieve
- [ ] Generate Shopify embed code with deployment URL

---

## Configuration & Environment Variables

### Required Secrets

```bash
# OpenAI API
VITE_OPENAI_API_KEY=sk-...

# Web Search
BRAVE_SEARCH_API_KEY=...

# Database
DATABASE_URL=postgresql://user:pass@host/dbname
PGHOST=host
PGPORT=5432
PGUSER=user
PGPASSWORD=pass
PGDATABASE=dbname

# Session Management
SESSION_SECRET=your-secret-key-here
```

### Optional Environment Variables

```bash
# API Configuration
PORT=3001                          # Backend port
NODE_ENV=production               # or development

# Shopify
SHOPIFY_STORE_URL=crafftein.myshopify.com

# Feature Flags
ENABLE_WEB_SEARCH=true
ENABLE_DATABASE_SAVING=true
```

### Development vs Production

| Setting | Development | Production |
|---------|-------------|-----------|
| VITE Dev Server | http://localhost:5000 | Deployment URL |
| Backend API | http://localhost:3001 | Same domain as frontend |
| Database | Local PostgreSQL | Managed service |
| OpenAI | dev keys | production keys |
| CORS | Permissive | Strict |
| Rate Limiting | Loose | 20 req/min |

---

## Troubleshooting

### Common Issues

#### 1. Web Search Not Working
**Problem:** `searchWeb` returns no results or error

**Solution:**
- Check `BRAVE_SEARCH_API_KEY` is set
- Verify API key is valid on Brave website
- Check rate limits (20/min)
- Look at backend logs for "Brave API error"

#### 2. Messages Not Saving to Database
**Problem:** Formula not persisting

**Solution:**
- Check `DATABASE_URL` is correct
- Verify PostgreSQL connection
- Check database tables exist (run migrations)
- Look for database errors in server logs

#### 3. Off-Topic Questions Not Returning to Same Component
**Problem:** Bot advances to next step instead of returning

**Solution:**
- Verify `resumeInstructions` in `openaiService.ts` includes component
- Check system prompt is being sent correctly
- Look at OpenAI response - should have same component

#### 4. Vite Dev Server Not Accessible from Shopify
**Problem:** CORS errors or blank iframe

**Solution:**
- Ensure `vite.config.ts` has `allowedHosts: true`
- Check CORS headers on backend
- Verify deployment URL is public

---

## Performance Optimization

### Frontend Optimizations
- Message virtualization for long conversations
- Debounced input handling
- Memoized components to prevent re-renders
- Lazy loading of components

### Backend Optimizations
- Rate limiting to prevent abuse
- Connection pooling for database
- OpenAI API caching for repeated prompts
- Static file compression

### Database Optimizations
- Indexed queries on sessionId, shopifyCustomerId
- Pagination for large result sets
- Connection pooling

---

## Security Considerations

### Secrets Management
✅ All API keys stored in environment variables
✅ Keys never committed to repository
✅ VITE_* prefix for frontend-safe variables only
✅ Backend secrets never exposed to frontend

### API Security
✅ CORS headers properly configured
✅ Rate limiting enabled (20 req/min per IP)
✅ Input validation on all endpoints
✅ SQL injection prevention via ORM

### Data Privacy
✅ Session IDs used instead of personally identifying data
✅ Shopify customer IDs only stored if explicitly provided
✅ Database encryption enabled
✅ SSL/TLS for all API calls

---

## Future Enhancements

### Planned Features
1. **Multi-language Support** - Support for Spanish, French, etc.
2. **Custom Blending** - Allow users to add custom ingredients
3. **Subscription Model** - Save formulas, reorder easily
4. **Mobile App** - React Native version
5. **Admin Dashboard** - Manage ingredients, view analytics
6. **A/B Testing** - Test different conversation flows
7. **User Accounts** - Save preferences, order history
8. **Integration with Fulfillment** - Direct to packaging system

---

## Support & Resources

### Documentation
- OpenAI API: https://platform.openai.com/docs
- Drizzle ORM: https://orm.drizzle.team
- Vite: https://vitejs.dev
- Tailwind CSS: https://tailwindcss.com

### Monitoring
- Backend logs: Server console output
- Frontend logs: Browser developer console
- Database: Direct PostgreSQL query access

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Nov 2025 | Initial release |
| 1.1 | In Progress | Mobile optimization |

---

**Last Updated:** November 24, 2025  
**Maintained By:** Development Team  
**Status:** Production Ready ✅
