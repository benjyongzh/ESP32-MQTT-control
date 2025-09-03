import { useCallback, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  MqttMessageAny,
  MqttConfigMessage,
} from "../types";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { toast } from "sonner";
import { useMqttClient } from "./hooks/useMqttClient";
import {
  SWITCH_MIN_OPEN_DURATION,
  SWITCH_MAX_OPEN_DURATION,
  HEARTBEAT_INTERVAL_MIN,
  HEARTBEAT_INTERVAL_MAX,
} from "@/constants";

export default function ConfigItem(props: {
  client: MqttClient | null;
  topicItem: mqttTopicItem;
  showHighDuration: boolean;
}) {
  const { client, topicItem, showHighDuration } = props;
  const [highDuration, setHighDuration] = useState<number>(3000); //milleseconds
  const [heartbeatIntervalDuration, setHeartbeatIntervalDuration] =
    useState<number>(5); //minutes

  const topicConfig: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONFIG),
    [topicItem]
  );

  const onMessageReceived = (_topic: string, payload: MqttMessageAny) => {
    switch (payload.type) {
      case enumMqttTopicType.CONFIG:
        switch (payload.message.configType) {
          case "highDuration":
            setHighDuration(payload.message.highDuration);
            break;
          case "heartbeatInterval":
            setHeartbeatIntervalDuration(
              payload.message.heartbeatInterval
            );
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }
  };

  useMqttClient({
    mqttClient: client,
    topics: [topicConfig],
    onMessage: onMessageReceived,
  });

  const displayedHighDuration = useMemo(
    () => (highDuration / 1000).toFixed(1),
    [highDuration]
  );

  const onHighDurationCommit = useCallback(() => {
    const message: MqttConfigMessage = {
      type: enumMqttTopicType.CONFIG,
      message: { configType: "highDuration", highDuration },
      timestamp: new Date().toISOString(),
    };
    console.log("message to publish: ", topicConfig, message);
    client?.publish(topicConfig, JSON.stringify(message), {
      retain: true,
    });
    toast.success(topicConfig, {
      description: `HIGH duration updated to ${displayedHighDuration} seconds`,
    });
  }, [client, highDuration, topicConfig, displayedHighDuration]);

  const onHeartbeatIntervalCommit = useCallback(() => {
    const message: MqttConfigMessage = {
      type: enumMqttTopicType.CONFIG,
      message: {
        configType: "heartbeatInterval",
        heartbeatInterval: heartbeatIntervalDuration,
      },
      timestamp: new Date().toISOString(),
    };
    console.log("message to publish: ", topicConfig, message);
    client?.publish(topicConfig, JSON.stringify(message), {
      retain: true,
    });
    toast.success(topicConfig, {
      description: `Heartbeat interval updated to ${heartbeatIntervalDuration} minutes`,
    });
  }, [client, heartbeatIntervalDuration, topicConfig]);

  return (
    <div className="flex flex-col items-start justify-center gap-3">
      <div
        className={`flex flex-col items-start justify-center gap-2 w-full ${
          showHighDuration ? "" : "hidden"
        }`}
      >
        <Label htmlFor={topicItem}>HIGH Duration</Label>
        <div className="flex gap-2 w-full">
          <Slider
            onValueChange={([value]) => setHighDuration(value)}
            onValueCommit={() => onHighDurationCommit()}
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
        <div className="flex gap-2 w-full">
          <Slider
            onValueChange={([value]) => setHeartbeatIntervalDuration(value)}
            onValueCommit={() => onHeartbeatIntervalCommit()}
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
