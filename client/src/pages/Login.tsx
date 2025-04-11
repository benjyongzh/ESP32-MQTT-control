import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
      setError("Invalid Token");
      setIsLoading(false);
    }
  };

  return (
    <div className="base justify-center -mt-5">
      <Logo />
      <h1 className="mb-3">Enter Token</h1>
      <div className="w-full flex flex-col justify-center items-center gap-6">
        <div className="flex items-center w-full justify-center gap-3">
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
          <Alert className="w-full" variant="destructive">
            <Ban className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
