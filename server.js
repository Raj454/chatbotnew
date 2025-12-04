import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';
import { db, seedDatabase } from './db/index.js';
import { ingredients as ingredientsTable, flavors as flavorsTable, sweeteners as sweetenersTable, formulas as formulasTable, trademarkBlacklist, settings as settingsTable, blends as blendsTable } from './db/schema.js';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';

// Admin session storage (in-memory for simplicity, consider using Redis in production)
const adminSessions = new Map();

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy: required for rate limiting behind reverse proxies (Render, Cloudflare, etc.)
// This ensures rate limits apply per-user IP, not per-proxy IP
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Server-side rate limiting: prevent API abuse and protect OpenAI quota
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Max 20 requests per minute per IP
  message: { 
    success: false, 
    error: 'Too many requests, please wait a moment before trying again',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
});

// Serve static files from the dist folder (production build)
app.use(express.static(join(__dirname, 'dist')));

// API Routes
app.get('/api/search', apiLimiter, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    
    if (!apiKey) {
      console.error('BRAVE_SEARCH_API_KEY not found in environment');
      return res.status(500).json({ error: 'Search API not configured' });
    }

    const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=3`;
    
    const response = await fetch(braveUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      }
    });

    if (!response.ok) {
      console.error(`Brave API error: ${response.status}`);
      throw new Error(`Search failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.web?.results && data.web.results.length > 0) {
      const topResults = data.web.results.slice(0, 3);
      const formattedResults = topResults
        .map((result, index) => {
          const title = result.title || 'No title';
          const description = result.description || 'No description';
          return `${index + 1}. ${title}\n   ${description}`;
        })
        .join('\n\n');
      
      return res.json({ 
        success: true, 
        data: formattedResults 
      });
    }
    
    return res.json({ 
      success: false, 
      error: `No search results found for "${q}"` 
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Web search temporarily unavailable' 
    });
  }
});

// ============ DATABASE API ROUTES ============

// Get all ingredients (public - for AI chatbot)
app.get('/api/ingredients', async (req, res) => {
  try {
    const allIngredients = await db.select().from(ingredientsTable);
    res.json({ success: true, data: allIngredients });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ingredients' });
  }
});

// Get all blends (public - for AI chatbot)
app.get('/api/admin/blends-public', async (req, res) => {
  try {
    const allBlends = await db.select().from(blendsTable);
    res.json({ success: true, data: allBlends });
  } catch (error) {
    console.error('Error fetching blends:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blends' });
  }
});

// Get all flavors
app.get('/api/flavors', async (req, res) => {
  try {
    const allFlavors = await db.select().from(flavorsTable).where(flavorsTable.inStock === true);
    res.json({ success: true, data: allFlavors });
  } catch (error) {
    console.error('Error fetching flavors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flavors' });
  }
});

// Get all sweeteners (public - for AI chatbot)
app.get('/api/sweeteners', async (req, res) => {
  try {
    const allSweeteners = await db.select().from(sweetenersTable);
    res.json({ success: true, data: allSweeteners });
  } catch (error) {
    console.error('Error fetching sweeteners:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sweeteners' });
  }
});

// Get bot instructions (public - for AI chatbot)
// This returns the custom instructions set via Admin Panel
app.get('/api/settings/bot_instructions', async (req, res) => {
  try {
    const result = await db.select().from(settingsTable).where(eq(settingsTable.key, 'bot_instructions'));
    if (result.length > 0) {
      res.json({ success: true, value: result[0].value });
    } else {
      res.json({ success: true, value: null });
    }
  } catch (error) {
    console.error('Error fetching bot instructions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bot instructions' });
  }
});

// Save formula
app.post('/api/formulas', apiLimiter, async (req, res) => {
  try {
    const { sessionId, shopifyCustomerId, customerEmail, customerName, formulaData, ...components } = req.body;
    
    if (!sessionId || !formulaData) {
      return res.status(400).json({ success: false, error: 'sessionId and formulaData required' });
    }

    // Normalize email for consistent lookups (lowercase, trimmed)
    const normalizedEmail = customerEmail ? customerEmail.toLowerCase().trim() : null;

    const result = await db.insert(formulasTable).values({
      sessionId,
      shopifyCustomerId,
      customerEmail: normalizedEmail,
      customerName,
      formulaData: JSON.stringify(formulaData),
      ...components
    }).returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error saving formula:', error);
    res.status(500).json({ success: false, error: 'Failed to save formula' });
  }
});

