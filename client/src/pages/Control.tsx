import { useEffect, useMemo, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import ControlItem from "../components/ControlItem";
import Logo from "@/components/Logo";
import { TOPIC_LIST } from "../constants";
import { mqttTopicItem } from "../types";
import { getArrayOfTopicItems } from "../utils";
import { LoaderCircle } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";

export enum enumClientStatus {
  CONNECTED = "Connected",
  ERROR = "Error",
  RECONNECTED = "Reconnected",
  CLOSED = "Closed",
}

export default function Control() {
  const [client, setClient] = useState<MqttClient | null>(null);
  // @ts-ignore
  const [clientStatus, setClientStatus] = useState<enumClientStatus>(
    enumClientStatus.ERROR
  );

  useEffect(() => {
    const mqttClient = mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    });

    setClient(mqttClient);

    mqttClient.on("connect", () => {
      console.log("mqttClient Connected");
      setClientStatus(enumClientStatus.CONNECTED);
    });

    mqttClient.on("error", () => {
      console.log("mqttClient connection error");
      setClientStatus(enumClientStatus.ERROR);
    });

    mqttClient.on("reconnect", () => {
      console.log("mqttClient reconnected");
      setClientStatus(enumClientStatus.RECONNECTED);
    });

    mqttClient.on("close", () => {
      console.log("mqttClient connection closed");
      setClientStatus(enumClientStatus.CLOSED);
    });
  }, []);

  const topicItems: mqttTopicItem[] = useMemo(
    () => getArrayOfTopicItems(TOPIC_LIST),
    [TOPIC_LIST]
  );

  return (
    <div className="base">
      <div className="mt-42">
        <Logo />
      </div>

      <div className="mb-4 flex justify-center items-center gap-2">
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
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="w-16 text-center">State</div>
          <div className="w-48 text-left">Topic</div>
          <div className="w-16 text-center">Control</div>
        </div>
        <Accordion type="single" collapsible>
          {topicItems.map((topic: mqttTopicItem) => (
            <ControlItem
              client={client}
              clientStatus={clientStatus}
              topicItem={topic}
              key={topic}
            />
          ))}
        </Accordion>
      </div>
    </div>
  );
}
