import { useCallback, useEffect, useMemo, useState } from "react";
import {
  enumControlMode,
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
import { ControlClient } from "@/lib/control-client";
import {
  DEFAULT_HIGH_DURATION_MS,
  DEFAULT_TARGET_WEIGHT_CHANGE,
} from "@/constants";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ConfigItem, { ConfigLoadState } from "./ConfigItem";
import { Button } from "./ui/button";
import { RotateCcw } from "lucide-react";

export enum enumSwitchStatus {
  LOW = "LOW",
  HIGH = "HIGH",
  UNKNOWN = "UNKNOWN",
}

export default function ControlItem(props: {
  client: ControlClient | null;
  topicItem: mqttTopicItem;
  showConfigControls: boolean;
}) {
  const { client, topicItem, showConfigControls } = props;

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

  const [status, setStatus] = useState<enumSwitchStatus>(enumSwitchStatus.LOW);
  const [lastUpdated, setLastUpdated] = useState<string>("Unregistered");
  const [ipAddress, setIpAddress] = useState<string>("Unknown");
  const [healthLastUpdated, setHealthLastUpdated] = useState<string>("Unknown");
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightChange, setWeightChange] = useState<number | null>(null);
  const [progressValue, setProgressValue] = useState<number | null>(null);
  const [progressTarget, setProgressTarget] = useState<number | null>(null);
  const [progressUnit, setProgressUnit] = useState<string>("");
  const [lastWeightUpdate, setLastWeightUpdate] = useState<string>("Unknown");
  const [lastReason, setLastReason] = useState<string | null>(null);
  const [healthActive, setHealthActive] = useState<boolean>(false);
  const [healthWeight, setHealthWeight] = useState<number | null>(null);
  const [controlMode, setControlMode] = useState<enumControlMode>(
    enumControlMode.WEIGHT
  );
  const [highDuration, setHighDuration] = useState<number>(
    DEFAULT_HIGH_DURATION_MS
  );
  const [targetWeightChange, setTargetWeightChange] = useState<number>(
    DEFAULT_TARGET_WEIGHT_CHANGE
  );
  const [heartbeatInterval, setHeartbeatInterval] = useState<number>(5);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [configLoadState, setConfigLoadState] =
    useState<ConfigLoadState>("loading");

  const onMessageReceived = useCallback(
    (topic: string, payload: MqttMessageAny) => {
      switch (payload.type) {
        case enumMqttTopicType.STATUS:
          if (topic === topicStatus) {
            const message = payload.message as ValveStatusPayload;
            if (
              "controlMode" in message &&
              typeof message.controlMode === "string"
            ) {
              setControlMode(
                message.controlMode === enumControlMode.TIME
                  ? enumControlMode.TIME
                  : enumControlMode.WEIGHT
              );
            }
            setCurrentWeight(message.weight);
            setWeightChange(message.weightChange);
            setProgressValue(
              typeof message.progressValue === "number"
                ? message.progressValue
                : null
            );
            setProgressTarget(
              typeof message.targetValue === "number" ? message.targetValue : null
            );
            setProgressUnit(
              typeof message.progressUnit === "string" ? message.progressUnit : ""
            );
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
          if (topic === topicConfig) {
            if (payload.message.controlMode) {
              setControlMode(payload.message.controlMode);
            }
            if (typeof payload.message.highDuration === "number") {
              setHighDuration(payload.message.highDuration);
              if (
                (payload.message.controlMode ?? controlMode) === enumControlMode.TIME
              ) {
                setProgressTarget(payload.message.highDuration / 1000);
                setProgressUnit("s");
              }
            }
            if (typeof payload.message.targetWeightChange === "number") {
              setTargetWeightChange(payload.message.targetWeightChange);
              if (
                (payload.message.controlMode ?? controlMode) ===
                enumControlMode.WEIGHT
              ) {
                setProgressTarget(payload.message.targetWeightChange);
                setProgressUnit("g");
              }
            }
            if (typeof payload.message.heartbeatInterval === "number") {
              setHeartbeatInterval(payload.message.heartbeatInterval);
            }
          }
          break;
        case enumMqttTopicType.HEALTH:
          if (topic === topicHealth) {
            const message = payload.message as ValveHealthPayload;
            setIpAddress(message.ipAddress);
            setHealthActive(Boolean(message.active));
            setHealthWeight(message.weight);
            setHealthLastUpdated(payload.timestamp);
          }
          break;
        default:
          break;
      }
    },
    [controlMode, topicConfig, topicHealth, topicStatus]
  );

  const { clientStatus, refreshTopics } = useMqttClient({
    mqttClient: client,
    topics: [topicControl, topicStatus, topicHealth, topicConfig],
    onMessage: onMessageReceived,
  });

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
    () => (currentWeight === null ? "Unknown" : currentWeight.toFixed(2)),
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
    () => (healthWeight === null ? "Unknown" : healthWeight.toFixed(2)),
    [healthWeight]
  );

  const formattedHighDuration: string = useMemo(
    () => `${(highDuration / 1000).toFixed(1)}s`,
    [highDuration]
  );

  const progressDisplay: string = useMemo(() => {
    const fallbackTarget =
      controlMode === enumControlMode.TIME
        ? highDuration / 1000
        : targetWeightChange;
    const resolvedTarget = progressTarget ?? fallbackTarget;
    const resolvedUnit =
      progressUnit || (controlMode === enumControlMode.TIME ? "s" : "g");
    const currentText = progressValue === null ? "-" : progressValue.toFixed(1);

    return `${currentText}/${resolvedTarget.toFixed(1)} ${resolvedUnit}`;
  }, [
    controlMode,
    highDuration,
    progressTarget,
    progressUnit,
    progressValue,
    targetWeightChange,
  ]);

  const formattedTopicString: string = useMemo(
    () => formatTopicFromTopicString(topicItem),
    [topicItem]
  );
  const configFormId = useMemo(
    () => `valve-config-${topicItem.replace("/", "-")}`,
    [topicItem]
  );

  const showWeightInfo = controlMode === enumControlMode.WEIGHT;
  const defaultAccordionValue = showConfigControls ? ["config"] : ["system-info"];

  return (
    <div className="table-grid-row w-full border-b-1 border-primary-foreground py-2">
      <div className="flex items-center justify-center text-center">
        <SwitchStatusText status={status} />
      </div>
      <div className="flex justify-start">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <div className="flex w-full items-center justify-between gap-3">
              <span className="flex-1 truncate">{formattedTopicString}</span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {progressDisplay}
              </span>
            </div>
          </DialogTrigger>
          <DialogContent
            className="flex max-h-[80vh] max-w-xs flex-col overflow-hidden md:max-w-sm"
            forceMount
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1.5 right-10"
              aria-label="Refresh valve info"
              onClick={() => refreshTopics()}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-left truncate">
                {formattedTopicString}
              </DialogTitle>
            </DialogHeader>
            <Accordion
              type="multiple"
              defaultValue={defaultAccordionValue}
              className="mt-3 flex-1 overflow-hidden"
            >
              <AccordionItem value="system-info" className="overflow-hidden">
                <AccordionTrigger className="py-3 font-bold hover:no-underline">
                  System Info
                </AccordionTrigger>
                <AccordionContent className="max-h-[22vh] overflow-y-auto">
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
                      Control mode
                    </div>
                    <div className="text-left capitalize">{controlMode}</div>
                    <div className="text-right after:content-[':']">
                      Open duration
                    </div>
                    <div className="text-left">{formattedHighDuration}</div>
                    <div className="text-right after:content-[':']">
                      Heartbeat interval
                    </div>
                    <div className="text-left">
                      {heartbeatInterval.toFixed(1)} min
                    </div>
                    <div className="text-right after:content-[':']">
                      Last close reason
                    </div>
                    <div className="text-left">{lastReason ?? "-"}</div>
                    {showWeightInfo ? (
                      <>
                        <div className="text-right after:content-[':']">
                          Current weight
                        </div>
                        <div className="text-left">{formattedCurrentWeight}</div>
                        <div className="text-right after:content-[':']">
                          Weight Delta
                        </div>
                        <div className="text-left">{formattedWeightChange}</div>
                        <div className="text-right after:content-[':']">
                          Last weight update
                        </div>
                        <div className="text-left">{formattedLastWeightUpdate}</div>
                        <div className="text-right after:content-[':']">
                          Heartbeat weight
                        </div>
                        <div className="text-left">{formattedHealthWeight}</div>
                      </>
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {showConfigControls ? (
                <AccordionItem value="config" className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <AccordionTrigger className="py-3 font-bold hover:no-underline">
                    Config
                  </AccordionTrigger>
                  <AccordionContent className="flex-1 overflow-hidden pb-0">
                    <div className="max-h-[30vh] overflow-y-auto">
                      <ConfigItem
                        client={client}
                        topicItem={topicItem}
                        isOpen={isDialogOpen}
                        onConfigStateChange={setConfigLoadState}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ) : null}
            </Accordion>
            {showConfigControls ? (
              <DialogFooter className="shrink-0">
                <Button
                  type="submit"
                  form={configFormId}
                  disabled={configLoadState === "loading"}
                >
                  Save config
                </Button>
              </DialogFooter>
            ) : null}
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
