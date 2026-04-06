import { useCallback, useEffect, useMemo, useState } from "react";
import {
  enumControlMode,
  mqttTopicId,
  mqttTopicItem,
  getMqttTopicId,
  enumMqttTopicType,
  MqttMessageAny,
  MqttConfigMessage,
} from "../types";
import { Slider } from "./ui/slider";
import { toast } from "sonner";
import { useMqttClient } from "./hooks/useMqttClient";
import { ControlClient } from "@/lib/control-client";
import {
  DEFAULT_HIGH_DURATION_MS,
  HEARTBEAT_INTERVAL_MIN,
  HEARTBEAT_INTERVAL_MAX,
  DEFAULT_TARGET_WEIGHT_CHANGE,
  MIN_TARGET_WEIGHT_CHANGE,
  MIN_HIGH_DURATION_MS,
  MAX_HIGH_DURATION_MS,
  DEFAULT_TOLERANCE_WEIGHT,
  MIN_TOLERANCE_WEIGHT,
  DEFAULT_TOLERANCE_DURATION_MS,
  MIN_TOLERANCE_DURATION_MS,
  MAX_TOLERANCE_DURATION_MS,
  DEFAULT_SENSOR_READ_INTERVAL_MS,
  MIN_SENSOR_READ_INTERVAL_MS,
  MAX_SENSOR_READ_INTERVAL_MS,
} from "@/constants";
import { Button } from "./ui/button";
import { FormEvent } from "react";
import ConfigInputField, { ConfigLabel } from "./ConfigInputField";
import { LoaderCircle } from "lucide-react";

export type ConfigLoadState = "loading" | "ready" | "missing";

