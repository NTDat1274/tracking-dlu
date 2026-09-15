// src/App.tsx
import WebApp from "./web/components/WebApp";
import { AuthProvider } from "./context/AuthContext";

import { ThemeProvider } from "./context/ThemeContext";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
