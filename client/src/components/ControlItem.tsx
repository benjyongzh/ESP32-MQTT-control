import { useCallback, useEffect, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  mqttMessage,
  topicList,
} from "../types";
import { enumClientStatus } from "../pages/Control";
import {
  getEnumKeyByEnumValue,
  dateFormatter,
  formatTopicFromTopicString,
} from "../utils";
import { Switch } from "./ui/switch";
import SwitchStatusText from "./SwitchStatusText";
import { useMqttClient } from "./hooks/useMqttClient";
import { CONTROLLER_DEVICE_ID_TO_TOPIC } from "@/constants";

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
    },
    [client, topicControl]
  );

  const onSwitchChange = useCallback(
    (checked: boolean) => {
      if (
        clientStatus === enumClientStatus.CONNECTED ||
        clientStatus === enumClientStatus.RECONNECTED
      ) {
        sendCommand(checked);
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

  const formattedTopicString: string = useMemo(
    () => formatTopicFromTopicString(topicItem),
    [CONTROLLER_DEVICE_ID_TO_TOPIC, topicItem]
  );

  return (
    <div className="table-grid-row w-full border-b-1 border-primary-foreground py-2">
      <div className="flex items-center justify-center text-center">
        <SwitchStatusText status={status} />
      </div>
      <div className="flex flex-col justify-center gap-1">
        <p className="text-left">{formattedTopicString}</p>
        <p className="text-left text-xs text-muted-foreground">
          Updated: {formattedDate}
        </p>
      </div>

      <div className="flex items-center justify-center text-center">
        <Switch
          id={topicItem}
          checked={status === enumSwitchStatus.HIGH}
          onCheckedChange={(checked: boolean) => onSwitchChange(checked)}
        />
      </div>
    </div>
  );
}