export default function ConfigItem(props: {
  client: ControlClient | null;
  topicItem: mqttTopicItem;
  isOpen: boolean;
  onConfigStateChange: (state: ConfigLoadState) => void;
}) {
  const { client, topicItem, isOpen, onConfigStateChange } = props;
  const [controlMode, setControlMode] = useState<enumControlMode>(
    enumControlMode.WEIGHT
  );
  const [highDurationMs, setHighDurationMs] = useState<number>(
    DEFAULT_HIGH_DURATION_MS
  );
  const [highDurationInput, setHighDurationInput] = useState<string>(
    (DEFAULT_HIGH_DURATION_MS / 1000).toString()
  );
  const [targetWeightChange, setTargetWeightChange] = useState<number>(
    DEFAULT_TARGET_WEIGHT_CHANGE
  );
  const [targetWeightChangeInput, setTargetWeightChangeInput] =
    useState<string>(DEFAULT_TARGET_WEIGHT_CHANGE.toString());
  const [toleranceWeight, setToleranceWeight] = useState<number>(
    DEFAULT_TOLERANCE_WEIGHT
  );
  const [toleranceWeightInput, setToleranceWeightInput] = useState<string>(
    DEFAULT_TOLERANCE_WEIGHT.toString()
  );
  const [toleranceDurationMs, setToleranceDurationMs] = useState<number>(
    DEFAULT_TOLERANCE_DURATION_MS
  );
  const [toleranceDurationInput, setToleranceDurationInput] = useState<string>(
    (DEFAULT_TOLERANCE_DURATION_MS / 1000).toString()
  );
  const [sensorReadIntervalMs, setSensorReadIntervalMs] = useState<number>(
    DEFAULT_SENSOR_READ_INTERVAL_MS
  );
  const [heartbeatIntervalDuration, setHeartbeatIntervalDuration] =
    useState<number>(5);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasReceivedConfig, setHasReceivedConfig] = useState(false);
  const [configLoadState, setConfigLoadState] =
    useState<ConfigLoadState>("loading");

  const sensorReadIntervalSeconds = useMemo(
    () => sensorReadIntervalMs / 1000,
    [sensorReadIntervalMs]
  );

  const topicConfig: mqttTopicId = useMemo(
    () => getMqttTopicId(topicItem, enumMqttTopicType.CONFIG),
    [topicItem]
  );
  const formId = useMemo(() => `valve-config-${topicItem.replace("/", "-")}`, [topicItem]);

  useEffect(() => {
    setToleranceDurationInput((toleranceDurationMs / 1000).toString());
  }, [toleranceDurationMs]);

  useEffect(() => {
    setHighDurationInput((highDurationMs / 1000).toString());
  }, [highDurationMs]);

  const setFieldError = useCallback((field: string, message?: string) => {
    setErrors((current) => {
      if (!message) {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      }

      if (current[field] === message) return current;
      return {
        ...current,
        [field]: message,
      };
    });
  }, []);

  const onMessageReceived = useCallback(
    (_topic: string, payload: MqttMessageAny) => {
      switch (payload.type) {
        case enumMqttTopicType.CONFIG:
          if (payload.message.controlMode) {
            setControlMode(payload.message.controlMode);
          }
          if (typeof payload.message.highDuration === "number") {
            setHighDurationMs(payload.message.highDuration);
          }
          if (typeof payload.message.targetWeightChange === "number") {
            setTargetWeightChange(payload.message.targetWeightChange);
            setTargetWeightChangeInput(
              payload.message.targetWeightChange.toString()
            );
          }
          if (typeof payload.message.toleranceWeight === "number") {
            setToleranceWeight(payload.message.toleranceWeight);
            setToleranceWeightInput(payload.message.toleranceWeight.toString());
          }
          if (typeof payload.message.toleranceDurationMs === "number") {
            setToleranceDurationMs(payload.message.toleranceDurationMs);
          }
          if (typeof payload.message.sensorReadIntervalMs === "number") {
            setSensorReadIntervalMs(payload.message.sensorReadIntervalMs);
          }
          if (typeof payload.message.heartbeatInterval === "number") {
            setHeartbeatIntervalDuration(payload.message.heartbeatInterval);
          }
          setHasReceivedConfig(true);
          setConfigLoadState("ready");
          onConfigStateChange("ready");
          setErrors({});
          break;
        default:
          break;
      }
    },
    [onConfigStateChange]
  );

  const { refreshTopics } = useMqttClient({
    mqttClient: client,
    topics: [topicConfig],
    onMessage: onMessageReceived,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setHasReceivedConfig(false);
    setConfigLoadState("loading");
    setErrors({});
    onConfigStateChange("loading");
    refreshTopics();

    const timeoutId = window.setTimeout(() => {
      setHasReceivedConfig((current) => {
        if (!current) {
          setConfigLoadState("missing");
          onConfigStateChange("missing");
        }
        return current;
      });
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, onConfigStateChange, refreshTopics]);

  const publishConfigSnapshot = useCallback(
    (
      nextMode: enumControlMode,
      nextHighDurationMs: number,
      nextTargetWeightChange: number,
      nextToleranceWeight: number,
      nextToleranceDurationMs: number,
      nextSensorReadIntervalMs: number,
      nextHeartbeatInterval: number
    ) => {
      const message: MqttConfigMessage = {
        type: enumMqttTopicType.CONFIG,
        message: {
          controlMode: nextMode,
          highDuration: nextHighDurationMs,
          targetWeightChange: nextTargetWeightChange,
          toleranceWeight: nextToleranceWeight,
          toleranceDurationMs: nextToleranceDurationMs,
          sensorReadIntervalMs: nextSensorReadIntervalMs,
          heartbeatInterval: nextHeartbeatInterval,
        },
        timestamp: new Date().toISOString(),
      };

      client?.publish(topicConfig, JSON.stringify(message), {
        retain: true,
      });
    },
    [client, topicConfig]
  );

  const onValveConfigCommit = useCallback(() => {
    const nextErrors: Record<string, string> = {};

    const targetWeightParsed = Number(targetWeightChangeInput);
    if (!Number.isFinite(targetWeightParsed)) {
      nextErrors.targetWeightChange = "Target weight change must be a valid number.";
    } else if (targetWeightParsed < MIN_TARGET_WEIGHT_CHANGE) {
      nextErrors.targetWeightChange = `Target weight change must be at least ${MIN_TARGET_WEIGHT_CHANGE}.`;
    }

    const toleranceWeightParsed = Number(toleranceWeightInput);
    if (!Number.isFinite(toleranceWeightParsed)) {
      nextErrors.toleranceWeight = "Tolerance weight must be a valid number.";
    } else if (toleranceWeightParsed < MIN_TOLERANCE_WEIGHT) {
      nextErrors.toleranceWeight = `Tolerance weight must be at least ${MIN_TOLERANCE_WEIGHT}.`;
    }

    const toleranceDurationSeconds = Number(toleranceDurationInput);
    if (!Number.isFinite(toleranceDurationSeconds)) {
      nextErrors.toleranceDurationMs = "Tolerance duration must be a valid number.";
    } else if (toleranceDurationSeconds < MIN_TOLERANCE_DURATION_MS / 1000) {
      nextErrors.toleranceDurationMs = `Tolerance duration must be at least ${
        MIN_TOLERANCE_DURATION_MS / 1000
      }.`;
    } else if (toleranceDurationSeconds > MAX_TOLERANCE_DURATION_MS / 1000) {
      nextErrors.toleranceDurationMs = `Tolerance duration must be at most ${
        MAX_TOLERANCE_DURATION_MS / 1000
      }.`;
    }

    const highDurationSeconds = Number(highDurationInput);
    if (!Number.isFinite(highDurationSeconds)) {
      nextErrors.highDurationMs = "Open duration must be a valid number.";
    } else if (highDurationSeconds < MIN_HIGH_DURATION_MS / 1000) {
      nextErrors.highDurationMs = `Open duration must be at least ${
        MIN_HIGH_DURATION_MS / 1000
      }.`;
    } else if (highDurationSeconds > MAX_HIGH_DURATION_MS / 1000) {
      nextErrors.highDurationMs = `Open duration must be at most ${
        MAX_HIGH_DURATION_MS / 1000
      }.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const resolvedHighDuration = highDurationSeconds * 1000;
    const resolvedTarget = targetWeightParsed;
    const resolvedTolerance = toleranceWeightParsed;
    const resolvedToleranceDuration = toleranceDurationSeconds * 1000;
    const clampedSensorInterval = Math.min(
      Math.max(sensorReadIntervalMs, MIN_SENSOR_READ_INTERVAL_MS),
      MAX_SENSOR_READ_INTERVAL_MS
    );

    setErrors({});
    setTargetWeightChange(resolvedTarget);
    setToleranceWeight(resolvedTolerance);
    setToleranceDurationMs(resolvedToleranceDuration);
    setSensorReadIntervalMs(clampedSensorInterval);
    setHighDurationMs(resolvedHighDuration);

    publishConfigSnapshot(
      controlMode,
      resolvedHighDuration,
      resolvedTarget,
      resolvedTolerance,
      resolvedToleranceDuration,
      clampedSensorInterval,
      heartbeatIntervalDuration
    );

    toast.success(topicConfig, {
      description:
        controlMode === enumControlMode.TIME
          ? `Timer config updated (${(resolvedHighDuration / 1000).toFixed(
              1
            )}s duration, ${(clampedSensorInterval / 1000).toFixed(
              1
            )}s sensor interval)`
          : `Weight config updated (target ${resolvedTarget.toFixed(
              1
            )}g, tolerance ${resolvedTolerance.toFixed(1)}g, timeout ${(
              resolvedToleranceDuration / 1000
            ).toFixed(1)}s, ${(clampedSensorInterval / 1000).toFixed(
              1
            )}s sensor interval)`,
    });
  }, [
    controlMode,
    heartbeatIntervalDuration,
    highDurationInput,
    publishConfigSnapshot,
    sensorReadIntervalMs,
    targetWeightChangeInput,
    toleranceDurationInput,
    toleranceWeightInput,
    topicConfig,
  ]);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onValveConfigCommit();
    },
    [onValveConfigCommit]
  );

  if (configLoadState === "loading") {
    return (
      <div className="flex min-h-40 items-center justify-center px-4 py-6 text-center">
        <div className="flex max-w-xs flex-col items-center gap-3">
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading retained MQTT config for this valve...
          </p>
        </div>
      </div>
    );
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="space-y-4">
        {configLoadState === "missing" ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            No existing config detected for this valve. Default values are shown below.
          </div>
        ) : null}
        <div className="flex flex-col items-start justify-center gap-2 w-full">
          <ConfigLabel
            htmlFor={`${topicItem}-sensor-interval`}
            label="Sensor reading interval"
            tooltip="How often the controller sends open-state status updates while the valve is active."
          />
          <div className="flex gap-2 w-full">
            <Slider
              onValueChange={([value]) => {
                setFieldError("sensorReadIntervalMs");
                setSensorReadIntervalMs(value * 1000);
              }}
              value={[sensorReadIntervalSeconds]}
              min={MIN_SENSOR_READ_INTERVAL_MS / 1000}
              max={MAX_SENSOR_READ_INTERVAL_MS / 1000}
              step={0.1}
              name={`${topicItem}-sensor-interval`}
              className="flex-3"
            />
            <p className="text-left flex-1">{sensorReadIntervalSeconds.toFixed(1)} s</p>
          </div>
          {errors.sensorReadIntervalMs ? (
            <p className="text-xs text-destructive">{errors.sensorReadIntervalMs}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-start justify-center gap-2 w-full">
          <ConfigLabel
            htmlFor={topicItem}
            label="Heartbeat interval"
            tooltip="How often the controller publishes heartbeat updates regardless of whether the valve is open or closed."
          />
          <div className="flex gap-2 w-full">
            <Slider
              onValueChange={([value]) => setHeartbeatIntervalDuration(value)}
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

        <div className="flex flex-col items-start justify-center gap-2 w-full">
          <ConfigLabel
            label="Valve control mode"
            tooltip="Choose whether this valve stops based on target weight change or a fixed open duration."
          />
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant={controlMode === enumControlMode.WEIGHT ? "default" : "outline"}
              className="flex-1"
              onClick={() => setControlMode(enumControlMode.WEIGHT)}
            >
              Weight
            </Button>
            <Button
              type="button"
              variant={controlMode === enumControlMode.TIME ? "default" : "outline"}
              className="flex-1"
              onClick={() => setControlMode(enumControlMode.TIME)}
            >
              Time
            </Button>
          </div>
        </div>

        {controlMode === enumControlMode.WEIGHT ? (
          <div className="flex flex-col gap-3 w-full pb-3">
            <ConfigInputField
              id={`${topicItem}-target-weight`}
              label="Target weight change"
              tooltip="Target increase in measured weight before the valve closes automatically."
              type="number"
              min={MIN_TARGET_WEIGHT_CHANGE}
              step={0.1}
              value={targetWeightChangeInput}
              onChange={(event) => setTargetWeightChangeInput(event.target.value)}
              error={errors.targetWeightChange}
            />

            <ConfigInputField
              id={`${topicItem}-tolerance-weight`}
              label="Tolerance weight"
              tooltip="Minimum weight change expected within the tolerance duration while the valve is open."
              type="number"
              min={MIN_TOLERANCE_WEIGHT}
              step={0.1}
              value={toleranceWeightInput}
              onChange={(event) => setToleranceWeightInput(event.target.value)}
              error={errors.toleranceWeight}
            />

            <ConfigInputField
              id={`${topicItem}-tolerance-duration`}
              label="Tolerance duration (seconds)"
              tooltip="How long to wait for enough weight change before timing out and closing the valve."
              type="number"
              min={MIN_TOLERANCE_DURATION_MS / 1000}
              max={MAX_TOLERANCE_DURATION_MS / 1000}
              step={0.5}
              value={toleranceDurationInput}
              onChange={(event) => setToleranceDurationInput(event.target.value)}
              error={errors.toleranceDurationMs}
            />
          </div>
        ) : (
          <div className="w-full pb-3">
            <ConfigInputField
              id={`${topicItem}-duration`}
              label="Open duration (seconds)"
              tooltip="How long the valve stays open before it closes automatically in time mode."
              type="number"
              min={MIN_HIGH_DURATION_MS / 1000}
              max={MAX_HIGH_DURATION_MS / 1000}
              step={0.5}
              value={highDurationInput}
              onChange={(event) => setHighDurationInput(event.target.value)}
              error={errors.highDurationMs}
            />
          </div>
        )}
      </div>

    </form>
  );
}
