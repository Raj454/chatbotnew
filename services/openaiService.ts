import type { Message, Formula } from '../types';
import { buildCompleteSystemInstruction } from '../config/botInstructions';

interface DBIngredient {
  id: number;
  name: string;
  blend: string;
  dosageMin: string;
  dosageMax: string;
  dosageSuggested: string | null;
  unit: string | null;
  inStock: boolean | null;
}

interface DBBlend {
  id: number;
  name: string;
  displayOrder: number;
}

let cachedIngredients: DBIngredient[] | null = null;
let cachedBlends: DBBlend[] | null = null;
let cachedBotInstructions: string | null = null;
let cacheTimestamp: number = 0;
let botInstructionsCacheTimestamp: number = 0;
const CACHE_TTL = 60000;

// Fetch custom bot instructions from database (set via Admin Panel)
async function fetchBotInstructionsFromDB(): Promise<string | null> {
  const now = Date.now();
  if (cachedBotInstructions !== null && (now - botInstructionsCacheTimestamp) < CACHE_TTL) {
    return cachedBotInstructions;
  }

  try {
    const res = await fetch('/api/settings/bot_instructions');
    if (res.ok) {
      const data = await res.json();
      cachedBotInstructions = data.value || null;
      botInstructionsCacheTimestamp = now;
      return cachedBotInstructions;
    }
  } catch (error) {
    console.error('Error fetching bot instructions from DB:', error);
  }

  cachedBotInstructions = null;
  botInstructionsCacheTimestamp = now;
  return null;
}

async function fetchIngredientsFromDB(): Promise<{ blends: DBBlend[], ingredients: DBIngredient[] }> {
  const now = Date.now();
  if (cachedIngredients && cachedBlends && (now - cacheTimestamp) < CACHE_TTL) {
    return { blends: cachedBlends, ingredients: cachedIngredients };
  }

  try {
    const [blendsRes, ingredientsRes] = await Promise.all([
      fetch('/api/admin/blends-public'),
      fetch('/api/ingredients')
    ]);

    if (blendsRes.ok && ingredientsRes.ok) {
      const blendsData = await blendsRes.json();
      const ingredientsData = await ingredientsRes.json();
      cachedBlends = blendsData.data || [];
      cachedIngredients = ingredientsData.data || [];
      cacheTimestamp = now;
      return { blends: cachedBlends!, ingredients: cachedIngredients! };
    }
  } catch (error) {
    console.error('Error fetching ingredients from DB:', error);
  }

  return { blends: [], ingredients: [] };
}

function buildIngredientsPrompt(blends: DBBlend[], ingredients: DBIngredient[]): string {
  const ingredientsByBlend = ingredients.reduce((acc, ing) => {
    if (!acc[ing.blend]) acc[ing.blend] = [];
    acc[ing.blend].push(ing);
    return acc;
  }, {} as Record<string, DBIngredient[]>);

  const sortedBlends = blends.sort((a, b) => a.displayOrder - b.displayOrder);
  
  return sortedBlends.map(blend => {
    const blendIngredients = ingredientsByBlend[blend.name] || [];
    const inStockIngredients = blendIngredients.filter(ing => ing.inStock !== false);
    return `${blend.name}: ${inStockIngredients.map(ing => `${ing.name} ${ing.dosageMin}-${ing.dosageMax}${ing.unit || 'mg'}`).join(', ')}`;
  }).join('\n');
}

// Use secure backend endpoint instead of direct OpenAI API
const API_URL = '/api/chat';

// Use the bot instructions - combines database (Admin Panel) + code file
async function buildSystemInstruction(ingredientsPrompt: string): Promise<string> {
  // Try to get custom instructions from Admin Panel (database)
  const customInstructions = await fetchBotInstructionsFromDB();
  
  // Get the base instructions from the code file
  const baseInstructions = buildCompleteSystemInstruction(ingredientsPrompt);
  
  // If there are custom instructions from Admin Panel, prepend them
  if (customInstructions && customInstructions.trim()) {
    return `**ADMIN CUSTOMIZATIONS (PRIORITY):**
${customInstructions}

---

${baseInstructions}`;
  }
  
  // Otherwise, just use the code file instructions
  return baseInstructions;
}