// Get formula by session ID
app.get('/api/formulas/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const formula = await db.select().from(formulasTable)
      .where(eq(formulasTable.sessionId, sessionId))
      .orderBy(desc(formulasTable.createdAt))
      .limit(1);

    if (formula.length === 0) {
      return res.status(404).json({ success: false, error: 'Formula not found' });
    }

    res.json({ success: true, data: formula[0] });
  } catch (error) {
    console.error('Error fetching formula:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch formula' });
  }
});

// Get formula by numeric ID (for reorder feature)
app.get('/api/formula/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const formulaId = parseInt(id, 10);
    
    if (isNaN(formulaId)) {
      return res.status(400).json({ success: false, error: 'Invalid formula ID' });
    }
    
    const formula = await db.select().from(formulasTable)
      .where(eq(formulasTable.id, formulaId))
      .limit(1);

    if (formula.length === 0) {
      return res.status(404).json({ success: false, error: 'Formula not found' });
    }

    res.json({ success: true, data: formula[0] });
  } catch (error) {
    console.error('Error fetching formula by ID:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch formula' });
  }
});

// Get formulas by Shopify customer ID
app.get('/api/formulas/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const formulas = await db.select().from(formulasTable)
      .where(eq(formulasTable.shopifyCustomerId, customerId))
      .orderBy(desc(formulasTable.createdAt));

    res.json({ success: true, data: formulas });
  } catch (error) {
    console.error('Error fetching customer formulas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch formulas' });
  }
});

// Look up returning customer by email (for guests who ordered before)
app.get('/api/customer/lookup', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    // Find all formulas with this email
    const formulas = await db.select().from(formulasTable)
      .where(eq(formulasTable.customerEmail, email.toLowerCase().trim()))
      .orderBy(desc(formulasTable.createdAt));
    
    if (formulas.length === 0) {
      return res.json({ 
        success: true, 
        isReturningCustomer: false,
        data: null 
      });
    }
    
    // Get the customer name from most recent order (if available)
    const customerName = formulas[0].customerName || null;
    
    // Return summary of their history
    res.json({ 
      success: true, 
      isReturningCustomer: true,
      data: {
        name: customerName,
        email: email,
        formulaCount: formulas.length,
        lastFormula: formulas[0],
        formulas: formulas.slice(0, 5) // Last 5 formulas
      }
    });
  } catch (error) {
    console.error('Error looking up customer:', error);
    res.status(500).json({ success: false, error: 'Failed to look up customer' });
  }
});

// Check formula name (trademark + database)
app.get('/api/trademark/check/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const nameLower = name.toLowerCase().trim();

    // Check database for existing formula names
    const existingFormula = await db.select().from(formulasTable)
      .where(formulasTable.formulaNameComponent === name)
      .limit(1);

    if (existingFormula.length > 0) {
      return res.json({ 
        success: true, 
        available: false, 
        reason: 'Name already used in your formulas',
        suggestions: []
      });
    }

    // Check trademark blacklist
    const trademarked = await db.select().from(trademarkBlacklist)
      .where(trademarkBlacklist.keyword === name)
      .limit(1);

    if (trademarked.length > 0) {
      return res.json({ 
        success: true, 
        available: false, 
        reason: trademarked[0].reason,
        suggestions: []
      });
    }

    res.json({ success: true, available: true });
  } catch (error) {
    console.error('Error checking trademark:', error);
    res.status(500).json({ success: false, error: 'Failed to check name availability' });
  }
});

// ============ SHOPIFY API ROUTES ============

