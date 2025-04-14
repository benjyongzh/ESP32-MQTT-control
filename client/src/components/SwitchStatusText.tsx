import { Droplet, DropletOff, LoaderCircle, RefreshCw } from "lucide-react";
import { enumSwitchStatus } from "./ControlItem";

export default function SwitchStatusText(props: { status: enumSwitchStatus }) {
  const { status } = props;

  const getIcon = () => {
    switch (status) {
      case enumSwitchStatus.LOW:
        return (
          <DropletOff
            fill="oklch(0.704 0.04 256.788)"
            className="w-4 h-4 text-muted-foreground"
          />
        );

      case enumSwitchStatus.HIGH:
        return (
          <div className="relative flex items-center justify-center">
            <RefreshCw
              strokeWidth={1.5}
              className="absolute w-6 h-6 animate-spin text-chart-2"
            />
            <Droplet
              strokeWidth={0}
              fill="oklch(0.696 0.17 162.48)"
              className="absolute w-4 h-4 text-chart-2"
            />
          </div>
        );

      default:
        return (
          <LoaderCircle className="w-5 h-5 animate-spin text-destructive" />
        );
    }
  };

  return (
    <div className="flex gap-3 justify-center items-center">
      {getIcon()}
      {/* <p className="text-foreground">{status}</p> */}
    </div>
  );
}
