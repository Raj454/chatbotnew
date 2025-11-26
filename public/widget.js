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
})();
