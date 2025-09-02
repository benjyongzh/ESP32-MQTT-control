import { useEffect, useState } from "react";
import { MqttClient } from "mqtt";
import { enumClientStatus } from "@/types";
import { mqttMessage } from "@/types";

interface UseMQTTListenerProps {
  mqttClient: MqttClient | null;
  topics?: string[];
  onMessage?: (topic: string, payload: mqttMessage) => void;
}

export const useMqttClient = ({
  mqttClient,
  topics,
  onMessage,
}: UseMQTTListenerProps) => {
  const [clientStatus, setClientStatus] = useState<enumClientStatus>(
    enumClientStatus.ERROR
  );

  useEffect(() => {
    if (!mqttClient) return;

    const handleConnect = () => {
      setClientStatus(enumClientStatus.CONNECTED);
      onClientConnect();
    };

    const handleReconnect = () => {
      setClientStatus(enumClientStatus.RECONNECTED);
      onClientConnect();
    };

    const handleClose = () => {
      setClientStatus(enumClientStatus.CLOSED);
    };

    const onClientConnect = () => {
      // Subscribe to topics
      topics?.forEach((topic) => {
        mqttClient.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`Subscription error for topic ${topic}:`, err);
          } else {
            console.log(`Subscribed to topic: ${topic}`);
          }
        });
      });
    };

    const handleMessage = (topic: string, payload: Buffer<ArrayBufferLike>) => {
      if (topics?.includes(topic) && onMessage) {
        const payloadObject: mqttMessage = JSON.parse(payload.toString());
        onMessage(topic, payloadObject);
      }
    };

    mqttClient.on("connect", handleConnect);
    mqttClient.on("reconnect", handleReconnect);
    mqttClient.on("close", handleClose);
    mqttClient.on("message", handleMessage);

    return () => {
      mqttClient.removeListener("connect", handleConnect);
      mqttClient.removeListener("reconnect", handleReconnect);
      mqttClient.removeListener("close", handleClose);
      mqttClient.removeListener("message", handleMessage);
    };
  }, [mqttClient, topics, onMessage]);

  return { clientStatus };
};
