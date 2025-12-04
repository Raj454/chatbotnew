(function () {
  if (document.getElementById("craffteine-chat-widget")) return;

  const scripts = document.getElementsByTagName('script');
  let scriptSrc = '';
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.includes('widget.js')) {
      scriptSrc = scripts[i].src;
      break;
    }
  }
  
  let widgetUrl = '';
  if (scriptSrc) {
    widgetUrl = scriptSrc.replace('/widget.js', '/');
  } else {
    widgetUrl = 'https://craffteine-chat.replit.app/';
  }

  // Build query params for the widget
  const widgetParams = new URLSearchParams();

  // Check if returning from checkout with order_complete parameter
  const urlParams = new URLSearchParams(window.location.search);
  const orderComplete = urlParams.get('order_complete');
  
  // Also check localStorage for order completion flag (set by thank-you page)
  const localStorageComplete = localStorage.getItem('craffteine_order_complete');
  
  // Pass order_complete parameter to iframe if present
  if (orderComplete === 'true' || localStorageComplete === 'true') {
    widgetParams.set('order_complete', 'true');
    // Clean up
    localStorage.removeItem('craffteine_order_complete');
    if (orderComplete === 'true') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  // Get Shopify customer data if available (Shopify Liquid exposes this globally)
  // This works when customer is logged into Shopify store
  if (typeof window.__st !== 'undefined' && window.__st.cid) {
    widgetParams.set('customer_id', window.__st.cid);
  }
  
  // Alternative: Check for Shopify's customer object (set by theme)
  if (typeof window.ShopifyAnalytics !== 'undefined' && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.page) {
    const customerId = window.ShopifyAnalytics.meta.page.customerId;
    if (customerId) {
      widgetParams.set('customer_id', customerId.toString());
    }
  }
  
  // Check for craffteine_customer global set by Liquid template
  if (typeof window.craffteine_customer !== 'undefined' && window.craffteine_customer) {
    if (window.craffteine_customer.id) {
      widgetParams.set('customer_id', window.craffteine_customer.id.toString());
    }
    if (window.craffteine_customer.email) {
      widgetParams.set('customer_email', window.craffteine_customer.email);
    }
    if (window.craffteine_customer.name) {
      widgetParams.set('customer_name', window.craffteine_customer.name);
    }
  }

  // Add params to URL if any exist
  const paramString = widgetParams.toString();
  if (paramString) {
    widgetUrl += '?' + paramString;
  }

  const container = document.createElement("div");
  container.id = "craffteine-chat-widget";
  container.style.cssText = `
    width: 100%;
    max-width: 500px;
    height: 700px;
    margin: 0 auto;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  `;

  const iframe = document.createElement("iframe");
  iframe.id = "craffteine-chat-iframe";
  iframe.src = widgetUrl;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;
  container.appendChild(iframe);

  const currentScript = document.currentScript;
  if (currentScript && currentScript.parentNode) {
    currentScript.parentNode.insertBefore(container, currentScript.nextSibling);
  } else {
    document.body.appendChild(container);
  }

  // Poll localStorage for order completion (in case thank-you page sets it)
  var checkInterval = setInterval(function() {
    var complete = localStorage.getItem('craffteine_order_complete');
    if (complete === 'true') {
      localStorage.removeItem('craffteine_order_complete');
      clearInterval(checkInterval);
      // Send message to iframe
      var chatIframe = document.getElementById('craffteine-chat-iframe');
      if (chatIframe && chatIframe.contentWindow) {
        chatIframe.contentWindow.postMessage({ type: 'CRAFFTEINE_ORDER_COMPLETE' }, '*');
      }
    }
  }, 500);

  // Stop polling after 5 minutes
  setTimeout(function() {
    clearInterval(checkInterval);
  }, 300000);
})();
