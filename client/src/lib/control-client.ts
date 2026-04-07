import mqtt from "mqtt";
import {
  CONTROLLER_DEVICE_ID_TO_TOPIC,
  DEFAULT_HIGH_DURATION_MS,
  DEFAULT_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
  DEFAULT_TARGET_WEIGHT_CHANGE,
  DEFAULT_TOLERANCE_DURATION_MS,
  DEFAULT_TOLERANCE_WEIGHT,
  DEFAULT_SENSOR_READ_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MAX,
  HEARTBEAT_INTERVAL_MIN,
  MAX_HIGH_DURATION_MS,
  MAX_TOLERANCE_DURATION_MS,
  MAX_SENSOR_READ_INTERVAL_MS,
  MAX_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
  MIN_HIGH_DURATION_MS,
  MIN_TARGET_WEIGHT_CHANGE,
  MIN_TOLERANCE_DURATION_MS,
  MIN_TOLERANCE_WEIGHT,
  MIN_SENSOR_READ_INTERVAL_MS,
  MIN_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
  TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC,
  USE_MOCK_IRRIGATION_DATA,
} from "@/constants";
import {
  enumControlMode,
  enumMqttTopicType,
  MqttConfigMessage,
  MqttControlMessage,
  MqttMessageAny,
  SensorReaderConfig,
  ValveControlConfig,
  ValveState,
} from "@/types";
import { getArrayOfTopicItems } from "@/utils";

type ControlEventMap = {
  connect: () => void;
  reconnect: () => void;
  close: () => void;
  message: (topic: string, payload: string) => void;
};

type EventName = keyof ControlEventMap;
type EventHandler<T extends EventName> = ControlEventMap[T];
type PublishCallback = (err?: Error) => void;
type SubscribeCallback = (err?: Error) => void;

export interface ControlClient {
  connected: boolean;
  publish: (
    topic: string,
    message: string,
    options?: { retain?: boolean },
    callback?: PublishCallback
  ) => void;
  subscribe: (
    topic: string,
    options?: { qos?: number },
    callback?: SubscribeCallback
  ) => void;
  on: <T extends EventName>(event: T, handler: EventHandler<T>) => void;
  removeListener: <T extends EventName>(
    event: T,
    handler: EventHandler<T>
  ) => void;
}

type MockValveState = {
  active: boolean;
  controlMode: enumControlMode;
  highDuration: number;
  targetWeightChange: number;
  toleranceWeight: number;
  toleranceDurationMs: number;
  sensorReadIntervalMs: number;
  heartbeatInterval: number;
  currentWeight: number;
  startWeight: number;
  lastWeight: number;
  activatedAt: number | null;
  lastWeightReadAt: number | null;
  toleranceSatisfied: boolean;
  closeTimer: number | null;
  weightTimer: number | null;
  progressTimer: number | null;
};

type MockSensorState = {
  heartbeatIntervalSeconds: number;
  temperature: number;
  humidity: number;
  online: boolean;
  lastReadingAt: string;
  heartbeatTimer: number | null;
};

const HEARTBEAT_DEFAULT_MINUTES = 5;
const MOCK_WEIGHT_START = 1250;
let mockClientSingleton: ControlClient | null = null;

export function createControlClient(): ControlClient {
  if (USE_MOCK_IRRIGATION_DATA) {
    if (!mockClientSingleton) {
      mockClientSingleton = new MockControlClient();
    }
    return mockClientSingleton;
  }

  return mqtt.connect(import.meta.env.VITE_MQTT_CLUSTER_URL, {
    username: import.meta.env.VITE_MQTT_USERNAME,
    password: import.meta.env.VITE_MQTT_PASSWORD,
  }) as unknown as ControlClient;
}

class MockControlClient implements ControlClient {
  connected = true;
  private handlers: {
    [K in EventName]: Set<EventHandler<K>>;
  } = {
    connect: new Set(),
    reconnect: new Set(),
    close: new Set(),
    message: new Set(),
  };
  private subscriptions = new Set<string>();
  private valves = new Map<string, MockValveState>();
  private sensors = new Map<string, MockSensorState>();
  private heartbeatTimers = new Map<string, number>();

