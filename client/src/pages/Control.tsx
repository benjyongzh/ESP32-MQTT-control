import { useEffect, useMemo, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import ControlItem from "../components/ControlItem";
import { TOPIC_LIST } from "../constants";
import { mqttTopicItem, getMqttTopicId, enumMqttTopicType } from "../types";
import { getArrayOfTopicItems } from "../utils";

export default function Control() {
  const [client, setClient] = useState<MqttClient | null>(null);

  useEffect(() => {
    const mqttClient = mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    });

    setClient(mqttClient);

    mqttClient.on("connect", () => {
      console.log("mqttClient Connected");
      topicItems.forEach((topic) => {
        const topicStatus: string = getMqttTopicId(
          topic,
          enumMqttTopicType.STATUS
        );
        console.log("subscribing to", topicStatus);
        mqttClient.subscribe(topicStatus);
      });
    });

    mqttClient.on("error", () => {
      console.log("mqttClient connection error");
    });

    mqttClient.on("reconnect", () => {
      console.log("mqttClient reconnected");
    });

    mqttClient.on("close", () => {
      console.log("mqttClient connection closed");
    });
  }, []);

  const topicItems: mqttTopicItem[] = useMemo(
    () => getArrayOfTopicItems(TOPIC_LIST),
    [TOPIC_LIST]
  );

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl mb-6">🌱 ESP32 Irrigation Control</h1>
      <div className="space-x-4">
        {topicItems.map((topic: mqttTopicItem) => (
          <ControlItem
            client={client}
            topicControl={getMqttTopicId(topic, enumMqttTopicType.CONTROL)}
            topicStatus={getMqttTopicId(topic, enumMqttTopicType.STATUS)}
          />
        ))}
      </div>
      <p className="mt-4 text-lg">
        {client?.connected
          ? "✅ Connected to MQTT broker"
          : "Connecting to MQTT..."}
      </p>
    </div>
  );
}