// Get base product info (including price)
app.get('/api/shopify/base-product', apiLimiter, async (req, res) => {
  try {
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const baseProductId = process.env.SHOPIFY_BASE_PRODUCT_ID;

    if (!storeUrl || !accessToken || !baseProductId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shopify credentials or base product not configured' 
      });
    }

    const cleanUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const productUrl = `https://${cleanUrl}/admin/api/2024-01/products/${baseProductId}.json`;

    const response = await fetch(productUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch base product: ${response.status}`);
    }

    const data = await response.json();
    const product = data.product;
    const variant = product.variants[0];

    res.json({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        price: variant?.price || '29.99',
        variantId: variant?.id,
        compareAtPrice: variant?.compare_at_price
      }
    });
  } catch (error) {
    console.error('Error fetching base product:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch base product' 
    });
  }
});

// Test Shopify connection
app.get('/api/shopify/test', apiLimiter, async (req, res) => {
  try {
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!storeUrl || !accessToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shopify credentials not configured' 
      });
    }

    const cleanUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `https://${cleanUrl}/admin/api/2024-01/shop.json`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    res.json({ 
      success: true, 
      message: `Connected to ${data.shop.name}`,
      shop: {
        name: data.shop.name,
        domain: data.shop.domain,
        email: data.shop.email
      }
    });
  } catch (error) {
    console.error('Shopify connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to connect to Shopify' 
    });
  }
});

// Create checkout with base product and formula notes
app.post('/api/shopify/checkout', apiLimiter, async (req, res) => {
  try {
    const storeUrl = process.env.SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const baseProductId = process.env.SHOPIFY_BASE_PRODUCT_ID;

    if (!storeUrl || !accessToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Shopify credentials not configured' 
      });
    }

    const { 
      formulaName, ingredients, format, sweetener, flavors, goal, 
      routine, lifestyle, sensitivities, currentSupplements, experience,
      sessionId,
      returnUrl
    } = req.body;

    if (!formulaName || !format) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: formulaName, format' 
      });
    }

    const cleanUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Build ingredients list from array
    const ingredientsList = (ingredients && ingredients.length > 0) 
      ? ingredients.map(ing => `${ing.name}: ${ing.dosage}${ing.unit}`).join(', ')
      : '';

    // Build comprehensive formula note with all user data
    let formulaNote = `=== CUSTOM FORMULA ORDER ===\n\n`;
    formulaNote += `Formula Name: ${formulaName}\n`;
    formulaNote += `Format: ${format}\n`;
    formulaNote += `Goal: ${goal || 'Wellness'}\n\n`;
    
    // User Profile
    formulaNote += `--- USER PROFILE ---\n`;
    if (routine) formulaNote += `Daily Routine: ${routine}\n`;
    if (lifestyle) formulaNote += `Lifestyle: ${lifestyle}\n`;
    if (sensitivities) formulaNote += `Sensitivities: ${sensitivities}\n`;
    if (currentSupplements) formulaNote += `Current Supplements: ${currentSupplements}\n`;
    if (experience) formulaNote += `Experience Level: ${experience}\n`;
    
    // Formula Details
    formulaNote += `\n--- FORMULA DETAILS ---\n`;
    if (ingredientsList) formulaNote += `Ingredients: ${ingredientsList}\n`;
    if (sweetener) formulaNote += `Sweetener: ${sweetener}\n`;
    if (flavors) formulaNote += `Flavors: ${flavors}\n`;

    // If base product ID is set, create cart URL with line item properties
    if (baseProductId) {
      // First, get the base product's variant ID
      const productUrl = `https://${cleanUrl}/admin/api/2024-01/products/${baseProductId}.json`;
      const productResponse = await fetch(productUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        }
      });

      if (!productResponse.ok) {
        throw new Error('Base product not found');
      }

      const productData = await productResponse.json();
      const variant = productData.product.variants[0];
      const variantId = variant?.id;
      const productPrice = variant?.price || '29.99';

      if (!variantId) {
        throw new Error('Base product has no variants');
      }

      // Use /cart/add format which stays on cart page after adding item
      // Line item properties are attached to the product in cart
      const cartParams = new URLSearchParams();
      cartParams.append('id', variantId.toString());
      cartParams.append('quantity', '1');
      
      // Add ALL formula details as line item properties (shown on cart/checkout/order)
      cartParams.append('properties[Formula Name]', formulaName);
      cartParams.append('properties[Format]', format);
      cartParams.append('properties[Goal]', goal || 'Wellness');
      
      // User Profile
      if (routine) cartParams.append('properties[Daily Routine]', routine);
      if (lifestyle) cartParams.append('properties[Lifestyle]', lifestyle);
      if (sensitivities) cartParams.append('properties[Sensitivities]', sensitivities);
      if (currentSupplements) cartParams.append('properties[Current Supplements]', currentSupplements);
      if (experience) cartParams.append('properties[Experience Level]', experience);
      
      // Formula ingredients - each as separate property for better display
      if (ingredients && ingredients.length > 0) {
        ingredients.forEach((ing, index) => {
          const dosageValue = `${ing.dosage}${ing.unit || 'mg'}`;
          cartParams.append(`properties[Ingredient ${index + 1}]`, `${ing.name} - ${dosageValue}`);
        });
      }
      
      // Sweetener and flavors
      if (sweetener) cartParams.append('properties[Sweetener]', sweetener);
      if (flavors) cartParams.append('properties[Flavors]', flavors);
      
      // Build properties string for cart permalink (Base64 encoded)
      const propertiesObj = {};
      propertiesObj['Formula Name'] = formulaName;
      propertiesObj['Format'] = format;
      propertiesObj['Goal'] = goal || 'Wellness';
      if (routine) propertiesObj['Daily Routine'] = routine;
      if (lifestyle) propertiesObj['Lifestyle'] = lifestyle;
      if (sensitivities) propertiesObj['Sensitivities'] = sensitivities;
      if (currentSupplements) propertiesObj['Current Supplements'] = currentSupplements;
      if (experience) propertiesObj['Experience Level'] = experience;
      if (ingredients && ingredients.length > 0) {
        ingredients.forEach((ing, index) => {
          propertiesObj[`Ingredient ${index + 1}`] = `${ing.name} - ${ing.dosage}${ing.unit || 'mg'}`;
        });
      }
      if (sweetener) propertiesObj['Sweetener'] = sweetener;
      if (flavors) propertiesObj['Flavors'] = flavors;
      
      // Encode properties as Base64 for cart permalink
      const propertiesBase64 = Buffer.from(JSON.stringify(propertiesObj)).toString('base64');
      
      // Use cart permalink format with properties - this goes to cart page with item added
      let checkoutUrl = `https://${cleanUrl}/cart/${variantId}:1?properties=${propertiesBase64}`;
      
      // Add return URL for post-checkout redirect
      // Priority: 1) Request body returnUrl, 2) Environment variable, 3) None
      const finalReturnUrl = returnUrl || process.env.SHOPIFY_RETURN_URL;
      if (finalReturnUrl) {
        // Append order_complete parameter if not already present
        let returnWithParam = finalReturnUrl;
        if (!returnWithParam.includes('order_complete=')) {
          returnWithParam += (returnWithParam.includes('?') ? '&' : '?') + 'order_complete=true';
        }
        checkoutUrl += `&checkout[return_to]=${encodeURIComponent(returnWithParam)}`;
      }

      console.log('Cart checkout URL created for variant:', variantId);

      res.json({ 
        success: true, 
        checkoutUrl,
        variantId,
        price: productPrice,
        formulaNote
      });
    } else {
      // Fallback: redirect to base product with formula as URL params
      const baseProductHandle = process.env.SHOPIFY_BASE_PRODUCT_HANDLE || 'customize-crafftein-formula';
      const params = new URLSearchParams();
      params.append('formula_name', formulaName);
      params.append('format', format);
      params.append('goal', goal || 'Wellness');
      if (sweetener) params.append('sweetener', sweetener);
      if (flavors) params.append('flavors', flavors);
      ingredients.forEach(ing => {
        params.append(`ingredient_${ing.name}`, `${ing.dosage}${ing.unit}`);
      });

      const checkoutUrl = `https://${cleanUrl}/products/${baseProductHandle}?${params.toString()}`;

      console.log('Redirecting to base product:', checkoutUrl);

      res.json({ 
        success: true, 
        checkoutUrl,
        formulaNote
      });
    }
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create checkout' 
    });
  }
});