// Helper to get the next missing component based on what's already collected
const getNextMissingComponent = (formula: Formula): { component: string; text: string; inputType: 'text' | 'options' | 'multiselect' | 'slider' | 'ingredient_sliders' | undefined } => {
    const componentFlow = ['Goal', 'Format', 'Routine', 'Lifestyle', 'Sensitivities', 'CurrentSupplements', 'Experience'];
    
    for (const component of componentFlow) {
        if (!formula[component]) {
            // Return appropriate question for this component
            switch (component) {
                case 'Goal':
                    return {
                        component: 'Goal',
                        text: 'Hey! 👋 What are you looking for today? Energy, focus, hydration, or something else?',
                        inputType: 'text'
                    };
                case 'Format':
                    return {
                        component: 'Format',
                        text: 'Nice! Do you want Stick Packs, Capsules, or Pods?',
                        inputType: 'text'
                    };
                case 'Routine':
                    return {
                        component: 'Routine',
                        text: 'Perfect! When do you usually need that boost - morning, afternoon, or evening?',
                        inputType: 'text'
                    };
                case 'Lifestyle':
                    return {
                        component: 'Lifestyle',
                        text: 'Cool! Are you pretty active, or more of a desk job kind of person?',
                        inputType: 'text'
                    };
                case 'Sensitivities':
                    return {
                        component: 'Sensitivities',
                        text: 'Got it! Any sensitivities I should know about? Caffeine, allergies, anything like that?',
                        inputType: 'text'
                    };
                case 'CurrentSupplements':
                    return {
                        component: 'CurrentSupplements',
                        text: 'Almost done! Taking any other supplements or meds?',
                        inputType: 'text'
                    };
                case 'Experience':
                    return {
                        component: 'Experience',
                        text: 'Last thing - are you new to supplements or pretty experienced with them?',
                        inputType: 'text'
                    };
            }
        }
    }
    
    // All components collected - shouldn't reach here in normal flow
    return {
        component: 'Goal',
        text: 'Let me help you create your perfect formula! What are you looking for?',
        inputType: 'text'
    };
};

// Helper to validate and clamp ingredient dosages within database ranges
const validateIngredientDosages = (ingredients: any[]): any[] => {
    if (!ingredients || !Array.isArray(ingredients)) return ingredients;
    
    return ingredients.map(ing => {
        // Clamp suggested value within min/max range
        if (ing.suggested !== undefined && ing.min !== undefined && ing.max !== undefined) {
            const clamped = Math.max(ing.min, Math.min(ing.max, ing.suggested));
            
            if (clamped !== ing.suggested) {
                console.warn(`Dosage clamped for ${ing.name}: ${ing.suggested} → ${clamped} (range: ${ing.min}-${ing.max})`);
            }
            
            return {
                ...ing,
                suggested: clamped
            };
        }
        
        return ing;
    });
};

export const getNextStep = async (_apiKey: string, history: Message[], formula: Formula): Promise<Message | null> => {
    // API key is now handled server-side - we no longer need it on the frontend
    
    try {
        // Fetch ingredients from database and build system instruction
        const { blends, ingredients } = await fetchIngredientsFromDB();
        const ingredientsPrompt = buildIngredientsPrompt(blends, ingredients);
        const systemInstructionText = await buildSystemInstruction(ingredientsPrompt);
        
        // Prepare messages for the backend
        const simplifiedHistory = history
            .filter(msg => msg.id !== 'start')
            .map(msg => ({
                sender: msg.sender,
                text: typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text),
                component: msg.component
            }));
        
        // Call secure backend API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: simplifiedHistory,
                formula: formula,
                systemInstruction: systemInstructionText
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Chat API Error:', errorData);
            return {
                id: 'error',
                sender: 'bot',
                text: errorData.error || 'Sorry, I\'m having trouble connecting. Please try again!'
            };
        }

        const data = await response.json();
        
        if (!data.success) {
            return {
                id: 'error',
                sender: 'bot',
                text: data.error || 'Sorry, something went wrong. Please try again!'
            };
        }

        const content = data.message;
        if (!content) {
            return { id: 'error', sender: 'bot', text: 'Sorry, I received an empty response.' };
        }

        // Try to parse as JSON
        let parsedContent;
        try {
            let cleanContent = content.trim();
            
            // Strip markdown code blocks if present
            if (cleanContent.startsWith('```json')) {
                cleanContent = cleanContent.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
            } else if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
            }
            
            parsedContent = JSON.parse(cleanContent);
        } catch (parseError) {
            // Content is plain text, return as simple message
            return {
                id: Date.now().toString(),
                sender: 'bot',
                text: content,
                inputType: 'text',
                component: getNextMissingComponent(formula).component
            };
        }
        
        // Validate and clamp ingredient dosages
        const validatedIngredients = parsedContent.ingredients ? validateIngredientDosages(parsedContent.ingredients) : parsedContent.ingredients;
        const validatedFormulaSummary = parsedContent.formulaSummary?.ingredients ? {
            ...parsedContent.formulaSummary,
            ingredients: validateIngredientDosages(parsedContent.formulaSummary.ingredients)
        } : parsedContent.formulaSummary;

        return {
            id: Date.now().toString(),
            sender: 'bot',
            text: parsedContent.text || "I'm not sure what to say next!",
            inputType: parsedContent.inputType,
            component: parsedContent.component,
            options: parsedContent.options,
            sliderConfig: parsedContent.sliderConfig,
            ingredients: validatedIngredients,
            isComplete: parsedContent.isComplete,
            formulaSummary: validatedFormulaSummary,
        };

    } catch (error) {
        console.error('Error calling Chat API:', error);
        return {
            id: 'error',
            sender: 'bot',
            text: 'I am having trouble connecting. Please check your connection and try again.'
        };
    }
};