import { useEffect, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
} from "../types";
import { enumClientStatus } from "../pages/Control";
import { getEnumKeyByEnumValue } from "../utils";
import { TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "./ui/switch";

enum enumSwitchStatus {
  LOW = "Off",
  HIGH = "On",
  SENDING = "Sending",
  UNKNOWN = "Unknown",
}

export default function ControlItem(props: {
  client: MqttClient | null;
  clientStatus: enumClientStatus;
  topicItem: mqttTopicItem;
}) {
  const { client, clientStatus, topicItem } = props;
  const [status, setStatus] = useState<enumSwitchStatus>(
    enumSwitchStatus.UNKNOWN
  );

  const topicControl: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONTROL),
    [topicItem]
  );
  const topicStatus: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.STATUS),
    [topicItem]
  );

  useEffect(() => {
    if (
      clientStatus === enumClientStatus.CONNECTED ||
      enumClientStatus.RECONNECTED
    ) {
      client?.subscribe(topicStatus, { qos: 1 }, (err) => {
        if (!err) {
          console.log("subscribing to", topicStatus);
        } else console.log(`subcription error for ${topicStatus}`, err);
      });

      client?.on("message", (topic, msg) => {
        console.log(
          `Received message on topic ${topic}: ${msg}: ${msg.toString()}`
        );
        if (
          topic === topicStatus &&
          Object.keys(enumSwitchStatus).includes(msg.toString())
        ) {
          const key: string | number = getEnumKeyByEnumValue(
            enumSwitchStatus,
            msg.toString()
          );
          setStatus(enumSwitchStatus[key as keyof typeof enumSwitchStatus]);
        }
      });
    } else if (clientStatus === enumClientStatus.ERROR) {
      setStatus(enumSwitchStatus.UNKNOWN);
    }
  }, [clientStatus]);

  const toggleCommand = () => {
    if (
      clientStatus === enumClientStatus.CONNECTED ||
      clientStatus === enumClientStatus.RECONNECTED
    ) {
      if (status === enumSwitchStatus.LOW) {
        client?.publish(
          topicControl,
          enumSwitchStatus.HIGH,
          { retain: true },
          () => setStatus(enumSwitchStatus.SENDING)
        );
      } else if (status === enumSwitchStatus.HIGH) {
        client?.publish(
          topicControl,
          enumSwitchStatus.LOW,
          { retain: true },
          () => setStatus(enumSwitchStatus.SENDING)
        );
      }
    } else {
      setStatus(enumSwitchStatus.UNKNOWN);
    }
  };

  return (
    <TableRow key={topicItem}>
      <TableCell>{topicItem}</TableCell>
      <TableCell className="text-center">{status}</TableCell>
      <TableCell className="text-right">
        <Switch
          id={topicItem}
          onCheckedChange={() => toggleCommand()}
          checked={status === enumSwitchStatus.HIGH}
          disabled={status === enumSwitchStatus.SENDING}
        />
      </TableCell>
    </TableRow>
  );
}
