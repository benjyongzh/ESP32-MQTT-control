import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Control from "./pages/Control";
import ProtectedRoute from "./pages/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster, toast } from "sonner";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster
        position="top-center"
        closeButton
        richColors
        // toastOptions={{
        //   style: {
        //     background: "oklch(0.279 0.041 260.031)",
        //   },
        // }}
      />
      <BrowserRouter>
        <Routes>
          <Route index element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/control"
            element={
              <ProtectedRoute>
                <Control />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
