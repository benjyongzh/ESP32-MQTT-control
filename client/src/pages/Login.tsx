import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChevronRight, Ban } from "lucide-react";
import Logo from "@/components/Logo";

export default function Login() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/login`,
        { token },
        { withCredentials: true }
      );
      navigate("/control");
      setIsLoading(false);
    } catch (err) {
      setError("Invalid token");
      setIsLoading(false);
    }
  };

  return (
    <div className="base justify-center -mt-5">
      <Logo />
      <h1 className="mb-3">Enter Token</h1>
      <div className="flex items-center justify-center gap-3">
        <Input
          type="password"
          placeholder="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Button
          size="icon"
          disabled={isLoading}
          onClick={handleLogin}
          className={isLoading ? "btn-disabled" : ""}
        >
          {isLoading ? (
            <span className="loading loading-dots loading-md"></span>
          ) : (
            <ChevronRight />
          )}
        </Button>
      </div>

      {error && (
        <Alert>
          <Ban className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
