# Craffteine Admin Panel Guide

## Getting Started

### How to Access Admin Panel
1. Go to your website URL + `/admin` (example: `yoursite.com/admin`)
2. Enter your admin password
3. You're in!

---

## Admin Panel Sections

### 1. Bot Instructions
**What it does:** Controls how the AI chatbot talks and behaves

**How to use:**
- Edit the text in the box
- Click **Save**
- Changes go live within 60 seconds

**What you can change:**
| Setting | Example |
|---------|---------|
| Greeting message | "Hey hey! Welcome to Craffteine..." |
| Tone of voice | Friendly, professional, playful |
| Goal options | Energy, Focus, Relax, Immunity, etc. |
| Safety warnings | "Warn if caffeine over 300mg" |
| Special promotions | "Mention free shipping this week" |
| Out of stock messages | Custom apology messages |

---

### 2. Ingredients Manager
**What it does:** Manage your supplement ingredients inventory

**How to use:**
- **Filter by blend:** Click a blend name (ENERGY+, FOCUS FLOW, etc.)
- **Toggle stock:** Click the toggle to mark in/out of stock
- **Add ingredient:** Fill in name, blend, dosages, click Add

**Blend Categories:**
- ENERGY+ (caffeine, taurine, B vitamins)
- FOCUS FLOW (L-theanine, Lion's Mane)
- CALM CORE (Magnesium, Ashwagandha)
- THERMO BURN (Green tea, Capsaicin)
- PUMP+PERFORM (Creatine, Beta-alanine)
- IMMUNITY GUARD (Vitamin C, Zinc, Elderberry)
- HYDRATE+ (Electrolytes, Coconut water)

**Important:** The chatbot only recommends IN-STOCK ingredients!

---

### 3. Flavors Manager
**What it does:** Manage available flavors for Stick Packs

**How to use:**
- **Toggle stock:** Click to mark flavors in/out of stock
- **Add flavor:** Type name, click Add

**Note:** Flavors only apply to Stick Pack format (not Capsules or Pods)

---

### 4. Formula History
**What it does:** View all formulas customers have created

**Information shown:**
- Formula name
- Customer goal (Energy, Focus, etc.)
- Format chosen (Stick Pack, Capsule, Pod)
- Ingredients and dosages
- Date created

---

## Writing Bot Instructions

### Basic Structure
```
**SECTION NAME:**
- Rule 1
- Rule 2
- Rule 3
```

### Good Examples

**Greeting:**
```
**GREETING:**
Hey hey! Welcome to Craffteine. Ready to mix your perfect powdered potion?
```

**Adding Rules:**
```
**RULES:**
- Maximum 5 ingredients per formula
- Always warn about caffeine sensitivity
- Suggest complementary ingredients (like Caffeine + L-Theanine)
```

**Safety Warnings:**
```
**SAFETY FLAGS - Warn if:**
- Caffeine over 300mg
- Melatonin over 5mg
- Zinc over 40mg
```

**Promotions (temporary):**
```
**CURRENT PROMOTION:**
Mention that first-time customers get 15% off with code FIRST15
(Remove this section when promotion ends)
```

---

## Common Tasks

### Change the Greeting
1. Go to Bot Instructions
2. Find `**GREETING:**` section
3. Edit the text
4. Save

### Add a New Goal Option
1. Go to Bot Instructions
2. Find `**GOAL OPTIONS:**` section
3. Add your new goal (example: `- Recovery`)
4. Save

### Mark Ingredient Out of Stock
1. Go to Ingredients Manager
2. Find the ingredient
3. Click the toggle to turn it OFF (gray)
4. Chatbot will stop recommending it immediately

### Add Seasonal Promotion
1. Go to Bot Instructions
2. Add a new section:
```
**HOLIDAY SPECIAL:**
Mention our holiday bundle: Buy 2 formulas, get 1 free!
```
3. Save
4. Delete the section when promotion ends

### Add Safety Warning
1. Go to Bot Instructions
2. Find `**SAFETY FLAGS:**` section
3. Add new warning:
```
- Warn pregnant users to consult doctor first
```
4. Save

---

## Tips for Success

### Do's
- Keep instructions clear and simple
- Use bullet points for lists
- Test changes by starting a new chat
- Update stock status regularly

### Don'ts
- Don't delete the basic structure (FLOW, RULES, etc.)
- Don't add conflicting rules
- Don't forget to click Save

---

## Troubleshooting

### "My changes aren't showing"
- Wait 60 seconds (changes take up to 1 minute)
- Start a NEW chat (old chats use old instructions)
- Make sure you clicked Save

### "Chatbot isn't recommending an ingredient"
- Check if it's marked IN STOCK in Ingredients Manager
- The ingredient must be in one of the 7 blend categories

### "Flavors not showing"
- Flavors only work for STICK PACK format
- Check if flavors are marked IN STOCK

---

## Need Help?

Contact your developer if you need to:
- Change the conversation flow order
- Add new input types (sliders, buttons)
- Modify technical settings
- Fix errors or bugs

For simple changes (text, rules, inventory), use the Admin Panel!
