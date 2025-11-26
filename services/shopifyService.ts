import type { Order } from '../types';

export interface ShopifyCredentials {
    domain: string;
    accessToken: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  product_type: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  tags: string;
}

interface ShopifyVariant {
  id?: number;
  title: string;
  price: string;
  sku?: string;
  inventory_quantity?: number;
  requires_shipping?: boolean;
  taxable?: boolean;
  option1?: string;
  option2?: string;
  option3?: string;
}

interface ShopifyImage {
  src: string;
  alt?: string;
}

interface FormulaIngredient {
  name: string;
  dosage: number;
  unit: string;
  rationale?: string;
}

interface CreateProductParams {
  formulaName: string;
  ingredients: FormulaIngredient[];
  format: string;
  sweetener?: string | null;
  flavors?: string | null;
  goal?: string;
  sessionId?: string;
}

const MOCK_ORDERS: Order[] = [
    {
        id: 'gid://shopify/Order/1234567890123',
        name: '#1001',
        date: new Date('2023-10-26T10:00:00Z').toISOString(),
        formula: 'Capsule, 150mg, Citrus Zing, Medium',
    },
    {
        id: 'gid://shopify/Order/2345678901234',
        name: '#1002',
        date: new Date('2023-10-27T11:30:00Z').toISOString(),
        formula: 'Stick Pack, 200mg, Berry Blast, High',
    },
    {
        id: 'gid://shopify/Order/3456789012345',
        name: '#1003',
        date: new Date('2023-10-28T09:15:00Z').toISOString(),
        formula: 'Pod, 100mg, Tropical Fusion, Low',
    },
];

export const getCustomerOrders = async (credentials: ShopifyCredentials): Promise<Order[]> => {
    console.log("Using mock data for Shopify orders. A real implementation requires a backend proxy.");
    await new Promise(resolve => setTimeout(resolve, 500));
    return Promise.resolve(MOCK_ORDERS);
};

const formatIngredientsList = (ingredients: FormulaIngredient[]): string => {
  return ingredients.map(ing => 
    `<li><strong>${ing.name}</strong>: ${ing.dosage}${ing.unit}</li>`
  ).join('\n');
};

const generateProductDescription = (params: CreateProductParams): string => {
  const { ingredients, format, sweetener, flavors, goal } = params;

  let description = `<div class="custom-formula">`;
  description += `<h3>Your Personalized ${goal || 'Wellness'} Formula</h3>`;
  description += `<p><strong>Format:</strong> ${format}</p>`;
  
  if (sweetener) {
    description += `<p><strong>Sweetener:</strong> ${sweetener}</p>`;
  }
  
  if (flavors) {
    description += `<p><strong>Flavors:</strong> ${flavors}</p>`;
  }

  description += `<h4>Ingredients:</h4>`;
  description += `<ul>${formatIngredientsList(ingredients)}</ul>`;
  description += `</div>`;

  return description;
};

const generateSKU = (formulaName: string): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const nameCode = formulaName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 6)
    .toUpperCase();
  return `CRFT-${nameCode}-${timestamp}`;
};

export const shopifyService = {
  async testConnection(storeUrl: string, accessToken: string): Promise<{ success: boolean; message: string; shop?: any }> {
    try {
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
        throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: `Connected to ${result.shop.name}`,
        shop: result.shop
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to connect to Shopify'
      };
    }
  },

  async createProduct(
    storeUrl: string, 
    accessToken: string, 
    params: CreateProductParams
  ): Promise<{ success: boolean; product?: ShopifyProduct; productUrl?: string; error?: string }> {
    try {
      const { formulaName, ingredients, format } = params;
      const cleanUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

      const sku = generateSKU(formulaName);
      const description = generateProductDescription(params);

      const tags = [
        'custom-formula',
        'craffteine',
        format.toLowerCase().replace(/\s+/g, '-'),
        params.goal?.toLowerCase() || 'wellness'
      ].join(', ');

      const productData = {
        product: {
          title: formulaName,
          body_html: description,
          vendor: 'Craffteine',
          product_type: 'Custom Formula',
          tags,
          variants: [
            {
              title: 'Default',
              price: '29.99',
              sku,
              inventory_management: null,
              requires_shipping: true,
              taxable: true
            }
          ],
          options: [
            {
              name: 'Size',
              values: ['30 Servings']
            }
          ]
        }
      };

      const url = `https://${cleanUrl}/admin/api/2024-01/products.json`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify(productData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Shopify API Error:', response.status, errorText);
        throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const productUrl = `https://${cleanUrl}/products/${result.product.handle}`;

      console.log('Shopify product created:', result.product.id, productUrl);

      return {
        success: true,
        product: result.product,
        productUrl
      };
    } catch (error: any) {
      console.error('Failed to create Shopify product:', error);
      return {
        success: false,
        error: error.message || 'Failed to create product'
      };
    }
  },

  async getProducts(
    storeUrl: string, 
    accessToken: string, 
    limit: number = 10
  ): Promise<{ success: boolean; products?: ShopifyProduct[]; error?: string }> {
    try {
      const cleanUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const url = `https://${cleanUrl}/admin/api/2024-01/products.json?limit=${limit}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        products: result.products
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch products'
      };
    }
  }
};
