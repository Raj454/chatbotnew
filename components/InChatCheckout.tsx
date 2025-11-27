import { useState, useEffect, useRef } from 'react';

interface Ingredient {
  name: string;
  dosage: number;
  unit: string;
}

interface InChatCheckoutProps {
  formulaName: string;
  format: string;
  goal: string;
  ingredients: Ingredient[];
  sweetener?: string;
  flavors?: string;
  checkoutUrl: string;
  price?: string;
  onCheckoutComplete?: () => void;
}

export function InChatCheckout({
  formulaName,
  format,
  goal,
  ingredients,
  sweetener,
  flavors,
  checkoutUrl,
  price = '29.99',
  onCheckoutComplete
}: InChatCheckoutProps) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutWindow, setCheckoutWindow] = useState<Window | null>(null);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const checkIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // Listen for postMessage from thank-you page to auto-confirm order
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CRAFFTEINE_ORDER_COMPLETE') {
        // Close the popup if still open
        if (checkoutWindow && !checkoutWindow.closed) {
          checkoutWindow.close();
        }
        // Clear interval
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        // Reset states and trigger confirmation
        setIsCheckingOut(false);
        setCheckoutWindow(null);
        setShowConfirmPrompt(false);
        if (onCheckoutComplete) {
          onCheckoutComplete();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCheckoutComplete, checkoutWindow]);

  const handleCheckout = () => {
    setIsCheckingOut(true);
    setShowConfirmPrompt(false);
    
    const width = 500;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    const popup = window.open(
      checkoutUrl,
      'ShopifyCheckout',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    
    if (!popup || popup.closed) {
      window.open(checkoutUrl, '_blank');
      setIsCheckingOut(false);
      return;
    }
    
    setCheckoutWindow(popup);

    checkIntervalRef.current = window.setInterval(() => {
      if (popup && popup.closed) {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        setIsCheckingOut(false);
        setCheckoutWindow(null);
        setShowConfirmPrompt(true);
      }
    }, 500);
  };

  const handleConfirmYes = () => {
    setShowConfirmPrompt(false);
    if (onCheckoutComplete) {
      onCheckoutComplete();
    }
  };

  const handleConfirmNo = () => {
    setShowConfirmPrompt(false);
  };

  const focusCheckout = () => {
    if (checkoutWindow && !checkoutWindow.closed) {
      checkoutWindow.focus();
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100 shadow-lg max-w-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-800">Ready to Order!</h3>
          <p className="text-xs text-gray-500">Your custom formula</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="font-semibold text-purple-700">{formulaName}</h4>
            <p className="text-xs text-gray-500">{format} • {goal}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-800">${parseFloat(price).toFixed(2)}</p>
            <p className="text-xs text-gray-500">30 Servings</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Your Ingredients:</p>
          <div className="grid grid-cols-2 gap-1">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                <span>{ing.name}</span>
                <span className="text-gray-400">({ing.dosage}{ing.unit})</span>
              </div>
            ))}
          </div>
        </div>

        {(sweetener || flavors) && (
          <div className="border-t border-gray-100 pt-3 mt-3">
            {sweetener && (
              <p className="text-xs text-gray-600">
                <span className="font-medium">Sweetener:</span> {sweetener}
              </p>
            )}
            {flavors && (
              <p className="text-xs text-gray-600">
                <span className="font-medium">Flavors:</span> {flavors}
              </p>
            )}
          </div>
        )}
      </div>

      {showConfirmPrompt ? (
        <div className="space-y-3">
          <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-200">
            <div className="flex items-center justify-center gap-2 text-blue-700 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Did you complete your order?</span>
            </div>
            <p className="text-xs text-blue-600 mb-3">Let us know so we can confirm your purchase</p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmYes}
                className="flex-1 bg-green-500 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-600 transition-all duration-200 text-sm flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Yes, I paid!
              </button>
              <button
                onClick={handleConfirmNo}
                className="flex-1 bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 transition-all duration-200 text-sm"
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      ) : !isCheckingOut ? (
        <button
          onClick={handleCheckout}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Secure Checkout
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-purple-100 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-purple-700">
              <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="font-medium">Checkout in progress...</span>
            </div>
            <p className="text-xs text-purple-600 mt-1">Complete your order in the popup window</p>
          </div>
          
          <button
            onClick={focusCheckout}
            className="w-full bg-white border-2 border-purple-300 text-purple-700 font-medium py-2 px-4 rounded-xl hover:bg-purple-50 transition-all duration-200 text-sm"
          >
            Open Checkout Window
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Secure checkout powered by Shopify</span>
      </div>
    </div>
  );
}