  constructor() {
    const topicItems = getArrayOfTopicItems(CONTROLLER_DEVICE_ID_TO_TOPIC);
    topicItems.forEach((topicItem, index) => {
      this.valves.set(topicItem, {
        active: false,
        controlMode: index % 2 === 0 ? enumControlMode.WEIGHT : enumControlMode.TIME,
        highDuration: DEFAULT_HIGH_DURATION_MS,
        targetWeightChange: DEFAULT_TARGET_WEIGHT_CHANGE,
        toleranceWeight: DEFAULT_TOLERANCE_WEIGHT,
        toleranceDurationMs: DEFAULT_TOLERANCE_DURATION_MS,
        sensorReadIntervalMs: DEFAULT_SENSOR_READ_INTERVAL_MS,
        heartbeatInterval: HEARTBEAT_DEFAULT_MINUTES,
        currentWeight: MOCK_WEIGHT_START - index * 75,
        startWeight: MOCK_WEIGHT_START - index * 75,
        lastWeight: MOCK_WEIGHT_START - index * 75,
        activatedAt: null,
        lastWeightReadAt: null,
        toleranceSatisfied: false,
        closeTimer: null,
        weightTimer: null,
        progressTimer: null,
      });
    });

    const sensorTopicItems = getArrayOfTopicItems(TEMPERATURE_HUMIDITY_DEVICE_ID_TO_TOPIC);
    sensorTopicItems.forEach((topicItem, index) => {
      this.sensors.set(topicItem, {
        heartbeatIntervalSeconds:
          DEFAULT_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
        temperature: 24.5 + index * 1.2,
        humidity: 62 - index * 4,
        online: true,
        lastReadingAt: new Date().toISOString(),
        heartbeatTimer: null,
      });
      this.scheduleSensorHeartbeat(topicItem);
    });

    window.setTimeout(() => {
      this.emit("connect");
      this.bootstrap();
    }, 0);
  }

  publish(
    topic: string,
    message: string,
    _options?: { retain?: boolean },
    callback?: PublishCallback
  ) {
    try {
      if (this.isConfigRequestTopic(topic)) {
        this.handleConfigRequest(topic);
        callback?.();
        return;
      }
      if (this.isStatusRequestTopic(topic)) {
        this.handleStatusRequest(topic);
        callback?.();
        return;
      }
      const parsed = JSON.parse(message) as MqttMessageAny;
      const topicType = this.getTopicType(topic);

      if (topicType === enumMqttTopicType.CONTROL) {
        this.handleControl(topic, parsed as MqttControlMessage);
      } else if (topicType === enumMqttTopicType.CONFIG) {
        this.handleConfig(topic, parsed as MqttConfigMessage);
      } else {
        this.emitMessage(topic, message);
      }
      callback?.();
    } catch (error) {
      callback?.(error instanceof Error ? error : new Error("Mock publish failed"));
    }
  }

  subscribe(
    topic: string,
    _options?: { qos?: number },
    callback?: SubscribeCallback
  ) {
    this.subscriptions.add(topic);
    this.publishSnapshot(topic);
    callback?.();
  }

  on<T extends EventName>(event: T, handler: EventHandler<T>) {
    this.handlers[event].add(handler as never);
  }

  removeListener<T extends EventName>(event: T, handler: EventHandler<T>) {
    this.handlers[event].delete(handler as never);
  }

  private bootstrap() {
    this.valves.forEach((_state, topicItem) => {
      this.publishSnapshot(`${topicItem}/${enumMqttTopicType.CONFIG}`);
      this.publishHealth(topicItem);
      this.scheduleHeartbeat(topicItem);
    });
    this.sensors.forEach((_state, topicItem) => {
      this.publishSnapshot(`${topicItem}/${enumMqttTopicType.CONFIG}`);
      this.publishHealth(topicItem);
      this.publishStatus(topicItem, undefined);
    });
  }

  private handleControl(topic: string, payload: MqttControlMessage) {
    const topicItem = this.getTopicItem(topic);
    const valve = this.valves.get(topicItem);
    if (!valve) return;

    if (payload.message === "HIGH") {
      this.activateValve(topicItem, valve);
      return;
    }

    this.deactivateValve(topicItem, valve, "manual");
  }

