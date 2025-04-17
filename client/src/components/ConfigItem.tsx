import { useCallback, useEffect, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  mqttMessage,
} from "../types";
import { enumClientStatus } from "../pages/Control";
import { getEnumKeyByEnumValue } from "../utils";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
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

  const sendConfig = useCallback(() => {
    const message: mqttMessage = {
      message: configDuration.toString(),
      timestamp: new Date().toISOString(),
    };
    client?.publish(topicConfig, JSON.stringify(message), {
      retain: true,
    });
  }, [client, topicConfig]);

  // const onSwitchChange = useCallback(
  //   (checked: boolean) => {
  //     if (
  //       clientStatus === enumClientStatus.CONNECTED ||
  //       clientStatus === enumClientStatus.RECONNECTED
  //     ) {
  //       sendCommand(checked);
  //       // setStatus(checked ? enumSwitchStatus.HIGH : enumSwitchStatus.LOW);
  //       // console.log("switch is now", checked);
  //     }
  //     setStatus(enumSwitchStatus.UNKNOWN);
  //   },
  //   [clientStatus, sendCommand]
  // );

  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor={topicItem} className="text-right">
        {topicItem}
      </Label>
      <Input id={topicItem} value={3000} className="col-span-3" />
    </div>
  );
}
