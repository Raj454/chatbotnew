// Customer lookup and returning customer detection service

export interface CustomerHistory {
  name: string | null;
  email: string;
  formulaCount: number;
  lastFormula: any;
  formulas: any[];
}

export interface CustomerLookupResult {
  isReturningCustomer: boolean;
  data: CustomerHistory | null;
}

const API_BASE = '';

// Look up customer by email to check if they're a returning customer
export async function lookupCustomerByEmail(email: string): Promise<CustomerLookupResult> {
  try {
    const response = await fetch(`${API_BASE}/api/customer/lookup?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    
    if (data.success) {
      return {
        isReturningCustomer: data.isReturningCustomer,
        data: data.data
      };
    }
    
    return { isReturningCustomer: false, data: null };
  } catch (error) {
    console.error('Error looking up customer:', error);
    return { isReturningCustomer: false, data: null };
  }
}

// Generate personalized welcome message for returning customer
export function getReturningCustomerGreeting(history: CustomerHistory): string {
  const name = history.name ? history.name.split(' ')[0] : null;
  
  if (name) {
    if (history.formulaCount === 1) {
      return `Welcome back, ${name}! Great to see you again. Last time you created "${history.lastFormula?.formulaNameComponent || 'your custom formula'}" - shall we build something new today? 💪`;
    } else {
      return `Hey ${name}! You're back! 🎉 You've created ${history.formulaCount} formulas with us. Want to try something new or reorder a favorite?`;
    }
  } else {
    if (history.formulaCount === 1) {
      return `Welcome back! Last time you created "${history.lastFormula?.formulaNameComponent || 'a custom formula'}" - ready for another? 💪`;
    } else {
      return `Hey, welcome back! 🎉 You've made ${history.formulaCount} formulas with us before. Ready to create another?`;
    }
  }
}

// Check if we should ask for email (for new guests)
export function shouldAskForEmail(
  isLoggedIn: boolean, 
  hasEmail: boolean, 
  sessionId: string
): boolean {
  // If logged into Shopify, we'll get email from checkout
  if (isLoggedIn) return false;
  
  // If we already have their email stored, no need to ask
  if (hasEmail) return false;
  
  // Guest without email - we should ask
  return true;
}