// ============ ADMIN PANEL ROUTES ============

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!adminSessions.has(token)) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
  
  next();
};

// Admin login
app.post('/api/admin/login', apiLimiter, (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    return res.status(500).json({ success: false, error: 'Admin password not configured' });
  }
  
  if (password !== adminPassword) {
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }
  
  // Generate session token
  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, { createdAt: Date.now() });
  
  // Clean up old sessions (older than 24 hours)
  const ONE_DAY = 24 * 60 * 60 * 1000;
  for (const [key, value] of adminSessions.entries()) {
    if (Date.now() - value.createdAt > ONE_DAY) {
      adminSessions.delete(key);
    }
  }
  
  res.json({ success: true, token });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    adminSessions.delete(token);
  }
  res.json({ success: true });
});

// Verify admin session
app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ success: true });
});

// Get all settings
app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await db.select().from(settingsTable);
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// Get single setting by key
app.get('/api/admin/settings/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const result = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }
    
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch setting' });
  }
});

// Update setting
app.put('/api/admin/settings/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!value) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }
    
    const result = await db.update(settingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(settingsTable.key, key))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }
    
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ success: false, error: 'Failed to update setting' });
  }
});

// Get all ingredients (for admin)
app.get('/api/admin/ingredients', requireAdmin, async (req, res) => {
  try {
    const ingredients = await db.select().from(ingredientsTable);
    res.json({ success: true, data: ingredients });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ingredients' });
  }
});

