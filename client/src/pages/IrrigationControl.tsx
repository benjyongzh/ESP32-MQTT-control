import { useEffect, useMemo, useState } from "react";
import ControlItem from "../components/ControlItem";
import Logo from "@/components/Logo";
import { CONTROLLER_DEVICE_ID_TO_TOPIC } from "../constants";
import { mqttTopicItem, enumClientStatus } from "../types";
import { getArrayOfTopicItems } from "../utils";
import { LoaderCircle, Bolt, Check } from "lucide-react";
import ControlLayout from "@/components/ControlLayout";
import { useMqttClient } from "@/components/hooks/useMqttClient";
import { ControlClient, createControlClient } from "@/lib/control-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function IrrigationControl() {
  const [client, setClient] = useState<ControlClient | null>(null);
  const { clientStatus } = useMqttClient({ mqttClient: client });
  const [showConfigControls, setShowConfigControls] = useState<boolean>(true);

  useEffect(() => {
    setClient(createControlClient());
  }, []);

  const topicItems: mqttTopicItem[] = useMemo(
    () => getArrayOfTopicItems(CONTROLLER_DEVICE_ID_TO_TOPIC),
    []
  );

  const configDialog = (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={"ghost"}>
          <Bolt />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs md:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-left">Display Options</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-stretch justify-between gap-6 mt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p>Show valve configuration controls</p>
              <p className="text-sm text-muted-foreground">
                Hide config editing to reduce the chance of accidental valve changes.
              </p>
            </div>
            <div className="flex h-5 items-center justify-center shrink-0">
              <Switch
                checked={showConfigControls}
                onCheckedChange={(checked: boolean) =>
                  setShowConfigControls(checked)
                }
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <ControlLayout rightSlot={configDialog}>
      <div className="mt-42">
        <Logo />
      </div>

      <div className="mb-4 w-full max-w-xl flex justify-center items-center gap-2">
        {clientStatus === enumClientStatus.CONNECTED ||
        clientStatus === enumClientStatus.RECONNECTED ? (
          <Check className="text-foreground" />
        ) : (
          <LoaderCircle className="animate-spin text-foreground" />
        )}
        <p className="sm:text-lg">
          {clientStatus === enumClientStatus.CONNECTED ||
          clientStatus === enumClientStatus.RECONNECTED
            ? "Connected to MQTT broker"
            : "Connecting to MQTT..."}
        </p>
      </div>
      <div className="flex flex-col max-w-screen-lg">
        <div className="table-grid-row border-b-1 border-primary-foreground pb-2">
          <div className="text-center">State</div>
          <div className="text-left">Topic</div>
          <div className="text-center">Control</div>
        </div>
        <div className="flex flex-col w-full justify-start items-stretch">
          {topicItems.map((topic: mqttTopicItem) => (
            <ControlItem
              client={client}
              topicItem={topic}
              key={topic}
              showConfigControls={showConfigControls}
            />
          ))}
        </div>
      </div>
    </ControlLayout>
  );
}
