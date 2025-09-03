import { useCallback, useEffect, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  MqttMessageAny,
  MqttControlMessage,
} from "../types";
import { enumClientStatus } from "../types";
import {
  getEnumKeyByEnumValue,
  dateFormatter,
  formatTopicFromTopicString,
} from "../utils";
import { Switch } from "./ui/switch";
import SwitchStatusText from "./SwitchStatusText";
import { useMqttClient } from "./hooks/useMqttClient";
import { CONTROLLER_DEVICE_ID_TO_TOPIC } from "@/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ConfigItem from "./ConfigItem";

export enum enumSwitchStatus {
  LOW = "LOW",
  HIGH = "HIGH",
  UNKNOWN = "UNKNOWN",
}

export default function ControlItem(props: {
  client: MqttClient | null;
  topicItem: mqttTopicItem;
  showHighDuration: boolean;
}) {
  const { client, topicItem, showHighDuration } = props;

  const onMessageReceived = (topic: string, payload: MqttMessageAny) => {
    switch (payload.type) {
      case enumMqttTopicType.STATUS:
        if (topic === topicStatus) {
          if (Object.keys(enumSwitchStatus).includes(payload.message)) {
            const key: string | number = getEnumKeyByEnumValue(
              enumSwitchStatus,
              payload.message
            );
            setStatus(
              enumSwitchStatus[key as keyof typeof enumSwitchStatus]
            );
            setLastUpdated(payload.timestamp);
          }
        }
        break;
      case enumMqttTopicType.HEALTH:
        if (topic === topicHealth) {
          setIpAddress(payload.message.ipAddress);
          setHealthLastUpdated(payload.timestamp);
        }
        break;
      default:
        break;
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
  const topicHealth: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.HEALTH),
    [topicItem]
  );

  const { clientStatus } = useMqttClient({
    mqttClient: client,
    topics: [topicControl, topicStatus, topicHealth],
    onMessage: onMessageReceived,
  });
  const [status, setStatus] = useState<enumSwitchStatus>(enumSwitchStatus.LOW);
  const [lastUpdated, setLastUpdated] = useState<string>("Unregistered");
  const [ipAddress, setIpAddress] = useState<string>("Unknown");
  const [healthLastUpdated, setHealthLastUpdated] = useState<string>("Unknown");

  useEffect(() => {
    if (clientStatus === enumClientStatus.ERROR) {
      setStatus(enumSwitchStatus.UNKNOWN);
    }
  }, [clientStatus]);

  const sendCommand = useCallback(
    (checked: boolean) => {
      const message: MqttControlMessage = {
        type: enumMqttTopicType.CONTROL,
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

  const formattedDateLastActivity: string = useMemo(
    () =>
      lastUpdated === "Unregistered"
        ? lastUpdated
        : dateFormatter.format(new Date(lastUpdated)),
    [lastUpdated]
  );

  const formattedDateHealth: string = useMemo(
    () =>
      healthLastUpdated === "Unknown"
        ? healthLastUpdated
        : dateFormatter.format(new Date(healthLastUpdated)),
    [healthLastUpdated]
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
      <div className="flex justify-start">
        <Dialog>
          <DialogTrigger asChild>
            <div className="flex w-full justify-start items-center">
              {formattedTopicString}
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-xs md:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-left">
                {formattedTopicString}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-stretch justify-between mt-3">
              <section className="flex flex-col items-stretch justify-between mb-1 pb-2">
                <h3 className="mb-2 font-bold">System Info</h3>
                <div className="grid grid-cols-2 gap-1">
                  <div className="text-right after:content-[':']">
                    IP Address
                  </div>
                  <div className="text-left">{ipAddress}</div>
                  <div className="text-right after:content-[':']">
                    MQTT Topic
                  </div>
                  <div className="text-left">{topicItem}</div>
                  <div className="text-right after:content-[':']">
                    Last Message
                  </div>
                  <div className="text-left">{formattedDateLastActivity}</div>
                  <div className="text-right after:content-[':']">
                    Last heartbeat
                  </div>
                  <div className="text-left">{formattedDateHealth}</div>
                </div>
              </section>
              <section className="flex flex-col items-stretch justify-between gap-2 mt-1 pt-2 border-t-2 border-t-primary-foreground">
                <h3 className="mb-2 font-bold">Config</h3>
                <ConfigItem
                  client={client}
                  topicItem={topicItem}
                  showHighDuration={showHighDuration}
                />
              </section>
            </div>
          </DialogContent>
        </Dialog>
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
