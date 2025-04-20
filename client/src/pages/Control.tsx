import { useEffect, useMemo, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import ControlItem from "../components/ControlItem";
import Logo from "@/components/Logo";
import { TOPIC_LIST } from "../constants";
import { mqttTopicItem } from "../types";
import { getArrayOfTopicItems } from "../utils";
import { LoaderCircle, Bolt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ConfigItem from "@/components/ConfigItem";
import { useMqttClient } from "@/components/hooks/useMqttClient";

export enum enumClientStatus {
  CONNECTED = "Connected",
  ERROR = "Error",
  RECONNECTED = "Reconnected",
  CLOSED = "Closed",
}

export default function Control() {
  const [client, setClient] = useState<MqttClient | null>(null);
  const { clientStatus } = useMqttClient({ mqttClient: client });

  useEffect(() => {
    const mqttClient = mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    });

    setClient(mqttClient);
  }, []);

  const topicItems: mqttTopicItem[] = useMemo(
    () => getArrayOfTopicItems(TOPIC_LIST),
    [TOPIC_LIST]
  );

  return (
    <div className="base relative">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant={"ghost"} className="absolute right-3">
            <Bolt />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-left">Configuration</DialogTitle>
            <DialogDescription className="text-left">
              Make changes to HIGH duration settings for each valve here
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-stretch justify-between gap-4 mt-4">
            {topicItems.map((topic) => (
              <ConfigItem key={topic} client={client} topicItem={topic} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
      <div className="grid grid-cols-[1fr_auto_1fr]">
        <div className="text-center border-b-1 border-primary-foreground pb-2">
          State
        </div>
        <div className="text-left border-b-1 border-primary-foreground pb-2">
          Topic
        </div>
        <div className="text-center border-b-1 border-primary-foreground pb-2">
          Control
        </div>
        <div className="col-span-full">
          {topicItems.map((topic: mqttTopicItem) => (
            <ControlItem client={client} topicItem={topic} key={topic} />
          ))}
        </div>
      </div>
    </div>
  );
}
