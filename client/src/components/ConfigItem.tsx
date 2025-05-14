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
  HEARTBEAT_INTERVAL_MIN,
  HEARTBEAT_INTERVAL_MAX,
} from "@/constants";
import { formatTopicFromTopicString } from "@/utils";

export default function ConfigItem(props: {
  client: MqttClient | null;
  topicItem: mqttTopicItem;
}) {
  const { client, topicItem } = props;
  const [highDuration, setHighDuration] = useState<number>(3000); //milleseconds
  const [heartbeatIntervalDuration, setHeartbeatIntervalDuration] =
    useState<number>(5); //minutes

  const topicConfig: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONFIG),
    [topicItem]
  );

  const onMessageReceived = (topic: string, payload: mqttMessage) => {
    if (topic === topicConfig) {
      const message: mqttConfigMessage = payload.message as mqttConfigMessage;
      console.log("onMessageReceived:", message);
      if (message.highDuration) setHighDuration(message.highDuration);
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
      message: { highDuration, heartbeatInterval: heartbeatIntervalDuration },
      timestamp: new Date().toISOString(),
    };
    console.log("message to publish: ", topicConfig, message);
    client?.publish(topicConfig, JSON.stringify(message), {
      retain: true,
    });
    toast.success(topicConfig, {
      description: `HIGH duration updated to ${displayedHighDuration} seconds\nHeartbeat interval updated to ${heartbeatIntervalDuration} minutes`,
    });
  }, [client, highDuration, topicConfig]);

  const displayedHighDuration = useMemo(
    () => (highDuration / 1000).toFixed(1),
    [highDuration]
  );

  const formattedTopicString: string = useMemo(
    () => formatTopicFromTopicString(topicItem),
    [CONTROLLER_DEVICE_ID_TO_TOPIC, topicItem]
  );

  return (
    <div className="flex flex-col items-start justify-center gap-3">
      <div className="flex flex-col items-start justify-center gap-2 w-full">
        <Label htmlFor={topicItem}>HIGH Duration</Label>
        <div className="flex gap-1 w-full">
          <Slider
            onValueChange={([value]) => setHighDuration(value)}
            onValueCommit={() => onValueCommit()}
            value={[highDuration]}
            defaultValue={[highDuration]}
            min={SWITCH_MIN_OPEN_DURATION}
            max={SWITCH_MAX_OPEN_DURATION}
            step={100}
            name={topicItem}
            className="flex-3"
          />
          <p className="text-left flex-1">{displayedHighDuration} s</p>
        </div>
      </div>
      <div className="flex flex-col items-start justify-center gap-2 w-full">
        <Label htmlFor={topicItem}>Heartbeat Interval</Label>
        <div className="flex gap-1 w-full">
          <Slider
            onValueChange={([value]) => setHeartbeatIntervalDuration(value)}
            onValueCommit={() => onValueCommit()}
            value={[heartbeatIntervalDuration]}
            defaultValue={[heartbeatIntervalDuration]}
            min={HEARTBEAT_INTERVAL_MIN}
            max={HEARTBEAT_INTERVAL_MAX}
            step={0.1}
            name={topicItem}
            className="flex-3"
          />
          <p className="text-left flex-1">
            {heartbeatIntervalDuration.toFixed(1)} min
          </p>
        </div>
      </div>
    </div>
  );
}
