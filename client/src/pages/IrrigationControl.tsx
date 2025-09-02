import { useEffect, useMemo, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import ControlItem from "../components/ControlItem";
import Logo from "@/components/Logo";
import { CONTROLLER_DEVICE_ID_TO_TOPIC } from "../constants";
import { mqttTopicItem, enumClientStatus } from "../types";
import { getArrayOfTopicItems } from "../utils";
import { LoaderCircle, Bolt } from "lucide-react";
import ControlLayout from "@/components/ControlLayout";
import { useMqttClient } from "@/components/hooks/useMqttClient";
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
  const [client, setClient] = useState<MqttClient | null>(null);
  const { clientStatus } = useMqttClient({ mqttClient: client });
  const [showHighDuration, setShowHighDuration] = useState<boolean>(false); //minutes

  useEffect(() => {
    const mqttClient = mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    });

    setClient(mqttClient);
  }, []);

  const topicItems: mqttTopicItem[] = useMemo(
    () => getArrayOfTopicItems(CONTROLLER_DEVICE_ID_TO_TOPIC),
    [CONTROLLER_DEVICE_ID_TO_TOPIC]
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
          <DialogTitle className="text-left">Main Config</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-stretch justify-between gap-6 mt-4">
          <div className="flex justify-between items-center">
            <p>Show HIGH duration config</p>
            <div className="flex items-center justify-center text-center">
              <Switch
                checked={showHighDuration}
                onCheckedChange={(checked: boolean) =>
                  setShowHighDuration(checked)
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
          "✅"
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
              showHighDuration={showHighDuration}
            />
          ))}
        </div>
      </div>
    </ControlLayout>
  );
}
