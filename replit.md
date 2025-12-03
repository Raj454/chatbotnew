# Craffteine Assistant Chatbot

## Overview

The Craffteine Assistant is an AI-powered chatbot designed to guide users in creating personalized energy supplement blends. It facilitates a structured conversation to configure custom formulas by selecting format, ingredients, dosage, and blend naming. The application functions as a standalone React app embeddable into a Shopify store, serving as an interactive product configurator. The project aims to provide a seamless and intelligent user experience for custom supplement creation, leveraging AI for dynamic formula generation and dosage personalization. It includes a password-protected admin panel for managing bot instructions, flavors, ingredients, sweeteners, and blend categories, allowing for dynamic updates without code changes. The system integrates with Shopify for automatic product creation and features an in-chat checkout process.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The frontend is a React 18 and TypeScript application, styled with Tailwind CSS. It features a modular component structure for various interactive elements like `OptionButton`, `MultiSelectOptions`, `RangeSlider`, and `InlineTextInput`. The UI clearly identifies the assistant as "Craffteine AI Assistant" with an SVG-based AI symbol and gradient purple-pink badging, avoiding anthropomorphic branding. A client-side rate-limiting cooldown with a visual progress bar ensures a smooth user experience during rapid interactions.

### Technical Implementations

**Frontend:**
- Built with React 18 and TypeScript.
- Uses Vite for development and bundling.
- Styling with Tailwind CSS (CDN).
- State management primarily with React hooks.

**Backend:**
- Lightweight Express.js server (`server.js`) on port 3001.
- Securely proxies API requests (e.g., Brave Search API) to prevent key exposure and handle CORS.
- Environment variables managed via `.env`.

**Chatbot Core Logic:**
- **Conversation Flow:** Intelligent, adaptive flow covering Goal, Format, Routine, Lifestyle, Sensitivities, Current Supplements, Experience, Formula Building (AI-generated 3-6 ingredients with dosage ranges), Sweetener/Flavors (for Stick Pack), Formula Naming, and Finalization with Shopify redirect.
- **AI Personalization:** Uses GPT-4o-mini to analyze user profiles for ingredient suggestions and dosage personalization, applying a dosage rubric (e.g., beginner users receive 40-60% of the range). Safety validation clamps dosages within predefined min/max ranges.
- **Conversation Memory & Context:** Implements a "Prime Directive" system to maintain focus on formula building. The AI briefly answers off-topic questions (1 sentence max) and immediately returns to the exact component it was previously addressing, ensuring continuity and preventing premature advancement.
- **Rate Limiting:** Dual-layer rate limiting: 4-second client-side cooldown between messages and server-side `express-rate-limit` (20 requests/minute per IP). User-friendly error messages for rate limit and other API issues.
- **Bot Instructions System:** Configurable via an Admin Panel (database) for simple changes (tone, greeting, goals, safety flags, synergies) and a dedicated config file (`config/botInstructions.ts`) for detailed logic (conversation flow, JSON format, dosage rules).
- **In-Chat Checkout:** Features an `InChatCheckout` component with an order summary, dynamic pricing from Shopify, a "Secure Checkout" button that opens Shopify checkout in a popup/new tab, and a post-checkout confirmation prompt leading to an `OrderConfirmation` component.

### System Design Choices

**Data Management:**
- **Database:** PostgreSQL with Drizzle ORM.
  - `formulas`: Stores user formulas.
  - `ingredients`: Catalog of supplement ingredients with dosage ranges.
  - `flavors`: Flavor options for Stick Pack format.
  - `sweeteners`: Sweetener options.
  - `blends`: Categories for organizing ingredients (e.g., SLEEP+, RECOVERY+).
  - `settings`: Stores bot instructions and other configurations.
- **Session Management:** Auto-generated UUID session IDs for guests, stored in `localStorage`. Future Shopify customer ID tracking. Formulas are auto-saved and auto-loaded.
- **Inventory Service:** `services/inventoryService.ts` handles stock data from the database, dynamically integrated into the AI's context for real-time availability.

**Admin Panel (`/admin`):**
- Password-protected access.
- **Bot Instructions Editor:** Edit AI behavior and personality.
- **Flavors Manager:** Add/remove flavors, toggle stock status.
- **Ingredients Manager:** Organized by blend categories, allows stock toggling.
- **Sweeteners Manager:** Add/remove sweeteners, toggle stock status.
- **Blends Manager:** Add/remove blend categories, shows ingredient count, with delete protection.
- **Formula History:** View customer-created formulas.
- Session-based authentication with 24-hour expiry.

**Shopify Integration:**
- Connects to a Shopify store using `SHOPIFY_STORE_URL` and `SHOPIFY_ACCESS_TOKEN`.
- Automatically creates products in Shopify upon formula completion with title, description, tags, SKU, and price.
- Generates cart permalinks with Base64-encoded line item properties.
- Provides an embeddable widget script for Shopify stores.

## External Dependencies

1.  **OpenAI API**: GPT-4o-mini model for all AI-powered conversational logic, dynamic formula generation, dosage personalization, and function calling.
2.  **Shopify Integration**: For creating products, managing carts, and integrating the chatbot widget.
3.  **Open-Meteo API**: For real-time weather data integration via function calling.
4.  **Brave Search API**: For real-time web search queries via a backend proxy server, returning top 3 search results with verified sources.
5.  **Vite**: Build tool and development server for the React application.
6.  **Tailwind CSS (CDN)**: For styling the user interface.
7.  **React Markdown**: For rendering rich text messages in the chat.