// Get all flavors (for admin)
app.get('/api/admin/flavors', requireAdmin, async (req, res) => {
  try {
    const flavors = await db.select().from(flavorsTable);
    res.json({ success: true, data: flavors });
  } catch (error) {
    console.error('Error fetching flavors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flavors' });
  }
});

// Get all formulas (for admin)
app.get('/api/admin/formulas', requireAdmin, async (req, res) => {
  try {
    const formulas = await db.select().from(formulasTable).orderBy(desc(formulasTable.createdAt));
    res.json({ success: true, data: formulas });
  } catch (error) {
    console.error('Error fetching formulas:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch formulas' });
  }
});

// Add ingredient
app.post('/api/admin/ingredients', requireAdmin, async (req, res) => {
  try {
    const { name, blend, dosageMin, dosageMax, dosageSuggested, unit, description } = req.body;
    
    if (!name || !blend || !dosageMin || !dosageMax) {
      return res.status(400).json({ success: false, error: 'Missing required fields (name, blend, dosageMin, dosageMax)' });
    }

    const result = await db.insert(ingredientsTable).values({
      name,
      blend,
      dosageMin: dosageMin.toString(),
      dosageMax: dosageMax.toString(),
      dosageSuggested: dosageSuggested ? dosageSuggested.toString() : null,
      unit: unit || 'mg',
      description,
      inStock: true
    }).returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error adding ingredient:', error);
    res.status(500).json({ success: false, error: 'Failed to add ingredient' });
  }
});

// Update ingredient
app.put('/api/admin/ingredients/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, blend, dosageMin, dosageMax, dosageSuggested, unit, description, inStock } = req.body;

    // Build update object with only defined values
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (blend !== undefined) updateData.blend = blend;
    if (dosageMin !== undefined) updateData.dosageMin = dosageMin.toString();
    if (dosageMax !== undefined) updateData.dosageMax = dosageMax.toString();
    if (dosageSuggested !== undefined) updateData.dosageSuggested = dosageSuggested ? dosageSuggested.toString() : null;
    if (unit !== undefined) updateData.unit = unit;
    if (description !== undefined) updateData.description = description;
    if (inStock !== undefined) updateData.inStock = inStock;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const result = await db.update(ingredientsTable)
      .set(updateData)
      .where(eq(ingredientsTable.id, parseInt(id)))
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error updating ingredient:', error);
    res.status(500).json({ success: false, error: 'Failed to update ingredient' });
  }
});

// Delete ingredient
app.delete('/api/admin/ingredients/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(ingredientsTable).where(eq(ingredientsTable.id, parseInt(id)));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting ingredient:', error);
    res.status(500).json({ success: false, error: 'Failed to delete ingredient' });
  }
});

// Add flavor
app.post('/api/admin/flavors', requireAdmin, async (req, res) => {
  try {
    const { name, inStock } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Flavor name required' });
    }

    const result = await db.insert(flavorsTable).values({
      name,
      inStock: inStock !== false
    }).returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error adding flavor:', error);
    res.status(500).json({ success: false, error: 'Failed to add flavor' });
  }
});

// Update flavor status
app.put('/api/admin/flavors/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, inStock } = req.body;

    const result = await db.update(flavorsTable)
      .set({ name, inStock })
      .where(eq(flavorsTable.id, parseInt(id)))
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error updating flavor:', error);
    res.status(500).json({ success: false, error: 'Failed to update flavor' });
  }
});

// Delete flavor
app.delete('/api/admin/flavors/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(flavorsTable).where(eq(flavorsTable.id, parseInt(id)));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting flavor:', error);
    res.status(500).json({ success: false, error: 'Failed to delete flavor' });
  }
});

