import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  enumClientStatus,
  enumMqttTopicType,
  MqttMessageAny,
} from "@/types";
import { ControlClient } from "@/lib/control-client";

interface UseMQTTListenerProps {
  mqttClient: ControlClient | null;
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
  const topicsRef = useRef<string[]>(topics ?? []);
  const onMessageRef = useRef<typeof onMessage>(onMessage);

  useEffect(() => {
    topicsRef.current = topics ?? [];
  }, [topics]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const topicKey = useMemo(() => (topics ?? []).join("|"), [topics]);

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

  const refreshTopics = useCallback(() => {
    const currentTopics = topicsRef.current;
    if (!mqttClient || currentTopics.length === 0) return;
    currentTopics.forEach((topic) => {
      mqttClient.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Refresh subscribe error for topic ${topic}:`, err);
        } else {
          console.log(`Refresh subscribed to topic: ${topic}`);
        }
      });
    });
  }, [mqttClient]);

  const parsePayload = (payload: unknown): MqttMessageAny | null => {
    if (typeof payload === "string") {
      return JSON.parse(payload) as MqttMessageAny;
    }

    if (
      payload &&
      typeof payload === "object" &&
      "toString" in payload &&
      typeof payload.toString === "function"
    ) {
      return JSON.parse(payload.toString()) as MqttMessageAny;
    }

    return null;
  };

  useEffect(() => {
    if (!mqttClient) return;

    const subscribeToTopics = () => {
      const currentTopics = topicsRef.current;
      currentTopics.forEach((topic) => {
        mqttClient.subscribe(topic, { qos: 1 }, (err) => {
          if (err) {
            console.error(`Subscription error for topic ${topic}:`, err);
          } else {
            console.log(`Subscribed to topic: ${topic}`);
          }
        });
      });
    };

    const handleConnect = () => {
      setClientStatus(enumClientStatus.CONNECTED);
      subscribeToTopics();
    };

    const handleReconnect = () => {
      setClientStatus(enumClientStatus.RECONNECTED);
      subscribeToTopics();
    };

    const handleClose = () => {
      setClientStatus(enumClientStatus.CLOSED);
    };

    const handleMessage = (topic: string, payload: unknown) => {
      const currentTopics = topicsRef.current;
      const currentOnMessage = onMessageRef.current;

      if (currentTopics.includes(topic) && currentOnMessage) {
        const parsed = parsePayload(payload);
        if (!parsed) {
          console.warn("Unable to parse MQTT payload");
          return;
        }
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
            currentOnMessage(topic, typedPayload);
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
  }, [mqttClient, topicKey]);

  return { clientStatus, refreshTopics };
};
