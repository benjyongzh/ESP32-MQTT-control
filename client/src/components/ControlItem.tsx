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
import { getEnumKeyByEnumValue, dateFormatter } from "../utils";
import { Switch } from "./ui/switch";
import SwitchStatusText from "./SwitchStatusText";
import { useMqttClient } from "./hooks/useMqttClient";

export enum enumSwitchStatus {
  LOW = "LOW",
  HIGH = "HIGH",
  UNKNOWN = "UNKNOWN",
}

export default function ControlItem(props: {
  client: MqttClient | null;
  topicItem: mqttTopicItem;
}) {
  const { client, topicItem } = props;

  const onMessageReceived = (topic: string, payload: mqttMessage) => {
    if (topic === topicStatus) {
      if (Object.keys(enumSwitchStatus).includes(payload.message as string)) {
        const key: string | number = getEnumKeyByEnumValue(
          enumSwitchStatus,
          payload.message as string
        );
        setStatus(enumSwitchStatus[key as keyof typeof enumSwitchStatus]);
        setLastUpdated(payload.timestamp);
      }
    }
  };

  const topicControl: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONTROL),
    [topicItem]
  );
  const topicStatus: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.STATUS),
    [topicItem]
  );

  const { clientStatus } = useMqttClient({
    mqttClient: client,
    topics: [topicControl, topicStatus],
    onMessage: onMessageReceived,
  });
  const [status, setStatus] = useState<enumSwitchStatus>(enumSwitchStatus.LOW);
  const [lastUpdated, setLastUpdated] = useState<string>("unregistered");
  // const [configDuration, setConfigDuration] = useState<number>(3000);

  useEffect(() => {
    if (clientStatus === enumClientStatus.ERROR) {
      setStatus(enumSwitchStatus.UNKNOWN);
    }
  }, [clientStatus]);

  const sendCommand = useCallback(
    (checked: boolean) => {
      const message: mqttMessage = {
        message: checked ? enumSwitchStatus.HIGH : enumSwitchStatus.LOW,
        timestamp: new Date().toISOString(),
      };
      client?.publish(topicControl, JSON.stringify(message), {
        retain: true,
      });
      // console.log("published:", enumSwitchStatus.LOW);
    },
    [client, topicControl]
  );

  // const sendConfig = useCallback(() => {
  //   const message: mqttMessage = {
  //     message: configDuration.toString(),
  //     timestamp: new Date().toISOString(),
  //   };
  //   client?.publish(topicConfig, JSON.stringify(message), {
  //     retain: true,
  //   });
  // }, [client, topicConfig]);

  const onSwitchChange = useCallback(
    (checked: boolean) => {
      if (
        clientStatus === enumClientStatus.CONNECTED ||
        clientStatus === enumClientStatus.RECONNECTED
      ) {
        sendCommand(checked);
        // setStatus(checked ? enumSwitchStatus.HIGH : enumSwitchStatus.LOW);
        // console.log("switch is now", checked);
      }
      setStatus(enumSwitchStatus.UNKNOWN);
    },
    [clientStatus, sendCommand]
  );

  const formattedDate: string = useMemo(
    () =>
      lastUpdated === "unregistered"
        ? lastUpdated
        : dateFormatter.format(new Date(lastUpdated)),
    [lastUpdated]
  );

  return (
    <div className="flex items-center w-full border-b-1 border-primary-foreground py-2">
      <div className="w-16 text-center">
        <SwitchStatusText status={status} />
      </div>
      <div className="w-60 flex flex-col gap-1">
        <p className="text-left">{topicItem}</p>
        <p className="text-left text-xs text-muted-foreground">
          Updated: {formattedDate}
        </p>
      </div>

      <div className="w-16 text-center">
        <Switch
          id={topicItem}
          checked={status === enumSwitchStatus.HIGH}
          onCheckedChange={(checked: boolean) => onSwitchChange(checked)}
        />
      </div>
    </div>
  );
}
