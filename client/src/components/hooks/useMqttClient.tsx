import { useEffect, useState } from "react";
import { MqttClient } from "mqtt";
import {
  enumClientStatus,
  enumMqttTopicType,
  MqttMessageAny,
} from "@/types";

interface UseMQTTListenerProps {
  mqttClient: MqttClient | null;
  topics?: string[];
  onMessage?: (topic: string, payload: MqttMessageAny) => void;
}

export const useMqttClient = ({
  mqttClient,
  topics,
  onMessage,
}: UseMQTTListenerProps) => {
  const [clientStatus, setClientStatus] = useState<enumClientStatus>(
    enumClientStatus.ERROR
  );

  const inferTopicType = (topic: string): enumMqttTopicType | undefined => {
    const parts = topic.split("/");
    const maybeType = parts[parts.length - 1];
    switch (maybeType) {
      case enumMqttTopicType.STATUS:
      case enumMqttTopicType.CONFIG:
      case enumMqttTopicType.HEALTH:
      case enumMqttTopicType.CONTROL:
        return maybeType;
      default:
        return undefined;
    }
  };

  const refreshTopics = () => {
    if (!mqttClient || !topics?.length) return;
    topics.forEach((topic) => {
      mqttClient.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Refresh subscribe error for topic ${topic}:`, err);
        } else {
          console.log(`Refresh subscribed to topic: ${topic}`);
        }
      });
    });
  };

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
        const parsed = JSON.parse(payload.toString()) as MqttMessageAny;
        const resolvedType =
          (parsed.type as enumMqttTopicType | undefined) ?? inferTopicType(topic);

        if (!resolvedType) {
          console.warn("Unhandled MQTT message type");
          return;
        }

        // Trust the payload shape after resolving the topic type; fallback to any to satisfy union
        const typedPayload = {
          ...parsed,
          type: resolvedType,
        } as MqttMessageAny;

        switch (resolvedType) {
          case enumMqttTopicType.STATUS:
          case enumMqttTopicType.CONFIG:
          case enumMqttTopicType.HEALTH:
          case enumMqttTopicType.CONTROL:
            onMessage(topic, typedPayload);
            break;
          default:
            console.warn("Unhandled MQTT message type");
        }
      }
    };

    mqttClient.on("connect", handleConnect);
    mqttClient.on("reconnect", handleReconnect);
    mqttClient.on("close", handleClose);
    mqttClient.on("message", handleMessage);

    // If the client connected before the listeners were attached, ensure we still subscribe
    if (mqttClient.connected) {
      handleConnect();
    }

    return () => {
      mqttClient.removeListener("connect", handleConnect);
      mqttClient.removeListener("reconnect", handleReconnect);
      mqttClient.removeListener("close", handleClose);
      mqttClient.removeListener("message", handleMessage);
    };
  }, [mqttClient, topics, onMessage]);

  return { clientStatus, refreshTopics };
};
