import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { useNavigate } from "react-router-dom";

export default function Menu() {
  const navigate = useNavigate();
  return (
    <div className="base justify-center max-w-xl -mt-5">
      <Logo />
      <div className="flex flex-col gap-4 mt-8">
        <Button onClick={() => navigate("/irrigation")}>Irrigation Control</Button>
        <Button onClick={() => navigate("/aircon")}>Aircon Control</Button>
      </div>
    </div>
  );
}
