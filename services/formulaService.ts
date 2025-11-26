// API service for formula CRUD operations
export interface FormulaData {
  sessionId: string;
  shopifyCustomerId?: string;
  goalComponent?: string;
  formatComponent?: string;
  routineComponent?: string;
  lifestyleComponent?: string;
  sensitivitiesComponent?: string;
  currentSupplementsComponent?: string;
  experienceComponent?: string;
  ingredientsComponent?: string;
  sweetnessComponent?: string;
  sweetenerComponent?: string;
  flavorsComponent?: string;
  formulaNameComponent?: string;
  formulaData: any;
}

export class FormulaService {
  private baseUrl = '/api';

  // Save formula to database
  async saveFormula(data: FormulaData): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/formulas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save formula');
      return await res.json();
    } catch (error) {
      console.error('Error saving formula:', error);
      throw error;
    }
  }

  // Get formula by session ID
  async getFormulaBySession(sessionId: string): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/formulas/${sessionId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch formula');
      const data = await res.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching formula:', error);
      return null;
    }
  }

  // Get formulas by customer ID
  async getFormulasByCustomer(customerId: string): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/formulas/customer/${customerId}`);
      if (!res.ok) throw new Error('Failed to fetch customer formulas');
      const data = await res.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching customer formulas:', error);
      return [];
    }
  }

  // Check if formula name is available
  async checkNameAvailability(name: string): Promise<{ available: boolean; reason?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/trademark/check/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error('Failed to check name availability');
      const data = await res.json();
      return {
        available: data.available,
        reason: data.reason,
      };
    } catch (error) {
      console.error('Error checking name availability:', error);
      return { available: false, reason: 'Unable to check availability' };
    }
  }

  // Get all ingredients
  async getIngredients(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/ingredients`);
      if (!res.ok) throw new Error('Failed to fetch ingredients');
      const data = await res.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      return [];
    }
  }

  // Get all flavors
  async getFlavors(): Promise<any[]> {
    try {
      const res = await fetch(`${this.baseUrl}/flavors`);
      if (!res.ok) throw new Error('Failed to fetch flavors');
      const data = await res.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching flavors:', error);
      return [];
    }
  }
}

export const formulaService = new FormulaService();
