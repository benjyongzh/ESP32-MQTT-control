import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronRight, LoaderCircle } from "lucide-react";
import Logo from "@/components/Logo";
import { toast } from "sonner";

export default function Login() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/login`,
        { token },
        { withCredentials: true }
      );
      navigate("/control");
      setIsLoading(false);
    } catch (err: any) {
      console.log(err);
      if (err.response) {
        setError(err.response.statusText);
      } else {
        setError(err.message);
      }
      toast.error(error);

      setIsLoading(false);
    }
  };

  return (
    <div className="base justify-center max-w-xl -mt-5">
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
              <LoaderCircle className="animate-spin text-background" />
            ) : (
              <ChevronRight className="text-background" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
