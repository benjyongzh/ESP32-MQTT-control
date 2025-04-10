import { useEffect, useMemo, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import ControlItem from "../components/ControlItem";
import { TOPIC_LIST } from "../constants";
import { mqttTopicItem } from "../types";
import { getArrayOfTopicItems } from "../utils";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
      <h1 className="text-3xl mb-6">🌱 ESP32 Irrigation Control</h1>
      <Table>
        <TableCaption>A list of valves</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Valve</TableHead>
            <TableHead className="text-right">Status</TableHead>
            <TableHead>Control</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topicItems.map((topic: mqttTopicItem) => (
            <ControlItem
              client={client}
              clientStatus={clientStatus}
              topicItem={topic}
            />
          ))}
        </TableBody>
      </Table>
      <p className="mt-4 text-lg">
        {clientStatus === enumClientStatus.CONNECTED ||
        clientStatus === enumClientStatus.RECONNECTED
          ? "✅ Connected to MQTT broker"
          : "Connecting to MQTT..."}
      </p>
    </div>
  );
}
