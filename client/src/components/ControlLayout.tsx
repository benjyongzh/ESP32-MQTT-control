import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface ControlLayoutProps {
  children: ReactNode;
  rightSlot?: ReactNode;
}

export default function ControlLayout({ children, rightSlot }: ControlLayoutProps) {
  const navigate = useNavigate();
  return (
    <div className="base relative">
      <Button
        variant="ghost"
        className="absolute left-3 top-3"
        onClick={() => navigate("/menu")}
      >
        <ArrowLeft />
      </Button>
      {rightSlot && <div className="absolute right-3 top-3">{rightSlot}</div>}
      {children}
    </div>
  );
}
