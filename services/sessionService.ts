// Session management for guest and logged-in users
export class SessionService {
  private readonly SESSION_ID_KEY = 'craffteine_session_id';
  private readonly CUSTOMER_ID_KEY = 'craffteine_customer_id';

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

  // Check if user is logged in
  isLoggedIn(): boolean {
    return !!this.getCustomerId();
  }

  // Logout
  logout(): void {
    localStorage.removeItem(this.CUSTOMER_ID_KEY);
  }

  // Clear session
  clearSession(): void {
    localStorage.removeItem(this.SESSION_ID_KEY);
    localStorage.removeItem(this.CUSTOMER_ID_KEY);
  }
}

export const sessionService = new SessionService();
