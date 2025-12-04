import { useCallback, useEffect, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  MqttMessageAny,
  MqttControlMessage,
  ValveStatusPayload,
  ValveHealthPayload,
} from "../types";
import { enumClientStatus } from "../types";
import { dateFormatter, formatTopicFromTopicString } from "../utils";
import { Switch } from "./ui/switch";
import SwitchStatusText from "./SwitchStatusText";
import { useMqttClient } from "./hooks/useMqttClient";
import { CONTROLLER_DEVICE_ID_TO_TOPIC, DEFAULT_TARGET_WEIGHT_CHANGE } from "@/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ConfigItem from "./ConfigItem";
import { Button } from "./ui/button";
import { RotateCcw } from "lucide-react";

export enum enumSwitchStatus {
  LOW = "LOW",
  HIGH = "HIGH",
  UNKNOWN = "UNKNOWN",
}

export default function ControlItem(props: {
  client: MqttClient | null;
  topicItem: mqttTopicItem;
  showWeightConfig: boolean;
}) {
  const { client, topicItem, showWeightConfig } = props;

  const onMessageReceived = (topic: string, payload: MqttMessageAny) => {
    switch (payload.type) {
      case enumMqttTopicType.STATUS:
        if (topic === topicStatus) {
          const message = payload.message as ValveStatusPayload;
          if (typeof message.weight === "number") {
            setCurrentWeight(message.weight);
          } else {
            setCurrentWeight(null);
          }
          if (typeof message.weightChange === "number") {
            setWeightChange(message.weightChange);
          } else {
            setWeightChange(null);
          }
          setLastWeightUpdate(payload.timestamp);
          setLastUpdated(payload.timestamp);

          if (message.reason !== undefined) {
            setLastReason(message.reason ? message.reason : null);
          }

          if (message.state === "HIGH") {
            setStatus(enumSwitchStatus.HIGH);
          } else if (message.state === "LOW") {
            setStatus(enumSwitchStatus.LOW);
          } else {
            setStatus(enumSwitchStatus.UNKNOWN);
          }
        }
        break;
      case enumMqttTopicType.CONFIG:
        if (
          topic === topicConfig &&
          payload.message.configType === "weightControl"
        ) {
          if (typeof payload.message.targetWeightChange === "number") {
            setTargetWeightChange(payload.message.targetWeightChange);
          }
        }
        break;
      case enumMqttTopicType.HEALTH:
        if (topic === topicHealth) {
          const message = payload.message as ValveHealthPayload;
          setIpAddress(message.ipAddress);
          setHealthActive(Boolean(message.active));
          if (typeof message.weight === "number") {
            setHealthWeight(message.weight);
          } else {
            setHealthWeight(null);
          }
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
  const topicConfig: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONFIG),
    [topicItem]
  );

  const { clientStatus, refreshTopics } = useMqttClient({
    mqttClient: client,
    topics: [topicControl, topicStatus, topicHealth, topicConfig],
    onMessage: onMessageReceived,
  });
  const [status, setStatus] = useState<enumSwitchStatus>(enumSwitchStatus.LOW);
  const [lastUpdated, setLastUpdated] = useState<string>("Unregistered");
  const [ipAddress, setIpAddress] = useState<string>("Unknown");
  const [healthLastUpdated, setHealthLastUpdated] = useState<string>("Unknown");
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightChange, setWeightChange] = useState<number | null>(null);
  const [lastWeightUpdate, setLastWeightUpdate] = useState<string>("Unknown");
  const [lastReason, setLastReason] = useState<string | null>(null);
  const [healthActive, setHealthActive] = useState<boolean>(false);
  const [healthWeight, setHealthWeight] = useState<number | null>(null);
  const [targetWeightChange, setTargetWeightChange] = useState<number>(
    DEFAULT_TARGET_WEIGHT_CHANGE
  );

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

  const formattedCurrentWeight: string = useMemo(
    () =>
      currentWeight === null ? "Unknown" : currentWeight.toFixed(2),
    [currentWeight]
  );

  const formattedWeightChange: string = useMemo(
    () => (weightChange === null ? "Unknown" : weightChange.toFixed(2)),
    [weightChange]
  );

  const formattedLastWeightUpdate: string = useMemo(
    () =>
      lastWeightUpdate === "Unknown"
        ? lastWeightUpdate
        : dateFormatter.format(new Date(lastWeightUpdate)),
    [lastWeightUpdate]
  );

  const formattedHealthWeight: string = useMemo(
    () =>
      healthWeight === null ? "Unknown" : healthWeight.toFixed(2),
    [healthWeight]
  );

  const formattedTargetWeightChange: string = useMemo(
    () => targetWeightChange.toFixed(2),
    [targetWeightChange]
  );

  const weightChangeDisplay: string = useMemo(() => {
    if (status === enumSwitchStatus.HIGH) {
      const weightChangeText =
        weightChange === null ? "—" : weightChange.toFixed(2);
      return `${weightChangeText}/${formattedTargetWeightChange}`;
    }

    return formattedTargetWeightChange;
  }, [formattedTargetWeightChange, status, weightChange]);

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
            <div className="flex w-full items-center justify-between gap-3">
              <span className="flex-1 truncate">{formattedTopicString}</span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {weightChangeDisplay}
              </span>
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-xs md:max-w-sm" forceMount>
            <DialogHeader className="flex flex-row items-center justify-between gap-2">
              <DialogTitle className="text-left truncate">
                {formattedTopicString}
              </DialogTitle>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Refresh valve info"
                onClick={() => refreshTopics()}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
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
                  <div className="text-right after:content-[':']">
                    Valve active
                  </div>
                  <div className="text-left">{healthActive ? "Yes" : "No"}</div>
                  <div className="text-right after:content-[':']">
                    Current weight
                  </div>
                  <div className="text-left">{formattedCurrentWeight}</div>
                  <div className="text-right after:content-[':']">
                    Weight Δ
                  </div>
                  <div className="text-left">{formattedWeightChange}</div>
                  <div className="text-right after:content-[':']">
                    Last weight update
                  </div>
                  <div className="text-left">{formattedLastWeightUpdate}</div>
                  <div className="text-right after:content-[':']">
                    Last close reason
                  </div>
                  <div className="text-left">{lastReason ?? "—"}</div>
                  <div className="text-right after:content-[':']">
                    Heartbeat weight
                  </div>
                  <div className="text-left">{formattedHealthWeight}</div>
                </div>
              </section>
              <section className="flex flex-col items-stretch justify-between gap-2 mt-1 pt-2 border-t-2 border-t-primary-foreground">
                <h3 className="mb-2 font-bold">Config</h3>
                <ConfigItem
                  client={client}
                  topicItem={topicItem}
                  showWeightConfig={showWeightConfig}
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