  private handleConfig(topic: string, payload: MqttConfigMessage) {
    const topicItem = this.getTopicItem(topic);
    const valve = this.valves.get(topicItem);
    const sensor = this.sensors.get(topicItem);

    if (sensor) {
      const config = payload.message as SensorReaderConfig;
      const nextHeartbeat =
        typeof config.heartbeatIntervalSeconds === "number"
          ? config.heartbeatIntervalSeconds
          : config.heartbeatInterval;

      if (typeof nextHeartbeat === "number") {
        sensor.heartbeatIntervalSeconds = clamp(
          nextHeartbeat,
          MIN_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
          MAX_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS
        );
        this.scheduleSensorHeartbeat(topicItem);
      }
      this.publishConfig(topicItem);
      this.publishHealth(topicItem);
      this.publishStatus(topicItem, undefined);
      return;
    }

    if (!valve) return;

    const config = payload.message as ValveControlConfig;

    if (config.controlMode) {
      valve.controlMode = config.controlMode;
    }
    if (typeof config.highDuration === "number") {
      valve.highDuration = clamp(
        config.highDuration,
        MIN_HIGH_DURATION_MS,
        MAX_HIGH_DURATION_MS
      );
    }
    if (typeof config.targetWeightChange === "number") {
      valve.targetWeightChange = Math.max(
        config.targetWeightChange,
        MIN_TARGET_WEIGHT_CHANGE
      );
    }
    if (typeof config.toleranceWeight === "number") {
      valve.toleranceWeight = Math.max(
        config.toleranceWeight,
        MIN_TOLERANCE_WEIGHT
      );
    }
    if (typeof config.toleranceDurationMs === "number") {
      valve.toleranceDurationMs = clamp(
        config.toleranceDurationMs,
        MIN_TOLERANCE_DURATION_MS,
        MAX_TOLERANCE_DURATION_MS
      );
    }
    if (typeof config.sensorReadIntervalMs === "number") {
      valve.sensorReadIntervalMs = clamp(
        config.sensorReadIntervalMs,
        MIN_SENSOR_READ_INTERVAL_MS,
        MAX_SENSOR_READ_INTERVAL_MS
      );
    }
    if (typeof config.heartbeatInterval === "number") {
      valve.heartbeatInterval = clamp(
        config.heartbeatInterval,
        HEARTBEAT_INTERVAL_MIN,
        HEARTBEAT_INTERVAL_MAX
      );
      this.scheduleHeartbeat(topicItem);
    }

    this.publishConfig(topicItem);
    this.publishHealth(topicItem);
  }

  private handleConfigRequest(topic: string) {
    const topicItem = this.getTopicItem(topic);
    if (!topicItem) return;
    this.publishConfig(topicItem);
  }

  private handleStatusRequest(topic: string) {
    const topicItem = this.getTopicItem(topic);
    if (!topicItem) return;

    const sensor = this.sensors.get(topicItem);
    if (!sensor) return;

    this.advanceSensorReading(sensor);
    this.publishStatus(topicItem, undefined);
    this.publishHealth(topicItem);
  }

  private activateValve(topicItem: string, valve: MockValveState) {
    this.clearValveTimers(valve);
    valve.active = true;
    valve.activatedAt = Date.now();
    valve.lastWeightReadAt = Date.now();
    valve.startWeight = valve.currentWeight;
    valve.lastWeight = valve.currentWeight;
    valve.toleranceSatisfied = valve.toleranceWeight <= MIN_TOLERANCE_WEIGHT;

    this.publishStatus(topicItem, valve, "HIGH");

    if (valve.controlMode === enumControlMode.TIME) {
      valve.progressTimer = window.setInterval(() => {
        if (!valve.active) return;
        this.publishStatus(topicItem, valve, "HIGH");
      }, valve.sensorReadIntervalMs);
      valve.closeTimer = window.setTimeout(() => {
        this.deactivateValve(topicItem, valve, "duration_elapsed");
      }, valve.highDuration);
      return;
    }

    valve.weightTimer = window.setInterval(() => {
      if (!valve.active) return;

      const weightDrop = 8 + Math.random() * 16;
      valve.currentWeight = Math.max(0, valve.currentWeight - weightDrop);
      valve.lastWeight = valve.currentWeight;
      valve.lastWeightReadAt = Date.now();

      const weightChange = valve.startWeight - valve.lastWeight;
      this.publishStatus(topicItem, valve, "HIGH");

      if (weightChange >= valve.targetWeightChange) {
        this.deactivateValve(topicItem, valve, "target_reached");
        return;
      }

      if (!valve.toleranceSatisfied && weightChange >= valve.toleranceWeight) {
        valve.toleranceSatisfied = true;
      }

      if (
        !valve.toleranceSatisfied &&
        valve.activatedAt !== null &&
        Date.now() - valve.activatedAt >= valve.toleranceDurationMs
      ) {
        this.deactivateValve(topicItem, valve, "tolerance_timeout");
      }
    }, valve.sensorReadIntervalMs);
  }

