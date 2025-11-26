import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';
import { db, seedDatabase } from './db/index.js';
import { ingredients as ingredientsTable, flavors as flavorsTable, formulas as formulasTable, trademarkBlacklist } from './db/schema.js';
import { eq, desc } from 'drizzle-orm';

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

// Get all ingredients
app.get('/api/ingredients', async (req, res) => {
  try {
    const allIngredients = await db.select().from(ingredientsTable);
    res.json({ success: true, data: allIngredients });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch ingredients' });
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

// Save formula
app.post('/api/formulas', apiLimiter, async (req, res) => {
  try {
    const { sessionId, shopifyCustomerId, formulaData, ...components } = req.body;
    
    if (!sessionId || !formulaData) {
      return res.status(400).json({ success: false, error: 'sessionId and formulaData required' });
    }

    const result = await db.insert(formulasTable).values({
      sessionId,
      shopifyCustomerId,
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

    const { formulaName, ingredients, format, sweetener, flavors, goal, sessionId } = req.body;

    if (!formulaName || !ingredients || !format) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: formulaName, ingredients, format' 
      });
    }

    const cleanUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Build formula note text
    const ingredientsList = ingredients.map(ing => 
      `${ing.name}: ${ing.dosage}${ing.unit}`
    ).join(', ');

    let formulaNote = `Formula: ${formulaName}\n`;
    formulaNote += `Format: ${format}\n`;
    formulaNote += `Goal: ${goal || 'Wellness'}\n`;
    if (sweetener) formulaNote += `Sweetener: ${sweetener}\n`;
    if (flavors) formulaNote += `Flavors: ${flavors}\n`;
    formulaNote += `Ingredients: ${ingredientsList}`;

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
      const variantId = productData.product.variants[0]?.id;

      if (!variantId) {
        throw new Error('Base product has no variants');
      }

      // Use cart permalink format: /cart/VARIANT:QTY
      // This creates a new cart and goes to cart page
      // Then we'll use JavaScript in the widget to redirect to checkout
      
      // Encode formula data in cart attributes and note
      const cartNote = encodeURIComponent(formulaNote);
      
      // Build cart permalink with note
      // Format: /cart/VARIANT_ID:QUANTITY?note=FORMULA_NOTE&attributes[key]=value
      const cartParams = new URLSearchParams();
      cartParams.append('note', formulaNote);
      cartParams.append('attributes[formula_name]', formulaName);
      cartParams.append('attributes[format]', format);
      cartParams.append('attributes[goal]', goal || 'Wellness');
      if (sweetener) cartParams.append('attributes[sweetener]', sweetener);
      if (flavors) cartParams.append('attributes[flavors]', flavors);
      cartParams.append('attributes[ingredients]', ingredientsList);
      
      // Cart permalink format goes straight to cart with item
      const checkoutUrl = `https://${cleanUrl}/cart/${variantId}:1?${cartParams.toString()}`;

      console.log('Cart checkout URL created for variant:', variantId);

      res.json({ 
        success: true, 
        checkoutUrl,
        variantId,
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

// Add ingredient
app.post('/api/admin/ingredients', apiLimiter, async (req, res) => {
  try {
    const { name, category, dosageMin, dosageMax, unit, description } = req.body;
    
    if (!name || !category || !dosageMin || !dosageMax) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await db.insert(ingredientsTable).values({
      name,
      category,
      dosageMin: dosageMin.toString(),
      dosageMax: dosageMax.toString(),
      unit: unit || 'mg',
      description
    }).returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error adding ingredient:', error);
    res.status(500).json({ success: false, error: 'Failed to add ingredient' });
  }
});

// Add flavor
app.post('/api/admin/flavors', apiLimiter, async (req, res) => {
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
app.put('/api/admin/flavors/:id', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { inStock } = req.body;

    const result = await db.update(flavorsTable)
      .set({ inStock })
      .where(eq(flavorsTable.id, parseInt(id)))
      .returning();

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Error updating flavor:', error);
    res.status(500).json({ success: false, error: 'Failed to update flavor' });
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
