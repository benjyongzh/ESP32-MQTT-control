import { useEffect, useMemo, useState } from "react";
import mqtt, { MqttClient } from "mqtt";
import ControlItem from "../components/ControlItem";
import { TOPIC_LIST } from "../constants";
import { mqttTopicItem, getMqttTopicId } from "../types";
import { getArrayOfTopicItems } from "../utils";

export default function Control() {
  const [client, setClient] = useState<MqttClient | null>(null);

  useEffect(() => {
    const mqttClient = mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    });

    mqttClient.on("connect", () => {
      mqttClient.subscribe(import.meta.env.VITE_MQTT_TOPIC_STATUS);
    });

    setClient(mqttClient);
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
            topicControl={getMqttTopicId(topic, "control")}
            topicStatus={getMqttTopicId(topic, "status")}
          />
        ))}
      </div>
      <p className="mt-4 text-lg">
        {client !== null
          ? "✅ Connected to MQTT broker"
          : "Connecting to MQTT..."}
      </p>
    </div>
  );
}
