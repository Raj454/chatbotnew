import type { Message, Formula } from '../types';
import { inventoryService } from './inventoryService';
import { getCurrentTime, getCurrentDate, getWeather, calculate, searchWeb } from '../utils/tools';
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

const API_URL = 'https://api.openai.com/v1/chat/completions';

// Helper to format OpenAI errors into user-friendly messages
const formatOpenAIError = (errorData: any): string => {
    const errorMessage = errorData?.error?.message || '';
    
    // Rate limit error
    if (errorMessage.includes('Rate limit reached') || errorMessage.includes('rate_limit_exceeded')) {
        return "Whoa, slow down! 😅 I need a quick breather. Please wait a few seconds and try again!";
    }
    
    // Quota exceeded
    if (errorMessage.includes('quota') || errorMessage.includes('insufficient_quota')) {
        return "Oops, I've hit my daily limit! 😔 Please try again tomorrow or contact support.";
    }
    
    // Invalid API key
    if (errorMessage.includes('Incorrect API key') || errorMessage.includes('invalid_api_key')) {
        return "Hmm, there's a configuration issue. Please contact support!";
    }
    
    // Default friendly error
    return "Sorry, I'm having trouble connecting right now. Please try again in a moment! 💜";
};

// Define function schemas for OpenAI function calling
const functionSchemas = [
  {
    name: 'getCurrentTime',
    description: 'Get the current time. Use this when the user asks what time it is.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getCurrentDate',
    description: 'Get the current date. Use this when the user asks what day it is or what the date is.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getWeather',
    description: 'Get the current weather for a location. Use this when the user asks about weather.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city or location to get weather for (e.g., "San Francisco", "New York"). Use "current" if user doesn\'t specify.'
        }
      },
      required: []
    }
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations. Use this when the user asks to calculate something or asks a math question.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to calculate (e.g., "25 * 4", "100 / 5 + 10")'
        }
      },
      required: ['expression']
    }
  },
  {
    name: 'searchWeb',
    description: 'Search for general knowledge information. Use this when the user asks factual questions you don\'t know the answer to.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query or question to look up'
        }
      },
      required: ['query']
    }
  }
];

// Helper to execute function calls
const executeFunctionCall = async (functionName: string, args: any = {}): Promise<string> => {
  try {
    switch (functionName) {
      case 'getCurrentTime': {
        const result = getCurrentTime();
        return result.success ? result.data : result.error || 'Failed to get time';
      }
      case 'getCurrentDate': {
        const result = getCurrentDate();
        return result.success ? result.data : result.error || 'Failed to get date';
      }
      case 'getWeather': {
        const result = await getWeather(args?.location);
        return result.success ? result.data : result.error || 'Failed to get weather';
      }
      case 'calculate': {
        const result = calculate(args?.expression || '');
        return result.success ? result.data : result.error || 'Failed to calculate';
      }
      case 'searchWeb': {
        const result = await searchWeb(args?.query || '');
        return result.success ? result.data : result.error || 'Search failed';
      }
      default:
        return `Unknown function: ${functionName}`;
    }
  } catch (error) {
    console.error(`Error executing function ${functionName}:`, error);
    return `Error executing ${functionName}`;
  }
};

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

// Helper to build persona summary for intelligent dosage decisions
const buildPersonaSummary = (formula: Formula): string => {
    if (Object.keys(formula).length === 0) return '';
    
    const parts: string[] = ['**USER PERSONA SUMMARY FOR DOSAGE CALCULATION:**'];
    
    // Experience level (most important for dosage)
    if (formula.Experience) {
        const exp = String(formula.Experience).toLowerCase();
        if (exp.includes('beginner') || exp.includes('new') || exp.includes('never')) {
            parts.push('- Experience: BEGINNER → Use 40-60% of dosage range');
        } else if (exp.includes('experienced') || exp.includes('advanced') || exp.includes('years')) {
            parts.push('- Experience: ADVANCED → Use 80-100% of dosage range');
        } else {
            parts.push('- Experience: MODERATE → Use 60-80% of dosage range');
        }
    } else {
        parts.push('- Experience: UNKNOWN (assume moderate) → Use 60-70% of dosage range');
    }
    
    // Activity level
    if (formula.Lifestyle || formula.Routine) {
        const lifestyle = String(formula.Lifestyle || '').toLowerCase();
        const routine = String(formula.Routine || '').toLowerCase();
        const combined = lifestyle + ' ' + routine;
        
        if (combined.includes('athlete') || combined.includes('gym') || combined.includes('workout') || combined.includes('active') || combined.includes('exercise')) {
            parts.push('- Activity: HIGH → Increase dosages within experience range');
        } else if (combined.includes('sedentary') || combined.includes('desk') || combined.includes('office')) {
            parts.push('- Activity: LOW → Decrease dosages within experience range');
        } else {
            parts.push('- Activity: MODERATE → Standard dosages within experience range');
        }
    }
    
    // Sensitivities and safety concerns
    if (formula.Sensitivities) {
        const sens = String(formula.Sensitivities).toLowerCase();
        if (sens.includes('caffeine') || sens.includes('stimulant')) {
            parts.push('- ALERT: Caffeine/stimulant sensitivity → Reduce stimulants to 30-50% of range');
        }
        if (sens.includes('anxiety') || sens.includes('sleep') || sens.includes('jitter')) {
            parts.push('- ALERT: Anxiety/sleep concerns → Significantly reduce stimulants');
        }
        if (sens !== 'none' && sens !== 'no' && sens.length > 3) {
            parts.push('- Sensitivities present → Use conservative dosages (40-60% of range)');
        }
    }
    
    // Current medications/supplements
    if (formula.CurrentSupplements) {
        const curr = String(formula.CurrentSupplements).toLowerCase();
        if (curr.includes('medication') || curr.includes('prescription') || (curr !== 'none' && curr !== 'no' && curr.length > 3)) {
            parts.push('- Taking other supplements/meds → Be conservative with dosages');
        }
    }
    
    // Goal-based adjustments
    if (formula.Goal) {
        const goal = String(formula.Goal).toLowerCase();
        if (goal.includes('energy') || goal.includes('focus') || goal.includes('performance')) {
            parts.push('- Goal needs strong support → Use higher end within safety limits');
        } else if (goal.includes('relax') || goal.includes('sleep') || goal.includes('calm')) {
            parts.push('- Goal is relaxation → Use moderate dosages');
        }
    }
    
    parts.push('\n**YOU MUST use this persona summary to calculate personalized "suggested" dosages for each ingredient.**');
    
    return parts.join('\n');
};

