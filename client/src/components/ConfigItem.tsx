import { useCallback, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  mqttMessage,
} from "../types";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { toast } from "sonner";
import { useMqttClient } from "./hooks/useMqttClient";

export default function ConfigItem(props: {
  client: MqttClient | null;
  topicItem: mqttTopicItem;
}) {
  const { client, topicItem } = props;

  const topicConfig: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONFIG),
    [topicItem]
  );

  const onMessageReceived = (topic: string, payload: mqttMessage) => {
    if (topic === topicConfig) setConfigDuration(parseInt(payload.message));
  };

  const { clientStatus } = useMqttClient({
    mqttClient: client,
    topics: [topicConfig],
    onMessage: onMessageReceived,
  });

  const [configDuration, setConfigDuration] = useState<number>(3000);

  const onValueCommit = useCallback(() => {
    const message: mqttMessage = {
      message: configDuration.toString(),
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

  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={topicItem} className="w-20">
        {topicItem} HIGH Duration
      </Label>
      <Slider
        onValueChange={([value]) => setConfigDuration(value)}
        onValueCommit={() => onValueCommit()}
        value={[configDuration]}
        defaultValue={[configDuration]}
        min={100}
        max={5000}
        step={100}
        name={topicItem}
      />
      <p className="text-right w-16">{displayedDuration} s</p>
    </div>
  );
}
