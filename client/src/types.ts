export type mqttTopicItem = `${string}/${number}`;

export enum enumClientStatus {
  CONNECTED = "Connected",
  ERROR = "Error",
  RECONNECTED = "Reconnected",
  CLOSED = "Closed",
}

export const makeMqttTopicItem = (
  topicCategory: string,
  index: number
): mqttTopicItem => {
  return `${topicCategory}/${index}`;
};

export enum enumMqttTopicType {
  CONTROL = "control",
  STATUS = "status",
  CONFIG = "config",
  HEALTH = "controllerhealth",
}

export enum enumControlMode {
  WEIGHT = "weight",
  TIME = "time",
}

export const getMqttTopicId = (
  topic: mqttTopicItem,
  type: enumMqttTopicType
): mqttTopicId => {
  return `${topic}/${type}`;
};

export type mqttTopicId = `${mqttTopicItem}/${enumMqttTopicType}`;
// const id: mqttTopicId = 'irrigation/1/control';

export interface MqttMessage<T> {
  type: enumMqttTopicType;
  message: T;
  timestamp: string;
}

export type ValveState = "LOW" | "HIGH";

export interface ValveStatusPayload {
  state: ValveState;
  weight: number;
  weightChange: number;
  progressValue?: number;
  targetValue?: number;
  progressUnit?: string;
  controlMode?: enumControlMode;
  reason?: string;
}

export interface SensorStatusPayload {
  temperature: number;
  humidity: number;
  heartbeatIntervalSeconds?: number;
}

export interface MqttStatusMessage
  extends MqttMessage<ValveStatusPayload | SensorStatusPayload> {
  type: enumMqttTopicType.STATUS;
}

export interface MqttConfigMessage extends MqttMessage<mqttConfigMessage> {
  type: enumMqttTopicType.CONFIG;
}

export interface ValveHealthPayload {
  ipAddress: string;
  active: boolean;
  weight: number;
}

export interface SensorHealthPayload {
  ipAddress: string;
  online: boolean;
  lastReadingAt?: string;
  heartbeatIntervalSeconds?: number;
}

export interface MqttHealthMessage extends MqttMessage<mqttHealthMessage> {
  type: enumMqttTopicType.HEALTH;
}

export interface MqttControlMessage extends MqttMessage<string> {
  type: enumMqttTopicType.CONTROL;
}

export type MqttMessageAny =
  | MqttStatusMessage
  | MqttConfigMessage
  | MqttHealthMessage
  | MqttControlMessage;

export interface ValveControlConfig {
  controlMode?: enumControlMode;
  heartbeatInterval?: number;
  highDuration?: number;
  targetWeightChange?: number;
  toleranceWeight?: number;
  toleranceDurationMs?: number;
  sensorReadIntervalMs?: number;
}

export interface SensorReaderConfig {
  heartbeatIntervalSeconds?: number;
  heartbeatInterval?: number;
  heartbeatIntervalMinSeconds?: number;
  heartbeatIntervalMaxSeconds?: number;
  heartbeatIntervalDefaultSeconds?: number;
}

export type mqttConfigMessage = ValveControlConfig & SensorReaderConfig;

export type mqttHealthMessage = ValveHealthPayload | SensorHealthPayload;

export type topicList = {
  topic: string;
  quantity: number;
};
