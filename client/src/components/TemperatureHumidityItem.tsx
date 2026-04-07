import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RotateCcw, Thermometer } from "lucide-react";
import { toast } from "sonner";

import { ControlClient } from "@/lib/control-client";
import {
  enumMqttTopicType,
  getMqttTopicId,
  MqttConfigMessage,
  MqttMessageAny,
  mqttTopicId,
  mqttTopicItem,
  SensorHealthPayload,
  SensorStatusPayload,
} from "@/types";
import { dateFormatter, formatTopicFromTopicStringWithMap } from "@/utils";
import { useMqttClient } from "./hooks/useMqttClient";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { ConfigLabel } from "./ConfigInputField";
import {
  DEFAULT_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
  MAX_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
  MIN_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
  TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC,
} from "@/constants";

type ConfigLoadState = "loading" | "ready" | "missing";

export default function TemperatureHumidityItem(props: {
  client: ControlClient | null;
  topicItem: mqttTopicItem;
}) {
  const { client, topicItem } = props;
  const topicStatus: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.STATUS),
    [topicItem]
  );
  const topicConfig: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONFIG),
    [topicItem]
  );
  const topicConfigGet = useMemo(() => `${topicConfig}/get`, [topicConfig]);
  const topicHealth: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.HEALTH),
    [topicItem]
  );
  const topicStatusGet = useMemo(() => `${topicStatus}/get`, [topicStatus]);
  const formId = useMemo(
    () => `sensor-config-${topicItem.replace("/", "-")}`,
    [topicItem]
  );

  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [heartbeatIntervalSeconds, setHeartbeatIntervalSeconds] = useState<number>(
    DEFAULT_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS
  );
  const [heartbeatIntervalInput, setHeartbeatIntervalInput] = useState<string>(
    DEFAULT_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS.toString()
  );
  const [heartbeatIntervalMinSeconds, setHeartbeatIntervalMinSeconds] =
    useState<number>(MIN_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS);
  const [heartbeatIntervalMaxSeconds, setHeartbeatIntervalMaxSeconds] =
    useState<number>(MAX_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS);
  const [heartbeatIntervalDefaultSeconds, setHeartbeatIntervalDefaultSeconds] =
    useState<number>(DEFAULT_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS);
  const [ipAddress, setIpAddress] = useState("Unknown");
  const [online, setOnline] = useState<boolean>(false);
  const [lastReadingAt, setLastReadingAt] = useState("Unknown");
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState("Unknown");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditingHeartbeatInput, setIsEditingHeartbeatInput] = useState(false);
  const [heartbeatIntervalError, setHeartbeatIntervalError] = useState("");
  const [configLoadState, setConfigLoadState] =
    useState<ConfigLoadState>("loading");
  const [hasReceivedConfig, setHasReceivedConfig] = useState(false);

  const onMessageReceived = useCallback(
    (topic: string, payload: MqttMessageAny) => {
      switch (payload.type) {
        case enumMqttTopicType.STATUS:
          if (topic !== topicStatus) return;
          {
            const message = payload.message as SensorStatusPayload;
            setTemperature(message.temperature);
            setHumidity(message.humidity);
            if (typeof message.heartbeatIntervalSeconds === "number") {
              setHeartbeatIntervalSeconds(message.heartbeatIntervalSeconds);
            }
            setLastReadingAt(payload.timestamp);
          }
          break;
        case enumMqttTopicType.CONFIG:
          if (topic !== topicConfig) return;
          if (typeof payload.message.heartbeatIntervalSeconds === "number") {
            setHeartbeatIntervalSeconds(payload.message.heartbeatIntervalSeconds);
          }
          if (typeof payload.message.heartbeatIntervalMinSeconds === "number") {
            setHeartbeatIntervalMinSeconds(
              payload.message.heartbeatIntervalMinSeconds
            );
          }
          if (typeof payload.message.heartbeatIntervalMaxSeconds === "number") {
            setHeartbeatIntervalMaxSeconds(
              payload.message.heartbeatIntervalMaxSeconds
            );
          }
          if (
            typeof payload.message.heartbeatIntervalDefaultSeconds === "number"
          ) {
            setHeartbeatIntervalDefaultSeconds(
              payload.message.heartbeatIntervalDefaultSeconds
            );
          }
          setHasReceivedConfig(true);
          setConfigLoadState("ready");
          setHeartbeatIntervalError("");
          break;
        case enumMqttTopicType.HEALTH:
          if (topic !== topicHealth) return;
          {
            const message = payload.message as SensorHealthPayload;
            setIpAddress(message.ipAddress);
            setOnline(Boolean(message.online));
            if (typeof message.lastReadingAt === "string") {
              setLastReadingAt(message.lastReadingAt);
            }
            if (typeof message.heartbeatIntervalSeconds === "number") {
              setHeartbeatIntervalSeconds(message.heartbeatIntervalSeconds);
            }
            setLastHeartbeatAt(payload.timestamp);
          }
          break;
        default:
          break;
      }
    },
    [topicConfig, topicHealth, topicStatus]
  );

  const { refreshTopics } = useMqttClient({
    mqttClient: client,
    topics: [topicStatus, topicConfig, topicHealth],
    onMessage: onMessageReceived,
  });

  useEffect(() => {
    if (isEditingHeartbeatInput) {
      return;
    }
    setHeartbeatIntervalInput(heartbeatIntervalSeconds.toFixed(0));
  }, [heartbeatIntervalSeconds, isEditingHeartbeatInput]);

  const formattedTopic = useMemo(
    () =>
      formatTopicFromTopicStringWithMap(
        topicItem,
        TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC
      ),
    [topicItem]
  );

  const requestCurrentReading = useCallback(() => {
    const message = {
      type: enumMqttTopicType.STATUS,
      message: "GET",
      timestamp: new Date().toISOString(),
    };

    client?.publish(topicStatusGet, JSON.stringify(message), { retain: false });
    toast.success(formattedTopic, {
      description: "Manual reading requested.",
    });
  }, [client, formattedTopic, topicStatusGet]);

  const requestConfigSnapshot = useCallback(() => {
    refreshTopics();

    const message = {
      type: enumMqttTopicType.CONFIG,
      message: "GET",
      timestamp: new Date().toISOString(),
    };

    client?.publish(topicConfigGet, JSON.stringify(message), { retain: false });
  }, [client, refreshTopics, topicConfigGet]);

  const refreshSensorInfo = useCallback(() => {
    requestConfigSnapshot();

    const message = {
      type: enumMqttTopicType.STATUS,
      message: "GET",
      timestamp: new Date().toISOString(),
    };

    client?.publish(topicStatusGet, JSON.stringify(message), { retain: false });
  }, [client, requestConfigSnapshot, topicStatusGet]);

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    setHasReceivedConfig(false);
    setConfigLoadState("loading");
    setHeartbeatIntervalError("");
    requestConfigSnapshot();

    const timeoutId = window.setTimeout(() => {
      setHasReceivedConfig((current) => {
        if (!current) {
          setConfigLoadState("missing");
        }
        return current;
      });
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [isDialogOpen, requestConfigSnapshot]);

  const validateHeartbeatInput = useCallback(
    (value: string) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return {
          error: "Heartbeat interval must be a valid number.",
          value: null,
        };
      }

      if (!Number.isInteger(parsed)) {
        return {
          error: "Heartbeat interval must be a whole number of seconds.",
          value: null,
        };
      }

      if (parsed < heartbeatIntervalMinSeconds) {
        return {
          error: `Heartbeat interval must be at least ${heartbeatIntervalMinSeconds}s.`,
          value: null,
        };
      }

      if (parsed > heartbeatIntervalMaxSeconds) {
        return {
          error: `Heartbeat interval must be at most ${heartbeatIntervalMaxSeconds}s.`,
          value: null,
        };
      }

      return {
        error: "",
        value: parsed,
      };
    },
    [heartbeatIntervalMaxSeconds, heartbeatIntervalMinSeconds]
  );

  const commitHeartbeatInput = useCallback(() => {
    const validation = validateHeartbeatInput(heartbeatIntervalInput);
    if (validation.value === null) {
      setHeartbeatIntervalError(validation.error);
      return;
    }

    setHeartbeatIntervalError("");
    setHeartbeatIntervalSeconds(validation.value);
    setHeartbeatIntervalInput(validation.value.toFixed(0));
  }, [
    heartbeatIntervalInput,
    validateHeartbeatInput,
  ]);

  const publishConfig = useCallback(() => {
    const validation = validateHeartbeatInput(heartbeatIntervalInput);
    if (validation.value === null) {
      setHeartbeatIntervalError(validation.error);
      return;
    }

    const nextHeartbeatIntervalSeconds = validation.value;

    setHeartbeatIntervalSeconds(nextHeartbeatIntervalSeconds);
    setHeartbeatIntervalInput(nextHeartbeatIntervalSeconds.toFixed(0));
    setHeartbeatIntervalError("");

    const message: MqttConfigMessage = {
      type: enumMqttTopicType.CONFIG,
      message: {
        heartbeatIntervalSeconds: nextHeartbeatIntervalSeconds,
      },
      timestamp: new Date().toISOString(),
    };

    client?.publish(topicConfig, JSON.stringify(message), { retain: true });
    toast.success(topicConfig, {
      description: `Heartbeat interval updated to ${nextHeartbeatIntervalSeconds.toFixed(
        0
      )}s`,
    });
  }, [
    client,
    heartbeatIntervalInput,
    topicConfig,
    validateHeartbeatInput,
  ]);

  const formattedTemperature = useMemo(
    () => (temperature === null ? "-" : `${temperature.toFixed(1)} C`),
    [temperature]
  );
  const formattedHumidity = useMemo(
    () => (humidity === null ? "-" : `${humidity.toFixed(1)} %`),
    [humidity]
  );
  const formattedLastReading = useMemo(
    () =>
      lastReadingAt === "Unknown"
        ? lastReadingAt
        : dateFormatter.format(new Date(lastReadingAt)),
    [lastReadingAt]
  );
  const formattedHeartbeat = useMemo(
    () =>
      lastHeartbeatAt === "Unknown"
        ? lastHeartbeatAt
        : dateFormatter.format(new Date(lastHeartbeatAt)),
    [lastHeartbeatAt]
  );

  return (
    <div className="flex w-full items-center gap-2 border-b-1 border-primary-foreground py-2">
      <div className="min-w-0 flex-1">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <div className="flex w-full cursor-pointer items-center justify-start">
              <span className="truncate">{formattedTopic}</span>
            </div>
          </DialogTrigger>
          <DialogContent
            className="flex max-h-[80vh] min-h-0 max-w-xs flex-col overflow-hidden md:max-w-sm"
            forceMount
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1.5 right-10"
              aria-label="Refresh sensor info"
              onClick={refreshSensorInfo}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <DialogHeader className="shrink-0">
              <DialogTitle className="truncate text-left">
                {formattedTopic}
              </DialogTitle>
            </DialogHeader>
            <Accordion
              type="multiple"
              defaultValue={["system-info", "config"]}
              className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <AccordionItem value="system-info" className="overflow-hidden">
                <AccordionTrigger className="py-3 font-bold hover:no-underline">
                  System Info
                </AccordionTrigger>
                <AccordionContent className="max-h-[35vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1">
                    <div className="text-right after:content-[':']">IP Address</div>
                    <div className="text-left">{ipAddress}</div>
                    <div className="text-right after:content-[':']">MQTT Topic</div>
                    <div className="text-left">{topicItem}</div>
                    <div className="text-right after:content-[':']">Device ID</div>
                    <div className="text-left">{topicItem.split("/")[0]}</div>
                    <div className="text-right after:content-[':']">Online</div>
                    <div className="text-left">{online ? "Yes" : "No"}</div>
                    <div className="text-right after:content-[':']">Temperature</div>
                    <div className="text-left">{formattedTemperature}</div>
                    <div className="text-right after:content-[':']">Humidity</div>
                    <div className="text-left">{formattedHumidity}</div>
                    <div className="text-right after:content-[':']">Last reading</div>
                    <div className="text-left">{formattedLastReading}</div>
                    <div className="text-right after:content-[':']">Last heartbeat</div>
                    <div className="text-left">{formattedHeartbeat}</div>
                    <div className="text-right after:content-[':']">Heartbeat interval</div>
                    <div className="text-left">
                      {heartbeatIntervalSeconds.toFixed(0)} s
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="config"
                className="flex min-h-0 flex-col overflow-hidden data-[state=open]:flex-1"
              >
                <AccordionTrigger className="py-3 font-bold hover:no-underline">
                  Config
                </AccordionTrigger>
                <AccordionContent className="flex min-h-0 flex-1 flex-col overflow-hidden pb-0">
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {configLoadState === "loading" ? (
                      <div className="flex min-h-32 items-center justify-center px-4 py-6 text-center">
                        <div className="flex max-w-xs flex-col items-center gap-3">
                          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Loading retained MQTT config for this sensor...
                          </p>
                        </div>
                      </div>
                    ) : null}
                    <form
                      id={formId}
                      onSubmit={(event) => {
                        event.preventDefault();
                        publishConfig();
                      }}
                      className={configLoadState === "loading" ? "hidden" : "flex flex-col gap-4"}
                    >
                      <div className="flex flex-col items-start justify-center gap-2 w-full">
                        <ConfigLabel
                          htmlFor={`${topicItem}-heartbeat-interval`}
                          label="Heartbeat interval"
                          tooltip="How often the sensor publishes a fresh temperature and humidity reading."
                        />
                        <div className="flex w-full items-center justify-between gap-2">
                          <Slider
                            value={[heartbeatIntervalSeconds]}
                            onValueChange={([value]) => {
                              setHeartbeatIntervalSeconds(value);
                              setHeartbeatIntervalInput(value.toFixed(0));
                              setHeartbeatIntervalError("");
                            }}
                            min={heartbeatIntervalMinSeconds}
                            max={heartbeatIntervalMaxSeconds}
                            step={1}
                            name={`${topicItem}-heartbeat-interval`}
                          />
                            <Input
                              id={`${topicItem}-heartbeat-interval`}
                              type="number"
                              min={heartbeatIntervalMinSeconds}
                              max={heartbeatIntervalMaxSeconds}
                              step={1}
                              value={heartbeatIntervalInput}
                              onChange={(event) => {
                                setHeartbeatIntervalInput(event.target.value);
                                if (heartbeatIntervalError) {
                                  setHeartbeatIntervalError("");
                                }
                              }}
                              onFocus={() => setIsEditingHeartbeatInput(true)}
                              onBlur={() => {
                                setIsEditingHeartbeatInput(false);
                                commitHeartbeatInput();
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitHeartbeatInput();
                                }
                              }}
                              aria-invalid={heartbeatIntervalError ? true : undefined}
                              className="text-center w-auto"
                            />
                            <p>s</p>
                        </div>
                        {heartbeatIntervalError ? (
                          <p className="text-sm text-destructive">
                            {heartbeatIntervalError}
                          </p>
                        ) : null}
                        {configLoadState === "missing" ? (
                          <p className="text-sm text-muted-foreground">
                            No retained config was found. Default values are shown
                            until you save.
                          </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                          Default {heartbeatIntervalDefaultSeconds}s, min{" "}
                          {heartbeatIntervalMinSeconds}s, max{" "}
                          {heartbeatIntervalMaxSeconds}s.
                        </p>
                      </div>
                    </form>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <DialogFooter className="shrink-0">
              <Button
                type="submit"
                form={formId}
                disabled={configLoadState === "loading"}
              >
                Save config
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="w-14 shrink-0 text-center">{formattedTemperature}</div>
      <div className="w-16 shrink-0 text-center">{formattedHumidity}</div>
      <div className="flex w-10 shrink-0 items-center justify-end">
        <Button
          variant="outline"
          size="icon"
          onClick={requestCurrentReading}
          aria-label={`Request current reading for ${formattedTopic}`}
        >
          <Thermometer className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