  private deactivateValve(
    topicItem: string,
    valve: MockValveState,
    reason: string
  ) {
    if (!valve.active) return;

    valve.active = false;
    this.clearValveTimers(valve);
    this.publishStatus(topicItem, valve, "LOW", reason);
    valve.activatedAt = null;
    valve.lastWeightReadAt = null;
    valve.toleranceSatisfied = false;
  }

  private clearValveTimers(valve: MockValveState) {
    if (valve.closeTimer !== null) {
      window.clearTimeout(valve.closeTimer);
      valve.closeTimer = null;
    }
    if (valve.weightTimer !== null) {
      window.clearInterval(valve.weightTimer);
      valve.weightTimer = null;
    }
    if (valve.progressTimer !== null) {
      window.clearInterval(valve.progressTimer);
      valve.progressTimer = null;
    }
  }

  private scheduleHeartbeat(topicItem: string) {
    const existing = this.heartbeatTimers.get(topicItem);
    if (existing !== undefined) {
      window.clearInterval(existing);
    }

    const valve = this.valves.get(topicItem);
    if (!valve) return;

    const timer = window.setInterval(() => {
      this.publishHealth(topicItem);
    }, valve.heartbeatInterval * 60 * 1000);

    this.heartbeatTimers.set(topicItem, timer);
  }

  private scheduleSensorHeartbeat(topicItem: string) {
    const sensor = this.sensors.get(topicItem);
    if (!sensor) return;

    if (sensor.heartbeatTimer !== null) {
      window.clearInterval(sensor.heartbeatTimer);
    }

    sensor.heartbeatTimer = window.setInterval(() => {
      this.advanceSensorReading(sensor);
      this.publishStatus(topicItem, undefined);
      this.publishHealth(topicItem);
    }, sensor.heartbeatIntervalSeconds * 1000);
  }

  private advanceSensorReading(sensor: MockSensorState) {
    sensor.temperature = clamp(sensor.temperature + (Math.random() - 0.5) * 0.8, 20, 32);
    sensor.humidity = clamp(sensor.humidity + (Math.random() - 0.5) * 3, 40, 80);
    sensor.lastReadingAt = new Date().toISOString();
  }

  private publishSnapshot(topic: string) {
    const topicItem = this.getTopicItem(topic);
    if (!topicItem) return;

    const topicType = this.getTopicType(topic);
    if (topicType === enumMqttTopicType.CONFIG) {
      this.publishConfig(topicItem);
    }
    if (topicType === enumMqttTopicType.HEALTH) {
      this.publishHealth(topicItem);
    }
    if (topicType === enumMqttTopicType.STATUS) {
      const valve = this.valves.get(topicItem);
      if (valve) {
        this.publishStatus(topicItem, valve, valve.active ? "HIGH" : "LOW");
        return;
      }
      if (this.sensors.has(topicItem)) {
        this.publishStatus(topicItem, undefined);
      }
    }
  }

  private publishConfig(topicItem: string) {
    const valve = this.valves.get(topicItem);
    if (valve) {
      const topic = `${topicItem}/${enumMqttTopicType.CONFIG}`;
      const message: MqttConfigMessage = {
        type: enumMqttTopicType.CONFIG,
        message: {
          controlMode: valve.controlMode,
          highDuration: valve.highDuration,
          targetWeightChange: valve.targetWeightChange,
          toleranceWeight: valve.toleranceWeight,
          toleranceDurationMs: valve.toleranceDurationMs,
          sensorReadIntervalMs: valve.sensorReadIntervalMs,
          heartbeatInterval: valve.heartbeatInterval,
        },
        timestamp: new Date().toISOString(),
      };
      this.emitMessage(topic, JSON.stringify(message));
      return;
    }

    const sensor = this.sensors.get(topicItem);
    if (!sensor) return;

    const topic = `${topicItem}/${enumMqttTopicType.CONFIG}`;
    const message: MqttConfigMessage = {
      type: enumMqttTopicType.CONFIG,
      message: {
        heartbeatIntervalSeconds: sensor.heartbeatIntervalSeconds,
        heartbeatIntervalMinSeconds:
          MIN_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
        heartbeatIntervalMaxSeconds:
          MAX_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
        heartbeatIntervalDefaultSeconds:
          DEFAULT_TEMPERATURE_SENSOR_HEARTBEAT_INTERVAL_SECONDS,
      },
      timestamp: new Date().toISOString(),
    };
    this.emitMessage(topic, JSON.stringify(message));
  }

