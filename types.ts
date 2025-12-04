export type Sender = 'user' | 'bot';

export interface Ingredient {
  name: string;
  min: number;
  max: number;
  suggested: number;
  unit: string;
  rationale: string;
}

export interface FormulaSummary {
  ingredients: Ingredient[];
  deliveryFormat?: string;
  formulaName?: string;
  safetyNote?: string;
  redirectUrl: string;
}

export interface SelectedIngredient {
  name: string;
  dosage: number;
  unit: string;
}

export interface SavedFormula {
  id: number;
  name: string;
  createdAt: string;
  goal?: string;
  format?: string;
  formulaData?: string;
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  inputType?: 'options' | 'multiselect' | 'slider' | 'text' | 'ingredient_sliders';
  options?: string[];
  sliderConfig?: SliderConfig;
  ingredients?: Ingredient[];
  selectedIngredients?: SelectedIngredient[]; // User's selected ingredients with dosages
  component?: string; // e.g., 'Format', 'Goal', 'Preferences', 'Ingredients', 'Dosage', 'FormulaName'
  isComplete?: boolean;
  formulaSummary?: FormulaSummary;
  pendingConfirmation?: boolean; // Whether bot is awaiting confirmation for extracted value
  extractedValue?: string; // The value bot extracted and is asking for confirmation
  collectEmail?: boolean; // Whether to show email input for returning customer check
  savedFormulas?: SavedFormula[]; // List of saved formulas for returning customers
}

export interface SliderConfig {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  unit: string;
  recommendedValue?: number;
}

export interface Formula {
  Format?: string;
  Goal?: string;
  Preferences?: string;
  Ingredients?: string | string[];
  Dosage?: string;
  FormulaName?: string;
  [key: string]: string | string[] | undefined;
}

// This is not used in the current workflow but kept for potential future use
export interface Order {
    id: string;
    name: string;
    date: string;
    formula: string;
}
