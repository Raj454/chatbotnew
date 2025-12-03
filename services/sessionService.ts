// Session management for guest and logged-in users
export class SessionService {
  private readonly SESSION_ID_KEY = 'craffteine_session_id';
  private readonly CUSTOMER_ID_KEY = 'craffteine_customer_id';
  private readonly CUSTOMER_EMAIL_KEY = 'craffteine_customer_email';
  private readonly CUSTOMER_NAME_KEY = 'craffteine_customer_name';

  // Initialize from URL params (called when widget loads)
  initFromUrlParams(): void {
    const urlParams = new URLSearchParams(window.location.search);
    
    const customerId = urlParams.get('customer_id');
    const customerEmail = urlParams.get('customer_email');
    const customerName = urlParams.get('customer_name');
    
    if (customerId) {
      this.setCustomerId(customerId);
    }
    if (customerEmail) {
      // URLSearchParams already decodes the value, no need for extra decodeURIComponent
      this.setCustomerEmail(customerEmail);
    }
    if (customerName) {
      // URLSearchParams already decodes the value, no need for extra decodeURIComponent
      this.setCustomerName(customerName);
    }
  }

  // Generate or retrieve session ID for guest users
  getSessionId(): string {
    let sessionId = localStorage.getItem(this.SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(this.SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  }

  // Set Shopify customer ID when user logs in
  setCustomerId(customerId: string): void {
    localStorage.setItem(this.CUSTOMER_ID_KEY, customerId);
  }

  // Get customer ID if user is logged in
  getCustomerId(): string | null {
    return localStorage.getItem(this.CUSTOMER_ID_KEY);
  }

  // Set customer email
  setCustomerEmail(email: string): void {
    localStorage.setItem(this.CUSTOMER_EMAIL_KEY, email);
  }

  // Get customer email
  getCustomerEmail(): string | null {
    return localStorage.getItem(this.CUSTOMER_EMAIL_KEY);
  }

  // Set customer name
  setCustomerName(name: string): void {
    localStorage.setItem(this.CUSTOMER_NAME_KEY, name);
  }

  // Get customer name
  getCustomerName(): string | null {
    return localStorage.getItem(this.CUSTOMER_NAME_KEY);
  }

  // Check if user is logged in (has customer ID from Shopify)
  isLoggedIn(): boolean {
    return !!this.getCustomerId();
  }

  // Check if we have customer email (for returning guest lookup)
  hasEmail(): boolean {
    return !!this.getCustomerEmail();
  }

  // Logout
  logout(): void {
    localStorage.removeItem(this.CUSTOMER_ID_KEY);
    localStorage.removeItem(this.CUSTOMER_EMAIL_KEY);
    localStorage.removeItem(this.CUSTOMER_NAME_KEY);
  }

  // Clear session
  clearSession(): void {
    localStorage.removeItem(this.SESSION_ID_KEY);
    localStorage.removeItem(this.CUSTOMER_ID_KEY);
    localStorage.removeItem(this.CUSTOMER_EMAIL_KEY);
    localStorage.removeItem(this.CUSTOMER_NAME_KEY);
  }
}

export const sessionService = new SessionService();
