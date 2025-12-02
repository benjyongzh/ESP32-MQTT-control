import { useCallback, useEffect, useMemo, useState } from "react";
import { MqttClient } from "mqtt";
import {
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  MqttMessageAny,
  MqttConfigMessage,
} from "../types";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { toast } from "sonner";
import { useMqttClient } from "./hooks/useMqttClient";
import {
  HEARTBEAT_INTERVAL_MIN,
  HEARTBEAT_INTERVAL_MAX,
  DEFAULT_TARGET_WEIGHT_CHANGE,
  MIN_TARGET_WEIGHT_CHANGE,
  DEFAULT_TOLERANCE_WEIGHT,
  MIN_TOLERANCE_WEIGHT,
  DEFAULT_TOLERANCE_DURATION_MS,
  MIN_TOLERANCE_DURATION_MS,
  MAX_TOLERANCE_DURATION_MS,
  DEFAULT_WEIGHT_READ_INTERVAL_MS,
  MIN_WEIGHT_READ_INTERVAL_MS,
  MAX_WEIGHT_READ_INTERVAL_MS,
} from "@/constants";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function ConfigItem(props: {
  client: MqttClient | null;
  topicItem: mqttTopicItem;
  showWeightConfig: boolean;
}) {
  const { client, topicItem, showWeightConfig } = props;
  const [targetWeightChange, setTargetWeightChange] = useState<number>(
    DEFAULT_TARGET_WEIGHT_CHANGE
  );
  const [toleranceWeight, setToleranceWeight] = useState<number>(
    DEFAULT_TOLERANCE_WEIGHT
  );
  const [toleranceDurationMs, setToleranceDurationMs] = useState<number>(
    DEFAULT_TOLERANCE_DURATION_MS
  );
  const [toleranceDurationInput, setToleranceDurationInput] = useState<string>(
    (DEFAULT_TOLERANCE_DURATION_MS / 1000).toString()
  );
  const [weightReadIntervalMs, setWeightReadIntervalMs] = useState<number>(
    DEFAULT_WEIGHT_READ_INTERVAL_MS
  );
  const [heartbeatIntervalDuration, setHeartbeatIntervalDuration] =
    useState<number>(5); //minutes

  // const toleranceDurationSeconds = useMemo(
  //   () => toleranceDurationMs / 1000,
  //   [toleranceDurationMs]
  // );
  const weightReadIntervalSeconds = useMemo(
    () => weightReadIntervalMs / 1000,
    [weightReadIntervalMs]
  );

  const topicConfig: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONFIG),
    [topicItem]
  );

  useEffect(() => {
    setToleranceDurationInput((toleranceDurationMs / 1000).toString());
  }, [toleranceDurationMs]);

  const onMessageReceived = (_topic: string, payload: MqttMessageAny) => {
    switch (payload.type) {
      case enumMqttTopicType.CONFIG:
        switch (payload.message.configType) {
          case "weightControl":
            if (typeof payload.message.targetWeightChange === "number") {
              setTargetWeightChange(payload.message.targetWeightChange);
            }
            if (typeof payload.message.toleranceWeight === "number") {
              setToleranceWeight(payload.message.toleranceWeight);
            }
            if (typeof payload.message.toleranceDurationMs === "number") {
              setToleranceDurationMs(payload.message.toleranceDurationMs);
            }
            if (typeof payload.message.weightReadIntervalMs === "number") {
              setWeightReadIntervalMs(payload.message.weightReadIntervalMs);
            }
            break;
          case "heartbeatInterval":
            setHeartbeatIntervalDuration(
              payload.message.heartbeatInterval
            );
            break;
          default:
            break;
        }
        break;
      default:
        break;
    }
  };

  useMqttClient({
    mqttClient: client,
    topics: [topicConfig],
    onMessage: onMessageReceived,
  });

  const onWeightConfigCommit = useCallback(() => {
    const clampedTarget = Math.max(
      targetWeightChange,
      MIN_TARGET_WEIGHT_CHANGE
    );
    const clampedTolerance = Math.max(
      toleranceWeight,
      MIN_TOLERANCE_WEIGHT
    );
    const clampedToleranceDuration = Math.min(
      Math.max(toleranceDurationMs, MIN_TOLERANCE_DURATION_MS),
      MAX_TOLERANCE_DURATION_MS
    );
    const clampedWeightInterval = Math.min(
      Math.max(weightReadIntervalMs, MIN_WEIGHT_READ_INTERVAL_MS),
      MAX_WEIGHT_READ_INTERVAL_MS
    );

    setTargetWeightChange(clampedTarget);
    setToleranceWeight(clampedTolerance);
    setToleranceDurationMs(clampedToleranceDuration);
    setWeightReadIntervalMs(clampedWeightInterval);

    const message: MqttConfigMessage = {
      type: enumMqttTopicType.CONFIG,
      message: {
        configType: "weightControl",
        targetWeightChange: clampedTarget,
        toleranceWeight: clampedTolerance,
        toleranceDurationMs: clampedToleranceDuration,
        weightReadIntervalMs: clampedWeightInterval,
      },
      timestamp: new Date().toISOString(),
    };

    client?.publish(topicConfig, JSON.stringify(message), {
      retain: true,
    });
    toast.success(topicConfig, {
      description: `Weight control updated (target ${clampedTarget.toFixed(
        1
      )}, tolerance ${clampedTolerance.toFixed(1)}, timeout ${(
        clampedToleranceDuration / 1000
      ).toFixed(1)}s, interval ${(
        clampedWeightInterval / 1000
      ).toFixed(2)}s)`,
    });
  }, [
    client,
    targetWeightChange,
    toleranceWeight,
    toleranceDurationMs,
    weightReadIntervalMs,
    topicConfig,
  ]);

  const onHeartbeatIntervalCommit = useCallback(() => {
    const message: MqttConfigMessage = {
      type: enumMqttTopicType.CONFIG,
      message: {
        configType: "heartbeatInterval",
        heartbeatInterval: heartbeatIntervalDuration,
      },
      timestamp: new Date().toISOString(),
    };
    console.log("message to publish: ", topicConfig, message);
    client?.publish(topicConfig, JSON.stringify(message), {
      retain: true,
    });
    toast.success(topicConfig, {
      description: `Heartbeat interval updated to ${heartbeatIntervalDuration} minutes`,
    });
  }, [client, heartbeatIntervalDuration, topicConfig]);

  return (
    <div className="flex flex-col items-start justify-center gap-3">
      <div
        className={`flex flex-col items-start justify-center gap-2 w-full ${
          showWeightConfig ? "" : "hidden"
        }`}
      >
        <Label className="font-semibold" htmlFor={topicItem}>
          Weight Control
        </Label>
        <div className="grid w-full grid-cols-1 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${topicItem}-target-weight`}>
              Target weight change
            </Label>
            <Input
              id={`${topicItem}-target-weight`}
              type="number"
              min={MIN_TARGET_WEIGHT_CHANGE}
              step={0.1}
              value={targetWeightChange}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (!Number.isNaN(next)) {
                  setTargetWeightChange(next);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Weight loss required before closing the valve.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${topicItem}-tolerance-weight`}>
              Tolerance weight
            </Label>
            <Input
              id={`${topicItem}-tolerance-weight`}
              type="number"
              min={MIN_TOLERANCE_WEIGHT}
              step={0.1}
              value={toleranceWeight}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (!Number.isNaN(next)) {
                  setToleranceWeight(next);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Minimum weight loss expected within the tolerance window.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${topicItem}-tolerance-duration`}>
              Tolerance duration (seconds)
            </Label>
            <Input
              id={`${topicItem}-tolerance-duration`}
              type="number"
              min={MIN_TOLERANCE_DURATION_MS / 1000}
              max={MAX_TOLERANCE_DURATION_MS / 1000}
              step={0.5}
              value={toleranceDurationInput}
              onChange={(event) => {
                setToleranceDurationInput(event.target.value);
              }}
              onBlur={() => {
                const next = parseFloat(toleranceDurationInput);
                const clampedSeconds = Number.isFinite(next)
                  ? Math.min(
                      Math.max(next, MIN_TOLERANCE_DURATION_MS / 1000),
                      MAX_TOLERANCE_DURATION_MS / 1000
                    )
                  : MIN_TOLERANCE_DURATION_MS / 1000;
                setToleranceDurationMs(clampedSeconds * 1000);
                setToleranceDurationInput(clampedSeconds.toString());
              }}
            />
            <p className="text-xs text-muted-foreground">
              Time allowed for the tolerance weight decrease after opening.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${topicItem}-weight-interval`}>
              Sensor read interval (seconds)
            </Label>
            <Input
              id={`${topicItem}-weight-interval`}
              type="number"
              min={MIN_WEIGHT_READ_INTERVAL_MS / 1000}
              max={MAX_WEIGHT_READ_INTERVAL_MS / 1000}
              step={0.1}
              value={weightReadIntervalSeconds}
              onChange={(event) => {
                const next = event.target.valueAsNumber;
                if (!Number.isNaN(next)) {
                  setWeightReadIntervalMs(next * 1000);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              How frequently to sample the weight sensor while active.
            </p>
          </div>
        </div>
        <Button onClick={onWeightConfigCommit} className="self-end">
          Save weight config
        </Button>
      </div>
      <div className="flex flex-col items-start justify-center gap-2 w-full">
        <Label htmlFor={topicItem}>Heartbeat Interval</Label>
        <div className="flex gap-2 w-full">
          <Slider
            onValueChange={([value]) => setHeartbeatIntervalDuration(value)}
            onValueCommit={() => onHeartbeatIntervalCommit()}
            value={[heartbeatIntervalDuration]}
            defaultValue={[heartbeatIntervalDuration]}
            min={HEARTBEAT_INTERVAL_MIN}
            max={HEARTBEAT_INTERVAL_MAX}
            step={0.1}
            name={topicItem}
            className="flex-3"
          />
          <p className="text-left flex-1">
            {heartbeatIntervalDuration.toFixed(1)} min
          </p>
        </div>
      </div>
    </div>
  );
}