// ============ SWEETENERS ADMIN ROUTES ============

// Get all sweeteners (for admin)
app.get('/api/admin/sweeteners', requireAdmin, async (req, res) => {
  try {
    const sweeteners = await db.select().from(sweetenersTable);
    res.json({ success: true, data: sweeteners });
  } catch (error) {
    console.error('Error fetching sweeteners:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sweeteners' });
  }
});

// Add sweetener
app.post('/api/admin/sweeteners', requireAdmin, async (req, res) => {
  try {
    const { name, description, inStock } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Sweetener name required' });
    }

    const result = await db.insert(sweetenersTable).values({
      name,
      description: description || null,
      inStock: inStock !== false
    }).returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error adding sweetener:', error);
    res.status(500).json({ success: false, error: 'Failed to add sweetener' });
  }
});

// Update sweetener
app.put('/api/admin/sweeteners/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, inStock } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (inStock !== undefined) updateData.inStock = inStock;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const result = await db.update(sweetenersTable)
      .set(updateData)
      .where(eq(sweetenersTable.id, parseInt(id)))
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error updating sweetener:', error);
    res.status(500).json({ success: false, error: 'Failed to update sweetener' });
  }
});

// Delete sweetener
app.delete('/api/admin/sweeteners/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(sweetenersTable).where(eq(sweetenersTable.id, parseInt(id)));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting sweetener:', error);
    res.status(500).json({ success: false, error: 'Failed to delete sweetener' });
  }
});

// ========== BLENDS ADMIN ENDPOINTS ==========

// Get all blends (public - for ingredients dropdown)
app.get('/api/blends', async (req, res) => {
  try {
    const allBlends = await db.select().from(blendsTable).orderBy(blendsTable.displayOrder);
    res.json({ success: true, data: allBlends });
  } catch (error) {
    console.error('Error fetching blends:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blends' });
  }
});

// Get all blends (for admin)
app.get('/api/admin/blends', requireAdmin, async (req, res) => {
  try {
    const blends = await db.select().from(blendsTable).orderBy(blendsTable.displayOrder);
    res.json({ success: true, data: blends });
  } catch (error) {
    console.error('Error fetching blends:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blends' });
  }
});

// Add new blend
app.post('/api/admin/blends', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Blend name is required' });
    }
    const maxOrder = await db.select().from(blendsTable).orderBy(blendsTable.displayOrder);
    const nextOrder = maxOrder.length > 0 ? Math.max(...maxOrder.map(b => b.displayOrder)) + 1 : 1;
    
    const result = await db.insert(blendsTable).values({
      name,
      displayOrder: nextOrder
    }).returning();
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error adding blend:', error);
    res.status(500).json({ success: false, error: 'Failed to add blend' });
  }
});

// Update blend
app.put('/api/admin/blends/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Blend name is required' });
    }

    const result = await db.update(blendsTable)
      .set({ name })
      .where(eq(blendsTable.id, parseInt(id)))
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error updating blend:', error);
    res.status(500).json({ success: false, error: 'Failed to update blend' });
  }
});

// Delete blend (with server-side protection for assigned ingredients)
app.delete('/api/admin/blends/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First, get the blend name to check for assigned ingredients
    const blend = await db.select().from(blendsTable).where(eq(blendsTable.id, parseInt(id))).limit(1);
    if (blend.length === 0) {
      return res.status(404).json({ success: false, error: 'Blend not found' });
    }
    
    // Check if any ingredients are assigned to this blend
    const assignedIngredients = await db.select().from(ingredientsTable).where(eq(ingredientsTable.blend, blend[0].name));
    if (assignedIngredients.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot delete "${blend[0].name}" - ${assignedIngredients.length} ingredient(s) are assigned to it. Please reassign or delete those ingredients first.` 
      });
    }
    
    await db.delete(blendsTable).where(eq(blendsTable.id, parseInt(id)));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting blend:', error);
    res.status(500).json({ success: false, error: 'Failed to delete blend' });
  }
});

// Serve the React app for all non-API routes (must be last)
app.use((req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, async () => {
  try {
    await seedDatabase();
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Serving frontend from: ${join(__dirname, 'dist')}`);
  } catch (error) {
    console.error('❌ Server initialization error:', error);
    process.exit(1);
  }
});
