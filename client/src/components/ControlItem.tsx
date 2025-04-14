import { useCallback, useEffect, useMemo, useState } from "react";
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
import SwitchStatusText from "./SwitchStatusText";

export enum enumSwitchStatus {
  LOW = "LOW",
  HIGH = "HIGH",
  UNKNOWN = "UNKNOWN",
}

export default function ControlItem(props: {
  client: MqttClient | null;
  clientStatus: enumClientStatus;
  topicItem: mqttTopicItem;
}) {
  const { client, clientStatus, topicItem } = props;
  const [status, setStatus] = useState<enumSwitchStatus>(enumSwitchStatus.LOW);

  const topicControl: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONTROL),
    [topicItem]
  );
  const topicStatus: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.STATUS),
    [topicItem]
  );

  const onClientConnect = () => {
    if (
      clientStatus === enumClientStatus.CONNECTED ||
      enumClientStatus.RECONNECTED
    ) {
      client?.subscribe(topicStatus, { qos: 1 }, (err) => {
        // if (!err) {
        //   console.log("subscribing to", topicStatus);
        // } else console.log(`subcription error for ${topicStatus}`, err);
      });

      client?.on("message", (topic, msg) => {
        onMessageReceived(topic, msg);
      });
    } else if (clientStatus === enumClientStatus.ERROR) {
      setStatus(enumSwitchStatus.UNKNOWN);
    }
  };

  const onMessageReceived = (topic: string, msg: Buffer<ArrayBufferLike>) => {
    // console.log(
    //   `Received message on topic ${topic}: ${msg}: ${msg.toString()}`
    // );
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
  };

  useEffect(() => {
    onClientConnect();
  }, [clientStatus]);

  const sendCommand = useCallback(
    (checked: boolean) => {
      if (checked) {
        client?.publish(topicControl, enumSwitchStatus.HIGH, { retain: true });
        // console.log("published:", enumSwitchStatus.HIGH);
      } else {
        client?.publish(topicControl, enumSwitchStatus.LOW, { retain: true });
        // console.log("published:", enumSwitchStatus.LOW);
      }
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
        // setStatus(checked ? enumSwitchStatus.HIGH : enumSwitchStatus.LOW);
        // console.log("switch is now", checked);
      }
      setStatus(enumSwitchStatus.UNKNOWN);
    },
    [clientStatus, sendCommand]
  );

  return (
    <TableRow key={topicItem}>
      <TableCell>{topicItem}</TableCell>
      <TableCell className="text-center">
        <SwitchStatusText status={status} />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          id={topicItem}
          onCheckedChange={(checked: boolean) => onSwitchChange(checked)}
        />
      </TableCell>
    </TableRow>
  );
}
