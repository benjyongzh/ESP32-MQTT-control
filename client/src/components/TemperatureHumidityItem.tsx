import { useCallback, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
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
import { Slider } from "./ui/slider";
import { ConfigLabel } from "./ConfigInputField";
import {
  DEFAULT_TEMPERATURE_SENSOR_READ_INTERVAL_SECONDS,
  MAX_TEMPERATURE_SENSOR_READ_INTERVAL_SECONDS,
  MIN_TEMPERATURE_SENSOR_READ_INTERVAL_SECONDS,
  TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC,
} from "@/constants";

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
  const topicHealth: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.HEALTH),
    [topicItem]
  );
  const formId = useMemo(
    () => `sensor-config-${topicItem.replace("/", "-")}`,
    [topicItem]
  );

  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [readingIntervalSeconds, setReadingIntervalSeconds] = useState<number>(
    DEFAULT_TEMPERATURE_SENSOR_READ_INTERVAL_SECONDS
  );
  const [ipAddress, setIpAddress] = useState("Unknown");
  const [online, setOnline] = useState<boolean>(false);
  const [lastReadingAt, setLastReadingAt] = useState("Unknown");
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState("Unknown");

  const onMessageReceived = useCallback(
    (topic: string, payload: MqttMessageAny) => {
      switch (payload.type) {
        case enumMqttTopicType.STATUS:
          if (topic !== topicStatus) return;
          {
            const message = payload.message as SensorStatusPayload;
            setTemperature(message.temperature);
            setHumidity(message.humidity);
            if (typeof message.readingIntervalSeconds === "number") {
              setReadingIntervalSeconds(message.readingIntervalSeconds);
            }
            setLastReadingAt(payload.timestamp);
          }
          break;
        case enumMqttTopicType.CONFIG:
          if (topic !== topicConfig) return;
          if (typeof payload.message.readingIntervalSeconds === "number") {
            setReadingIntervalSeconds(payload.message.readingIntervalSeconds);
          }
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

  const publishConfig = useCallback(() => {
    const nextReadingIntervalSeconds = Math.min(
      Math.max(
        readingIntervalSeconds,
        MIN_TEMPERATURE_SENSOR_READ_INTERVAL_SECONDS
      ),
      MAX_TEMPERATURE_SENSOR_READ_INTERVAL_SECONDS
    );

    setReadingIntervalSeconds(nextReadingIntervalSeconds);

    const message: MqttConfigMessage = {
      type: enumMqttTopicType.CONFIG,
      message: {
        readingIntervalSeconds: nextReadingIntervalSeconds,
      },
      timestamp: new Date().toISOString(),
    };

    client?.publish(topicConfig, JSON.stringify(message), { retain: true });
    toast.success(topicConfig, {
      description: `Sensor reading interval updated to ${nextReadingIntervalSeconds.toFixed(
        0
      )}s`,
    });
  }, [client, readingIntervalSeconds, topicConfig]);

  const formattedTopic = useMemo(
    () =>
      formatTopicFromTopicStringWithMap(
        topicItem,
        TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC
      ),
    [topicItem]
  );

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
    <div className="table-grid-row-temp-humidity w-full border-b-1 border-primary-foreground py-2">
      <div className="flex justify-start">
        <Dialog>
          <DialogTrigger asChild>
            <div className="flex w-full cursor-pointer items-center justify-start">
              <span className="truncate">{formattedTopic}</span>
            </div>
          </DialogTrigger>
          <DialogContent
            className="flex max-h-[60vh] min-h-0 max-w-xs flex-col overflow-hidden md:max-w-sm"
            forceMount
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1.5 right-10"
              aria-label="Refresh sensor info"
              onClick={() => refreshTopics()}
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
                <AccordionContent className="max-h-[22vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-1">
                    <div className="text-right after:content-[':']">IP Address</div>
                    <div className="text-left">{ipAddress}</div>
                    <div className="text-right after:content-[':']">MQTT Topic</div>
                    <div className="text-left">{topicItem}</div>
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
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-4">
                    <form
                      id={formId}
                      onSubmit={(event) => {
                        event.preventDefault();
                        publishConfig();
                      }}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex flex-col items-start justify-center gap-2 w-full">
                        <ConfigLabel
                          htmlFor={`${topicItem}-reading-interval`}
                          label="Reading interval"
                          tooltip="How often the controller reads and publishes temperature and humidity updates."
                        />
                        <div className="flex w-full gap-2">
                          <Slider
                            value={[readingIntervalSeconds]}
                            onValueChange={([value]) =>
                              setReadingIntervalSeconds(value)
                            }
                            min={MIN_TEMPERATURE_SENSOR_READ_INTERVAL_SECONDS}
                            max={MAX_TEMPERATURE_SENSOR_READ_INTERVAL_SECONDS}
                            step={1}
                            name={`${topicItem}-reading-interval`}
                            className="flex-3"
                          />
                          <p className="flex-1 text-left">
                            {readingIntervalSeconds.toFixed(0)} s
                          </p>
                        </div>
                      </div>
                    </form>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <DialogFooter className="shrink-0 border-t bg-background pt-3">
              <Button type="submit" form={formId}>
                Save config
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="text-center">{formattedTemperature}</div>
      <div className="text-center">{formattedHumidity}</div>
    </div>
  );
}
