// Define lightweight browser polyfill for Node Buffer required by @x402/avm
if (typeof window !== "undefined" && !window.Buffer) {
  const bufferPolyfill = {
    from: (data: any, encoding?: string) => {
      if (typeof data === "string" && encoding === "base64") {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }
      if (data instanceof Uint8Array || Array.isArray(data)) {
        const bytes = new Uint8Array(data);
        return {
          toString: (enc?: string) => {
            if (enc === "base64") {
              let binary = "";
              const len = bytes.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              return btoa(binary);
            }
            return new TextDecoder().decode(bytes);
          }
        };
      }
      return data;
    }
  };
  (window as any).Buffer = bufferPolyfill;
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
