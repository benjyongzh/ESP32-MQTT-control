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
import { TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "./ui/switch";
import SwitchStatusText from "./SwitchStatusText";
import { Button } from "./ui/button";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  const [lastUpdated, setLastUpdated] = useState<string>("");

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
    if (topic === topicStatus) {
      const payload: mqttMessage = JSON.parse(msg.toString());
      if (Object.keys(enumSwitchStatus).includes(payload.message)) {
        const key: string | number = getEnumKeyByEnumValue(
          enumSwitchStatus,
          payload.message
        );
        setStatus(enumSwitchStatus[key as keyof typeof enumSwitchStatus]);
        setLastUpdated(payload.timestamp);
      }
    }
  };

  useEffect(() => {
    onClientConnect();
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
    <AccordionItem value={topicItem}>
      <div className="flex items-center">
        <div className="w-16 text-center">
          <SwitchStatusText status={status} />
        </div>
        <div className="w-48">
          <AccordionTrigger>
            <p className="text-left">{topicItem}</p>
          </AccordionTrigger>
        </div>

        <div className="w-16 text-center">
          <Switch
            id={topicItem}
            onCheckedChange={(checked: boolean) => onSwitchChange(checked)}
          />
        </div>
      </div>

      <AccordionContent className="text-xs pl-16 text-muted-foreground pb-3">
        Last updated: {/* {lastUpdated} */}test
      </AccordionContent>
    </AccordionItem>
  );
}
