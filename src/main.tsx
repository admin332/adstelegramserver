import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from "./App.tsx";
import "./index.css";

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

createRoot(document.getElementById("root")!).render(
  <TonConnectUIProvider 
    manifestUrl={manifestUrl}
    actionsConfiguration={{
      returnStrategy: 'back',
      twaReturnUrl: 'https://t.me/AdsingoBot'
    }}
  >
    <App />
  </TonConnectUIProvider>
);
