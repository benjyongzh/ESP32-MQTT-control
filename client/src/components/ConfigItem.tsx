import { useCallback, useEffect, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  mqttMessage,
  mqttConfigMessage,
} from "../types";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { toast } from "sonner";
import { useMqttClient } from "./hooks/useMqttClient";
import {
  SWITCH_MIN_OPEN_DURATION,
  SWITCH_MAX_OPEN_DURATION,
  CONTROLLER_DEVICE_ID_TO_TOPIC,
} from "@/constants";
import { formatTopicFromTopicString } from "@/utils";

export default function ConfigItem(props: {
  client: MqttClient | null;
  topicItem: mqttTopicItem;
}) {
  const { client, topicItem } = props;
  const [configDuration, setConfigDuration] = useState<number>(3000);

  const topicConfig: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONFIG),
    [topicItem]
  );

  const onMessageReceived = (topic: string, payload: mqttMessage) => {
    if (topic === topicConfig) {
      const message: mqttConfigMessage = payload.message as mqttConfigMessage;
      console.log("onMessageReceived:", message);
      if (message.duration) setConfigDuration(message.duration);
    }
  };

  const { clientStatus } = useMqttClient({
    mqttClient: client,
    topics: [topicConfig],
    onMessage: onMessageReceived,
  });

  useEffect(() => {
    client?.on("message", (topic: string, payload: Buffer<ArrayBufferLike>) => {
      if (topic === topicConfig) {
        const payloadObject: mqttMessage = JSON.parse(payload.toString());
        onMessageReceived(topic, payloadObject);
      }
    });
  }, [clientStatus]);

  const onValueCommit = useCallback(() => {
    const message: mqttMessage = {
      message: { duration: configDuration },
      timestamp: new Date().toISOString(),
    };
    console.log("message to publish: ", topicConfig, message);
    client?.publish(topicConfig, JSON.stringify(message), {
      retain: true,
    });
    toast.success(topicConfig, {
      description: `Duration updated to ${displayedDuration} seconds`,
    });
  }, [client, configDuration, topicConfig]);

  const displayedDuration = useMemo(
    () => (configDuration / 1000).toFixed(1),
    [configDuration]
  );

  const formattedTopicString: string = useMemo(
    () => formatTopicFromTopicString(topicItem),
    [CONTROLLER_DEVICE_ID_TO_TOPIC, topicItem]
  );

  return (
    <div className="grid grid-cols-[minmax(128px,_1fr)_minmax(_1fr,_10fr)_minmax(40px,_1fr)] gap-1 items-center">
      <Label htmlFor={topicItem}>{formattedTopicString}</Label>
      <Slider
        onValueChange={([value]) => setConfigDuration(value)}
        onValueCommit={() => onValueCommit()}
        value={[configDuration]}
        defaultValue={[configDuration]}
        min={SWITCH_MIN_OPEN_DURATION}
        max={SWITCH_MAX_OPEN_DURATION}
        step={100}
        name={topicItem}
      />
      <p className="text-right">{displayedDuration} s</p>
    </div>
  );
}
