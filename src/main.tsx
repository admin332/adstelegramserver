import { createRoot } from "react-dom/client";
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from "./App.tsx";
import "./index.css";

const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

// Определяем, находимся ли мы внутри Telegram Mini App
const isTMA = Boolean(window.Telegram?.WebApp?.initData);

// Для TMA используем tg://resolve, для браузера — back
const returnStrategy = isTMA ? 'tg://resolve' : 'back';

createRoot(document.getElementById("root")!).render(
  <TonConnectUIProvider 
    manifestUrl={manifestUrl}
    actionsConfiguration={{
      returnStrategy: returnStrategy as 'back' | 'tg://resolve',
      twaReturnUrl: 'https://t.me/adsingo_bot/open'
    }}
  >
    <App />
  </TonConnectUIProvider>
);