  private publishHealth(topicItem: string) {
    const valve = this.valves.get(topicItem);
    if (valve) {
      const topic = `${topicItem}/${enumMqttTopicType.HEALTH}`;
      const message = {
        type: enumMqttTopicType.HEALTH,
        message: {
          ipAddress: this.getMockIpAddress(topicItem),
          active: valve.active,
          weight: valve.lastWeight,
        },
        timestamp: new Date().toISOString(),
      };
      this.emitMessage(topic, JSON.stringify(message));
      return;
    }

    const sensor = this.sensors.get(topicItem);
    if (!sensor) return;

    const topic = `${topicItem}/${enumMqttTopicType.HEALTH}`;
    const message = {
      type: enumMqttTopicType.HEALTH,
      message: {
        ipAddress: this.getMockIpAddress(topicItem),
        online: sensor.online,
        lastReadingAt: sensor.lastReadingAt,
        heartbeatIntervalSeconds: sensor.heartbeatIntervalSeconds,
      },
      timestamp: new Date().toISOString(),
    };
    this.emitMessage(topic, JSON.stringify(message));
  }

  private publishStatus(
    topicItem: string,
    valve?: MockValveState,
    state?: ValveState,
    reason?: string
  ) {
    if (!valve) {
      const sensor = this.sensors.get(topicItem);
      if (!sensor) return;
      const topic = `${topicItem}/${enumMqttTopicType.STATUS}`;
      const message = {
        type: enumMqttTopicType.STATUS,
        message: {
          temperature: Number(sensor.temperature.toFixed(1)),
          humidity: Number(sensor.humidity.toFixed(1)),
          heartbeatIntervalSeconds: sensor.heartbeatIntervalSeconds,
        },
        timestamp: sensor.lastReadingAt,
      };
      this.emitMessage(topic, JSON.stringify(message));
      return;
    }

    const topic = `${topicItem}/${enumMqttTopicType.STATUS}`;
    const weightChange = valve.startWeight - valve.lastWeight;
    const isTimeMode = valve.controlMode === enumControlMode.TIME;
    const progressValue = isTimeMode
      ? Math.min(
          valve.highDuration / 1000,
          valve.activatedAt === null ? 0 : (Date.now() - valve.activatedAt) / 1000
        )
      : weightChange;
    const targetValue = isTimeMode
      ? valve.highDuration / 1000
      : valve.targetWeightChange;
    const message = {
      type: enumMqttTopicType.STATUS,
      message: {
        state: state ?? "LOW",
        weight: valve.lastWeight,
        weightChange,
        progressValue,
        targetValue,
        progressUnit: isTimeMode ? "s" : "g",
        controlMode: valve.controlMode,
        ...(reason ? { reason } : {}),
      },
      timestamp: new Date().toISOString(),
    };
    this.emitMessage(topic, JSON.stringify(message));
    this.publishHealth(topicItem);
  }

  private emit<T extends EventName>(event: T, ...args: Parameters<ControlEventMap[T]>) {
    this.handlers[event].forEach((handler) => {
      (handler as (...params: Parameters<ControlEventMap[T]>) => void)(...args);
    });
  }

  private emitMessage(topic: string, payload: string) {
    if (!this.subscriptions.has(topic)) return;
    this.emit("message", topic, payload);
  }

  private getTopicItem(topic: string) {
    const parts = topic.split("/");
    if (parts.length < 3) return "";
    return `${parts[0]}/${parts[1]}`;
  }

  private getTopicType(topic: string) {
    const parts = topic.split("/");
    return parts[parts.length - 1] as enumMqttTopicType;
  }

  private isConfigRequestTopic(topic: string) {
    return topic.endsWith(`/${enumMqttTopicType.CONFIG}/get`);
  }

  private isStatusRequestTopic(topic: string) {
    return topic.endsWith(`/${enumMqttTopicType.STATUS}/get`);
  }

  private getMockIpAddress(topicItem: string) {
    const [, indexPart] = topicItem.split("/");
    const index = Number(indexPart) || 1;
    return `192.168.1.${100 + index}`;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