// Helper to build inventory context for AI
const buildInventoryContext = (): string => {
    const flavorList = inventoryService.getFlavorListForPrompt();
    const summary = inventoryService.getInventorySummary();
    const maxFlavors = inventoryService.getMaxFlavorSelections();
    
    return `**CURRENT INVENTORY STATUS:**
${summary}

**AVAILABLE FLAVORS (Stick Packs only, max ${maxFlavors}):**
${flavorList}

Only suggest flavors from this list. If user asks for a flavor not on this list, tell them to email suggest@craffteine.com`;
};

// Helper to format conversation history for OpenAI
const formatHistory = (history: Message[], formula: Formula, systemInstructionText: string): { role: 'user' | 'assistant' | 'system'; content: string }[] => {
    const formatted: { role: 'user' | 'assistant' | 'system'; content: string }[] = [{
        role: 'system',
        content: systemInstructionText
    }];
    
    // Add inventory context (flavors and stock status)
    formatted.push({
        role: 'system',
        content: buildInventoryContext()
    });
    
    // Track which components have been asked
    const componentsAsked = new Set<string>();
    
    // Add a summary of what has been collected so far with component tracking
    if(Object.keys(formula).length > 0) {
        const formulaSummary = Object.entries(formula).map(([component, value]) => {
            componentsAsked.add(component);
            return `${component}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
        }).join(', ');
        
        // Build persona summary for dosage decisions
        const personaSummary = buildPersonaSummary(formula);
        
        formatted.push({
            role: 'system',
            content: `Information already collected:\n${formulaSummary}\n\nComponents already asked about: ${Array.from(componentsAsked).join(', ')}\n\nDO NOT ask about these components again. Move to the next step in the conversation flow.\n\n${personaSummary}`
        });
    }

    history.forEach(msg => {
        if(msg.sender === 'bot' && msg.id === 'start') return; // Don't include the static start message
        
        // For bot messages, include what component they were asking about
        if(msg.sender === 'bot' && msg.component) {
            formatted.push({
                role: 'assistant',
                content: `[Asked about: ${msg.component}] ${msg.text}`
            });
        } else {
            // Ensure content is always a string, not an object
            const content = typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text);
            formatted.push({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: content
            });
        }
    });

    return formatted;
};


export const getNextStep = async (apiKey: string, history: Message[], formula: Formula): Promise<Message | null> => {
    if (!apiKey) {
        console.error("OpenAI API key is missing.");
        return {
            id: 'error',
            sender: 'bot',
            text: 'API Key is not configured.'
        };
    }
    
    // Fetch ingredients from database and build system instruction
    const { blends, ingredients } = await fetchIngredientsFromDB();
    const ingredientsPrompt = buildIngredientsPrompt(blends, ingredients);
    const systemInstructionText = await buildSystemInstruction(ingredientsPrompt);
    
    let messages = formatHistory(history, formula, systemInstructionText);
    let attemptCount = 0;
    const maxAttempts = 5;
    
    try {
        while (attemptCount < maxAttempts) {
            attemptCount++;
            
            const requestBody: any = {
                model: 'gpt-4o-mini',
                messages: messages,
                functions: functionSchemas,
                function_call: 'auto',
            };
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('OpenAI API Error:', errorData);
                return {
                    id: 'error',
                    sender: 'bot',
                    text: formatOpenAIError(errorData)
                };
            }

            const data = await response.json();
            const message = data.choices[0]?.message;

            if (!message) {
                return { id: 'error', sender: 'bot', text: 'Sorry, I received an empty response.' };
            }

            if (message.function_call) {
                const functionName = message.function_call.name;
                const functionArgs = message.function_call.arguments ? JSON.parse(message.function_call.arguments) : {};
                
                console.log(`AI calling function: ${functionName}`, functionArgs);
                
                const functionResult = await executeFunctionCall(functionName, functionArgs);
                
                messages.push({
                    role: 'assistant',
                    content: null,
                    function_call: message.function_call
                } as any);
                
                messages.push({
                    role: 'function',
                    name: functionName,
                    content: functionResult
                } as any);
                
                // Find the last component the AI was asking about before the function call
                const lastBotMessage = history[history.length - 2]; // Second to last message (before user's off-topic question)
                const lastComponent = lastBotMessage?.component || null;
                
                const componentsCollected = Object.keys(formula);
                let resumeInstructions = '';
                
                if (lastComponent) {
                    // The AI was asking about a specific component - continue with THAT component
                    resumeInstructions = `CRITICAL: The user just asked an off-topic question which you answered. Before they interrupted, you were asking about component "${lastComponent}". You MUST continue asking about "${lastComponent}" - do NOT advance to the next component. Return component: "${lastComponent}" in your JSON response.`;
                } else if (componentsCollected.length === 0) {
                    // No components collected yet
                    resumeInstructions = 'No components collected yet. Ask about "Goal" to find out what they want.';
                } else {
                    // Determine next component based on what's collected
                    resumeInstructions = `Components collected: ${componentsCollected.join(', ')}. Ask about the NEXT missing component in the flow.`;
                }
                
                const messagesWithSystemReminder = [
                    ...messages.slice(0, 1),
                    {
                        role: 'system',
                        content: `You must respond in valid JSON format with these fields: text (string), inputType (string), component (string), options (array or null), sliderConfig (object or null), ingredients (array or null), isComplete (boolean), formulaSummary (object or null). 
                        
${resumeInstructions}

IMPORTANT: If you used searchWeb function, include the FULL search results in your response so the user sees actual information. For other functions (time, weather, math), answer briefly (1 sentence). Then immediately continue with the component specified above.`
                    },
                    ...messages.slice(1)
                ];
                
                const finalResponse = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: messagesWithSystemReminder,
                        response_format: { type: "json_object" },
                    })
                });

                if (!finalResponse.ok) {
                    const errorData = await finalResponse.json();
                    console.error('OpenAI API Error (after function):', errorData);
                    return {
                        id: 'error',
                        sender: 'bot',
                        text: formatOpenAIError(errorData)
                    };
                }

                const finalData = await finalResponse.json();
                const finalMessage = finalData.choices[0]?.message;
                
                if (!finalMessage?.content) {
                    continue;
                }
                
                let cleanContent = finalMessage.content.trim();
                
                // Strip markdown code blocks if present
                if (cleanContent.startsWith('```json')) {
                    cleanContent = cleanContent.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
                } else if (cleanContent.startsWith('```')) {
                    cleanContent = cleanContent.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
                }
                
                const parsedContent = JSON.parse(cleanContent);
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
            }

            const content = message.content;
            if (!content) {
                return { id: 'error', sender: 'bot', text: 'Sorry, I received an empty response.' };
            }

            let parsedContent;
            let isPlainText = false;
            
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
                // Content is plain text, need to request JSON format
                isPlainText = true;
            }
            
            // If we got plain text instead of JSON, make another API call with JSON format enforced
            if (isPlainText) {
                messages.push({
                    role: 'assistant',
                    content: content
                });
                
                messages.push({
                    role: 'system',
                    content: 'Please reformat your last response as a valid JSON object with these exact fields: text (string), inputType (string), component (string), options (array or null), sliderConfig (object or null), ingredients (array or null), isComplete (boolean), formulaSummary (object or null). Keep the same meaning and content, just change the format to JSON.'
                });
                
                const jsonResponse = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: messages,
                        response_format: { type: "json_object" },
                    })
                });
                
                if (!jsonResponse.ok) {
                    console.error('Failed to get JSON format - falling back to next missing component');
                    const nextStep = getNextMissingComponent(formula);
                    return {
                        id: 'error',
                        sender: 'bot',
                        text: nextStep.text,
                        inputType: nextStep.inputType,
                        component: nextStep.component
                    };
                }
                
                const jsonData = await jsonResponse.json();
                const jsonMessage = jsonData.choices[0]?.message;
                
                if (!jsonMessage?.content) {
                    continue;
                }
                
                let cleanJsonContent = jsonMessage.content.trim();
                if (cleanJsonContent.startsWith('```json')) {
                    cleanJsonContent = cleanJsonContent.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
                } else if (cleanJsonContent.startsWith('```')) {
                    cleanJsonContent = cleanJsonContent.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
                }
                
                parsedContent = JSON.parse(cleanJsonContent);
            }
            
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
        }
        
        return {
            id: 'error',
            sender: 'bot',
            text: 'I got stuck in a loop while trying to answer. Let me help with your supplement formula instead!'
        };

    } catch (error) {
        console.error('Error calling OpenAI Service:', error);
        return {
            id: 'error',
            sender: 'bot',
            text: 'I am having trouble connecting. Please check your connection and try again.'
        };
    }
};