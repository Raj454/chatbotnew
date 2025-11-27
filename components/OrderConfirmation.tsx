import { useEffect, useState } from 'react';

interface Ingredient {
  name: string;
  dosage: number;
  unit: string;
}

interface OrderConfirmationProps {
  formulaName: string;
  format: string;
  goal: string;
  ingredients: Ingredient[];
  sweetener?: string;
  flavors?: string;
  price?: string;
  onCreateAnother?: () => void;
}

export function OrderConfirmation({
  formulaName,
  format,
  goal,
  ingredients,
  sweetener,
  flavors,
  price = '29.99',
  onCreateAnother
}: OrderConfirmationProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200 shadow-lg max-w-sm relative overflow-hidden">
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-4 text-2xl animate-bounce" style={{ animationDelay: '0ms' }}>🎉</div>
          <div className="absolute top-4 right-6 text-xl animate-bounce" style={{ animationDelay: '150ms' }}>✨</div>
          <div className="absolute top-1 left-1/2 text-lg animate-bounce" style={{ animationDelay: '300ms' }}>🎊</div>
        </div>
      )}
      
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-green-800 text-lg">Order Confirmed!</h3>
          <p className="text-sm text-green-600">Thank you for your order</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h4 className="font-semibold text-gray-800">{formulaName}</h4>
            <p className="text-xs text-gray-500">{format} • {goal}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-600">${parseFloat(price).toFixed(2)}</p>
            <p className="text-xs text-gray-500">30 Servings</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Your Ingredients:</p>
          <div className="grid grid-cols-2 gap-1">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
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

      <div className="bg-green-100 rounded-xl p-3 mb-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-green-700">
            <p className="font-medium">What's next?</p>
            <p className="text-xs mt-1">You'll receive an email confirmation shortly. Your custom formula will be crafted and shipped within 3-5 business days.</p>
          </div>
        </div>
      </div>

      {onCreateAnother && (
        <button
          onClick={onCreateAnother}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Another Formula
        </button>
      )}

      <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span>Check your email for order details</span>
      </div>
    </div>
  );
}
