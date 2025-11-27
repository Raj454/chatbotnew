import React, { useState, useEffect, useRef } from 'react';
import ChatWindow from './components/ChatWindow';
import { getNextStep } from './services/openaiService';
import { Message, Formula } from './types';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { AIBotIcon } from './components/icons/AIBotIcon';
import { sessionService } from './services/sessionService';
import { formulaService } from './services/formulaService';
import craffteineLogo from './src/assets/craffteine-text-logo.png';

// This key is for demonstration. In a production app, this should be handled securely on a backend.
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;

// Rate limiting: prevent rapid-fire messages to avoid OpenAI API rate limits
const COOLDOWN_MS = 4000; // 4 seconds between messages (increased to prevent rate limit errors)

// Type for stored ingredients
interface StoredIngredient {
  name: string;
  min: number;
  max: number;
  suggested: number;
  unit: string;
  rationale?: string;
}

// Normalize user input before saving to formula state
const normalizeValue = (userValue: string, component: string, previousBotMessage: Message | undefined): string => {
  const trimmed = userValue.trim().toLowerCase();
  const original = userValue.trim();
  
  // Check if we're confirming a pending value from bot's previous message
  if (previousBotMessage?.pendingConfirmation && previousBotMessage?.extractedValue) {
    const confirmationPhrases = ['yes', 'yeah', 'sure', 'sounds good', 'correct', 'right', 'ok', 'okay', 'yep', 'yup', 'perfect', 'great'];
    const isConfirming = confirmationPhrases.some(phrase => 
      trimmed === phrase || trimmed === phrase + '!' || trimmed === phrase + '?'
    );
    
    if (isConfirming) {
      // User confirmed! Save the extracted value
      return previousBotMessage.extractedValue;
    }
  }
  
  // List of forbidden phrases that should trigger value extraction
  const forbiddenPhrases = [
    'sure', 'yeah', 'great', 'ok', 'yes', 'okay',
    'any', 'sounds good', 'perfect', 'awesome',
    'what do you recommend', 'what do you suggest', 'what do you think',
    'whatever you want', 'whatever you like', 'whatever', 'up to you', 'you choose', 'you decide',
    'i don\'t know', 'idk', 'not sure', 'dunno',
    'surprise me', 'dealer\'s choice', 'your choice',
    'done', 'finished', 'good', 'fine', 'nice', 'cool', 'yep', 'yup', 'no', 'nope'
  ];
  
  // Check if user value is forbidden - normalize spaces to handle variations
  // Convert multiple spaces to single space, and remove punctuation for matching
  const normalizedTrimmed = trimmed.replace(/\s+/g, ' ').replace(/[!?.]$/g, '');
  
  const isForbidden = forbiddenPhrases.some(phrase => {
    const normalizedPhrase = phrase.replace(/\s+/g, ' ');
    return normalizedTrimmed === normalizedPhrase || 
           normalizedTrimmed === normalizedPhrase + '!' ||
           normalizedTrimmed === normalizedPhrase + '?' ||
           normalizedTrimmed.startsWith(normalizedPhrase + ' ') || 
           normalizedTrimmed.endsWith(' ' + normalizedPhrase) ||
           // Also check if phrase appears as substring with word boundaries
           normalizedTrimmed.includes(' ' + normalizedPhrase + ' ') ||
           normalizedTrimmed.startsWith(normalizedPhrase + ' ') ||
           normalizedTrimmed.endsWith(' ' + normalizedPhrase);
  });
  
  // Get bot text for context-based extraction
  const botText = previousBotMessage?.text?.toLowerCase() || '';
  
  // NATURAL LANGUAGE UNDERSTANDING - Component-specific intelligence
  switch (component) {
    case 'Goal':
      // Natural language patterns for goals
      if (trimmed.includes('energy') || trimmed.includes('tired') || trimmed.includes('coffee') || trimmed.includes('red bull')) return 'Energy';
      if (trimmed.includes('focus') || trimmed.includes('concentrate') || trimmed.includes('work')) return 'Focus';
      if (trimmed.includes('hydrat') || trimmed.includes('water') || trimmed.includes('thirsty')) return 'Hydration';
      if (trimmed.includes('sleep') || trimmed.includes('rest') || trimmed.includes('bed')) return 'Sleep';
      if (trimmed.includes('recover') || trimmed.includes('gym') || trimmed.includes('workout')) return 'Recovery';
      break;
      
    case 'Format':
      // Natural language patterns for formats
      if (trimmed.includes('powder') || trimmed.includes('mix') || trimmed.includes('stick') || trimmed.includes('packet')) return 'Stick Pack';
      if (trimmed.includes('pill') || trimmed.includes('capsule') || trimmed.includes('tablet')) return 'Capsule';
      if (trimmed.includes('pod') || trimmed.includes('coffee maker')) return 'Pod';
      
      // If forbidden phrase, extract first mentioned format from bot message
      if (isForbidden) {
        if (botText.includes('stick pack') || botText.includes('stick-pack')) return 'Stick Pack';
        if (botText.includes('capsule')) return 'Capsule';
        if (botText.includes('pod')) return 'Pod';
      }
      break;
      
    case 'Routine':
      // Natural language patterns for routine
      if (trimmed.includes('morning') || trimmed.includes('breakfast') || trimmed.includes('wake')) return 'Morning';
      if (trimmed.includes('afternoon') || trimmed.includes('lunch') || trimmed.includes('midday')) return 'Afternoon';
      if (trimmed.includes('evening') || trimmed.includes('night') || trimmed.includes('dinner')) return 'Evening';
      if (trimmed.includes('all') || trimmed.includes('throughout')) return 'All day';
      break;
      
    case 'Lifestyle':
      // Natural language patterns for lifestyle
      if (trimmed.includes('active') || trimmed.includes('gym') || trimmed.includes('workout') || trimmed.includes('athlete') || trimmed.includes('exercise')) return 'Active';
      if (trimmed.includes('desk') || trimmed.includes('office') || trimmed.includes('sedentary') || trimmed.includes('sit')) return 'Sedentary';
      if (trimmed.includes('moderate') || trimmed.includes('sometimes')) return 'Moderate';
      break;
      
    case 'Sensitivities':
      // Natural language patterns for sensitivities
      if (trimmed.includes('no') || trimmed.includes('none') || trimmed.includes('nope')) return 'No';
      if (trimmed.includes('caffeine') || trimmed.includes('jittery') || trimmed.includes('coffee')) return 'Caffeine sensitive';
      // Otherwise return as-is for specific allergies
      break;
      
    case 'Flavors':
      // Check if user is skipping flavors
      const skipPhrases = ['skip', 'none', 'no flavors', 'no thanks', 'plain', 'unflavored'];
      if (skipPhrases.some(phrase => trimmed.includes(phrase))) {
        return 'None';
      }
      
      // Extract specific flavor names from natural language
      const flavorNames = [
        'mango', 'sour cherry', 'watermelon', 'strawberry banana', 'root beer',
        'green apple', 'fruit punch', 'ice pop', 'gummy bear', 'blue raspberry',
        'pineapple', 'strawberry', 'raspberry', 'orange', 'lemon', 'lime',
        'lemonade', 'cotton candy', 'bubble gum', 'pink lemonade', 'coconut', 'banana'
      ];
      
      const detectedFlavors: string[] = [];
      for (const flavor of flavorNames) {
        if (botText.includes(flavor) || trimmed.includes(flavor)) {
          // Capitalize properly
          const capitalized = flavor.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          detectedFlavors.push(capitalized);
          if (detectedFlavors.length >= 2) break; // Max 2 flavors
        }
      }
      
      if (detectedFlavors.length > 0) {
        return detectedFlavors.slice(0, 2).join(', '); // Max 2 flavors
      }
      // If user said "whatever", "any", etc. - extract from bot message
      break;
  }
  
  // If not forbidden and didn't match any natural language pattern, return as-is
  if (!isForbidden) {
    return original;
  }
  
  // Value is forbidden - extract from previous bot message
  if (!botText) {
    return original; // Fallback if no context
  }
  
  // Extract first option based on component
  switch (component) {
    case 'Goal':
      // Extract goal from bot's message (check what it recommended)
      if (botText.includes('energy')) return 'Energy';
      if (botText.includes('focus')) return 'Focus';
      if (botText.includes('hydration')) return 'Hydration';
      if (botText.includes('sleep')) return 'Sleep';
      if (botText.includes('recovery')) return 'Recovery';
      
      // If bot didn't specify, randomly select a goal
      const goals = ['Energy', 'Focus', 'Hydration', 'Sleep', 'Recovery'];
      return goals[Math.floor(Math.random() * goals.length)];
      break;
      
    case 'Format':
      // Handle both singular and plural forms
      if (botText.includes('stick pack') || botText.includes('stick-pack')) return 'Stick Pack';
      if (botText.includes('capsule')) return 'Capsule';
      if (botText.includes('pod')) return 'Pod';
      // If no specific format found, default to first option mentioned
      if (botText.includes('powder') || botText.includes('mix')) return 'Stick Pack';
      return 'Stick Pack'; // Default recommendation
      break;
      
    case 'Sweetener':
      // Extract sweetener recommendation from bot's previous message
      if (botText.includes('stevia')) return 'Stevia';
      if (botText.includes('monk fruit')) return 'Monk Fruit';
      if (botText.includes('allulose')) return 'Allulose';
      if (botText.includes('erythritol')) return 'Erythritol';
      // Default recommendation if not found
      return 'Stevia';
      break;
      
    case 'Flavors':
      // Extract all flavors mentioned in bot's message
      const flavorList = [
        'mango', 'sour cherry', 'watermelon', 'strawberry banana', 'root beer',
        'green apple', 'fruit punch', 'ice pop', 'gummy bear', 'blue raspberry',
        'pineapple', 'strawberry', 'raspberry', 'orange', 'lemon', 'lime',
        'lemonade', 'cotton candy', 'bubble gum', 'pink lemonade', 'coconut', 'banana'
      ];
      
      const foundFlavors: string[] = [];
      for (const flavor of flavorList) {
        if (botText.includes(flavor)) {
          const capitalized = flavor.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          foundFlavors.push(capitalized);
          if (foundFlavors.length >= 2) break; // Max 2 flavors
        }
      }
      
      if (foundFlavors.length > 0) {
        return foundFlavors.slice(0, 2).join(', ');
      }
      // Default recommendation if no flavors found in bot message
      return 'Mango';
      break;
      
    case 'FormulaName':
      // Look for AI's suggestion in quotes or after various trigger phrases
      // Try quoted text first: "Morning Energy Boost" or 'Morning Energy Boost'
      let nameMatch = botText.match(/['"]([^'"]+)['"]/);
      if (nameMatch) return nameMatch[1];
      
      // Try "How about" pattern with optional quotes: How about 'Morning Energy Boost'? or How about Morning Energy Boost?
      let howAboutMatch = botText.match(/how about\s+['"]?([^?!\.'"]+)['"]?[\?!\.]/i);
      if (howAboutMatch) {
        const extracted = howAboutMatch[1].trim().replace(/^['"]|['"]$/g, '');
        if (extracted.length > 3) return extracted; // Only if reasonably long
      }
      
      // Try "call it" pattern: call it 'X' or call it X
      let callItMatch = botText.match(/call it\s+['"]?([^?!\.'"]+)['"]?[\?!\.]/i);
      if (callItMatch) {
        const extracted = callItMatch[1].trim().replace(/^['"]|['"]$/g, '');
        if (extracted.length > 3) return extracted;
      }
      
      // Try finding formula/blend suggestions preceded by specific words
      let formulaMatch = botText.match(/(?:like|for|as|called|name|suggest|how about)\s+(?:a|an)?\s*['"]?([A-Z][a-z\s]+(?:[A-Z][a-z]+)*)['"]?/);
      if (formulaMatch) {
        const extracted = formulaMatch[1].trim().replace(/^['"]|['"]$/g, '');
        if (extracted.length > 3) return extracted;
      }
      
      // Generate a default based on Goal if available
      return 'Custom Formula';
      
    default:
      break;
  }
  
  // Fallback: return original value
  return userValue.trim();
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [formula, setFormula] = useState<Formula>({});
  const [proceedUrl, setProceedUrl] = useState<string | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<{
    name: string;
    format: string;
    goal: string;
    ingredients: Array<{ name: string; dosage: number; unit: string }>;
    sweetener?: string;
    flavors?: string;
    price?: string;
  } | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);

  const conversationHistoryRef = useRef<Message[]>([]);
  const lastUserRequestAt = useRef<number>(0);
  const sessionIdRef = useRef<string>(sessionService.getSessionId());
  const ingredientsRef = useRef<StoredIngredient[]>([]);

  useEffect(() => {
    conversationHistoryRef.current = messages;
  }, [messages]);

  // Initialize session and load any saved formula on mount
  useEffect(() => {
    const initializeSession = async () => {
      const sessionId = sessionIdRef.current;
      
      // Try to load formula from database if this session has one
      const savedFormula = await formulaService.getFormulaBySession(sessionId);
      if (savedFormula?.formulaData) {
        setFormula(JSON.parse(savedFormula.formulaData));
      }
    };

    initializeSession();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemainingMs > 0) {
      const timer = setInterval(() => {
        const elapsed = Date.now() - lastUserRequestAt.current;
        const remaining = Math.max(0, COOLDOWN_MS - elapsed);
        setCooldownRemainingMs(remaining);
        
        if (remaining === 0) {
          clearInterval(timer);
        }
      }, 100);
      
      return () => clearInterval(timer);
    }
  }, [cooldownRemainingMs]);

  const resetChat = () => {
    setMessages([]);
    setHasStarted(false);
    setIsTyping(false);
    setFormula({});
    setProceedUrl(null);
    setCheckoutSummary(null);
    setCooldownRemainingMs(0);
    lastUserRequestAt.current = 0;
    sessionIdRef.current = sessionService.getSessionId();
    ingredientsRef.current = [];
  };

  const handleStart = async () => {
    setHasStarted(true);
    setIsTyping(true);

    const welcomeMessage: Message = {
      id: 'start',
      sender: 'bot',
      text: "Let's create your perfect wellness formula! 💜✨",
    };
    setMessages([welcomeMessage]);

    // FIX: Pass an empty formula object as the third argument to getNextStep.
    const response = await getNextStep(OPENAI_API_KEY, [], {});
    
    if (response) {
      setMessages(prev => [...prev, response]);
    } else {
       const errorMessage: Message = {
        id: Date.now().toString(),
        sender: 'bot',
        text: "Sorry, I'm having trouble getting started. Please try again later.",
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    setIsTyping(false);
  };
  
  const handleSelection = async (value: string | string[], component: string) => {
    // Rate limiting: check if cooldown period has passed
    const now = Date.now();
    const timeSinceLastRequest = now - lastUserRequestAt.current;
    
    if (lastUserRequestAt.current > 0 && timeSinceLastRequest < COOLDOWN_MS) {
      // Don't add a message or call API - just update cooldown state
      // The UI will show the cooldown banner automatically
      setCooldownRemainingMs(COOLDOWN_MS - timeSinceLastRequest);
      return;
    }
    
    // Update last request timestamp
    lastUserRequestAt.current = now;
    setCooldownRemainingMs(COOLDOWN_MS);
    
    // Parse ingredient selections to create visual display
    let selectedIngredients = undefined;
    let userMessageText = Array.isArray(value) ? value.join(', ') : value;
    
    if (component === 'Dosage' && typeof value === 'string') {
      try {
        const dosageMap = JSON.parse(value);
        const lastBotMessage = messages[messages.length - 1];
        if (lastBotMessage?.ingredients) {
          selectedIngredients = lastBotMessage.ingredients.map(ing => ({
            name: ing.name,
            dosage: dosageMap[ing.name] || ing.suggested,
            unit: ing.unit
          }));
          // Create a readable text version for the chat history
          userMessageText = selectedIngredients.map(ing => `${ing.name}: ${ing.dosage} ${ing.unit}`).join(', ');
        }
      } catch (e) {
        // If parsing fails, fall back to text display
        console.error('Failed to parse ingredient dosages:', e);
      }
    }
    
    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMessageText,
      selectedIngredients,
    };

    // Get previous bot message for context
    const previousBotMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;
    
    // Normalize the value before saving (handle both string and array)
    const valueToNormalize = Array.isArray(value) ? value.join(', ') : value;
    const normalizedValue = normalizeValue(valueToNormalize, component, previousBotMessage);
    
    const newFormula = { ...formula, [component]: normalizedValue };
    setFormula(newFormula);

    const currentHistory = [...conversationHistoryRef.current, newUserMessage];
    setMessages(currentHistory);
    setIsTyping(true);
    
    const response = await getNextStep(OPENAI_API_KEY, currentHistory, newFormula);

    if (response) {
        if (response.isComplete) {
            // Use newFormula which already has the normalized value - do NOT override with raw value
            const finalFormula = { ...newFormula };
            
            // Get stored ingredients from ref (more reliable than searching messages)
            const storedIngredients = ingredientsRef.current;
            console.log('📋 Building summary with', storedIngredients.length, 'stored ingredients');
            
            // Build formula summary from collected data
            let builtFormulaSummary = response.formulaSummary;
            if (!builtFormulaSummary && storedIngredients.length > 0) {
                // Parse dosages if available
                let dosageMap: { [key: string]: number } = {};
                if (finalFormula.Dosage && typeof finalFormula.Dosage === 'string') {
                    try {
                        dosageMap = JSON.parse(finalFormula.Dosage);
                    } catch (e) {}
                }
                
                builtFormulaSummary = {
                    formulaName: finalFormula.FormulaName || 'Custom Formula',
                    deliveryFormat: finalFormula.Format || 'Stick Pack',
                    ingredients: storedIngredients.map(ing => ({
                        name: ing.name,
                        min: ing.min,
                        max: ing.max,
                        suggested: dosageMap[ing.name] || ing.suggested,
                        unit: ing.unit,
                        rationale: ing.rationale
                    })),
                    goal: finalFormula.Goal,
                    sweetener: finalFormula.Sweetener,
                    flavors: finalFormula.Flavors,
                    routine: finalFormula.Routine,
                    lifestyle: finalFormula.Lifestyle,
                    sensitivities: finalFormula.Sensitivities,
                    currentSupplements: finalFormula.CurrentSupplements,
                    experience: finalFormula.Experience
                };
            }
            
            const finalMessage: Message = {
                id: Date.now().toString(),
                sender: 'bot',
                text: response.text,
                formulaSummary: builtFormulaSummary,
            };
            const queryParams = new URLSearchParams();
            
            Object.entries(finalFormula).forEach(([key, val]) => {
                if (!val) return;
                
                // Special handling for Dosage - parse and add individual ingredients with prefix and units
                if (key === 'Dosage' && typeof val === 'string') {
                    try {
                        const dosageMap = JSON.parse(val);
                        const lastBotMessage = messages[messages.length - 1];
                        
                        // Get units from the bot message ingredients
                        const ingredientUnits: { [key: string]: string } = {};
                        if (lastBotMessage?.ingredients) {
                            lastBotMessage.ingredients.forEach(ing => {
                                ingredientUnits[ing.name] = ing.unit;
                            });
                        }
                        
                        Object.entries(dosageMap).forEach(([ingredientName, dosage]) => {
                            // Add "ingredient_" prefix with dosage value and unit combined (e.g., "100mg")
                            const unit = ingredientUnits[ingredientName] || 'mg';
                            queryParams.append(`ingredient_${ingredientName}`, `${dosage}${unit}`);
                        });
                    } catch (e) {
                        // If parsing fails, just append as is
                        queryParams.append(key, val);
                    }
                } else {
                    queryParams.append(key, Array.isArray(val) ? val.join(',') : val);
                }
            });
            
            // Save formula to database and create Shopify product
            (async () => {
                try {
                    const toString = (val: any): string | undefined => 
                        typeof val === 'string' ? val : Array.isArray(val) ? val.join(', ') : undefined;
                    
                    // Save to local database
                    await formulaService.saveFormula({
                        sessionId: sessionIdRef.current,
                        shopifyCustomerId: sessionService.getCustomerId() || undefined,
                        goalComponent: toString(finalFormula.Goal),
                        formatComponent: toString(finalFormula.Format),
                        routineComponent: toString(finalFormula.Routine),
                        lifestyleComponent: toString(finalFormula.Lifestyle),
                        sensitivitiesComponent: toString(finalFormula.Sensitivities),
                        currentSupplementsComponent: toString(finalFormula.CurrentSupplements),
                        experienceComponent: toString(finalFormula.Experience),
                        ingredientsComponent: toString(finalFormula.Ingredients),
                        sweetnessComponent: toString(finalFormula.Sweetness),
                        sweetenerComponent: toString(finalFormula.Sweetener),
                        flavorsComponent: toString(finalFormula.Flavors),
                        formulaNameComponent: toString(finalFormula.FormulaName),
                        formulaData: finalFormula,
                    });
                    console.log('✅ Formula saved to database');
                    
                    // Create checkout with base product in Shopify
                    // Use stored ingredients from ref
                    const ingredients = ingredientsRef.current.map(ing => {
                        let dosageValue = ing.suggested;
                        if (finalFormula.Dosage && typeof finalFormula.Dosage === 'string') {
                            try {
                                const dosageMap = JSON.parse(finalFormula.Dosage);
                                dosageValue = dosageMap[ing.name] || ing.suggested;
                            } catch (e) {}
                        }
                        return {
                            name: ing.name,
                            dosage: dosageValue,
                            unit: ing.unit,
                            rationale: ing.rationale
                        };
                    }) || [];
                    
                    // Pass ALL user data to Shopify
                    const shopifyResponse = await fetch('/api/shopify/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            formulaName: toString(finalFormula.FormulaName) || 'Custom Formula',
                            ingredients,
                            format: toString(finalFormula.Format) || 'Stick Pack',
                            sweetener: toString(finalFormula.Sweetener),
                            flavors: toString(finalFormula.Flavors),
                            goal: toString(finalFormula.Goal),
                            // Include all user profile data
                            routine: toString(finalFormula.Routine),
                            lifestyle: toString(finalFormula.Lifestyle),
                            sensitivities: toString(finalFormula.Sensitivities),
                            currentSupplements: toString(finalFormula.CurrentSupplements),
                            experience: toString(finalFormula.Experience),
                            sessionId: sessionIdRef.current
                        })
                    });
                    
                    const shopifyData = await shopifyResponse.json();
                    
                    // Build checkout summary for in-chat display
                    const checkoutSummaryData = {
                        name: toString(finalFormula.FormulaName) || 'Custom Formula',
                        format: toString(finalFormula.Format) || 'Stick Pack',
                        goal: toString(finalFormula.Goal) || 'Wellness',
                        ingredients: ingredients.map(ing => ({
                            name: ing.name,
                            dosage: ing.dosage,
                            unit: ing.unit
                        })),
                        sweetener: toString(finalFormula.Sweetener),
                        flavors: toString(finalFormula.Flavors),
                        price: shopifyData.price
                    };
                    
                    if (shopifyData.success && shopifyData.checkoutUrl) {
                        console.log('✅ Shopify checkout created:', shopifyData.checkoutUrl);
                        setProceedUrl(shopifyData.checkoutUrl);
                        setCheckoutSummary(checkoutSummaryData);
                    } else {
                        console.error('⚠️ Shopify checkout creation failed:', shopifyData.error);
                        const fallbackUrl = `https://crafftein.myshopify.com/products/customize-crafftein-formula?${queryParams.toString()}`;
                        setProceedUrl(fallbackUrl);
                        setCheckoutSummary({ ...checkoutSummaryData, price: undefined });
                    }
                } catch (error) {
                    console.error('⚠️ Error saving formula:', error);
                    const fallbackUrl = `https://crafftein.myshopify.com/products/customize-crafttein-formula?${queryParams.toString()}`;
                    setProceedUrl(fallbackUrl);
                }
            })();
            
            // Set a temporary URL while Shopify product is being created
            setProceedUrl(null);
            setMessages(prev => [...prev, finalMessage]);

        } else {
            // Store ingredients in ref if this response has them
            if (response.ingredients && response.ingredients.length > 0) {
                ingredientsRef.current = response.ingredients;
                console.log('📦 Stored ingredients in ref:', ingredientsRef.current.length, 'ingredients');
            }
            setMessages(prev => [...prev, response]);
        }
    } else {
        const errorMessage: Message = {
            id: Date.now().toString(),
            sender: 'bot',
            text: "Sorry, I've run into an issue. Please try refreshing.",
        };
        setMessages(prev => [...prev, errorMessage]);
    }
    setIsTyping(false);
  };

  return (
    <div className="w-full h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden">
              <AIBotIcon className="w-10 h-10" />
            </div>
            <div>
              <img src={craffteineLogo} alt="Craffteine" className="h-10 object-contain" />
            </div>
          </div>
          {hasStarted && (
            <button
              onClick={resetChat}
              className="text-gray-600 hover:text-gray-800 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              New Chat
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {!hasStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-6">
            <SparklesIcon className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-800 mb-3">Create Your Custom Formula</h3>
          <p className="text-gray-600 mb-8 text-base max-w-md">
            Let our AI assistant help you build a personalized wellness formula tailored to your goals
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
          >
            Start Chat
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <ChatWindow 
            messages={messages} 
            isTyping={isTyping} 
            onSelection={handleSelection} 
            proceedUrl={proceedUrl}
            cooldownRemainingMs={cooldownRemainingMs}
            formulaSummary={checkoutSummary}
          />
        </div>
      )}
    </div>
  );
};

export default App;
