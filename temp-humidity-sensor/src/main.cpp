#include <Adafruit_AHTX0.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <secrets.h>
#include <time.h>

namespace {
constexpr int EEPROM_SIZE = 8;
constexpr uint8_t AHT10_SCL_PIN = 27;
constexpr uint8_t AHT10_SDA_PIN = 25;
constexpr uint8_t COMPONENT_INDEX = 1;

constexpr unsigned long DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 60;
constexpr unsigned long MIN_HEARTBEAT_INTERVAL_SECONDS = 1;
constexpr unsigned long MAX_HEARTBEAT_INTERVAL_SECONDS = 6000;

constexpr char TOPIC_TYPE_STATUS[] = "status";
constexpr char TOPIC_TYPE_CONFIG[] = "config";
constexpr char TOPIC_TYPE_HEALTH[] = "controllerhealth";
constexpr char TOPIC_ACTION_GET[] = "get";

constexpr long GMT_OFFSET_SEC = 0;
constexpr int DAYLIGHT_OFFSET_SEC = 0;
}  // namespace

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

const char* mqttServer = MQTT_SERVER;
const int mqttPort = MQTT_PORT;
const char* mqttUser = MQTT_USERNAME;
const char* mqttPassword = MQTT_PASSWORD;

WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);
Adafruit_AHTX0 aht;

char deviceId[32];
char topicStatus[96];
char topicStatusGet[96];
char topicConfig[96];
char topicConfigGet[96];
char topicConfigSet[96];
char topicHealth[96];

unsigned long heartbeatIntervalSeconds = DEFAULT_HEARTBEAT_INTERVAL_SECONDS;
float lastTemperature = NAN;
float lastHumidity = NAN;
String lastReadingTimestamp = "unknown";

unsigned long lastHeartbeatPublishAtMs = 0;

uint16_t getOrCreateDeviceSuffix() {
  uint16_t value;
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(0, value);

  if (value == 0xFFFF || value == 0) {
    value = static_cast<uint16_t>(esp_random());
    EEPROM.put(0, value);
    EEPROM.commit();
  }

  return value;
}

unsigned long clampUnsignedLong(unsigned long value, unsigned long minValue,
                                unsigned long maxValue) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

String getCurrentTimestamp() {
  struct tm timeInfo;
  if (!getLocalTime(&timeInfo)) {
    return "unknown";
  }

  struct timeval now;
  gettimeofday(&now, nullptr);

  char buffer[32];
  snprintf(buffer, sizeof(buffer), "%04d-%02d-%02dT%02d:%02d:%02d.%03ldZ",
           timeInfo.tm_year + 1900, timeInfo.tm_mon + 1, timeInfo.tm_mday,
           timeInfo.tm_hour, timeInfo.tm_min, timeInfo.tm_sec,
           now.tv_usec / 1000);

  return String(buffer);
}

void setDeviceId() {
  const uint16_t suffix = getOrCreateDeviceSuffix();
  snprintf(deviceId, sizeof(deviceId), "esp32-%04X", suffix);
  Serial.print("deviceId: ");
  Serial.println(deviceId);
}

void buildTopics() {
  snprintf(topicStatus, sizeof(topicStatus), "%s/%u/%s", deviceId,
           COMPONENT_INDEX, TOPIC_TYPE_STATUS);
  snprintf(topicStatusGet, sizeof(topicStatusGet), "%s/%u/%s/%s", deviceId,
           COMPONENT_INDEX, TOPIC_TYPE_STATUS, TOPIC_ACTION_GET);
  snprintf(topicConfig, sizeof(topicConfig), "%s/%u/%s", deviceId,
           COMPONENT_INDEX, TOPIC_TYPE_CONFIG);
  snprintf(topicConfigGet, sizeof(topicConfigGet), "%s/%u/%s/%s", deviceId,
           COMPONENT_INDEX, TOPIC_TYPE_CONFIG, TOPIC_ACTION_GET);
  snprintf(topicConfigSet, sizeof(topicConfigSet), "%s/%u/%s/set", deviceId,
           COMPONENT_INDEX, TOPIC_TYPE_CONFIG);
  snprintf(topicHealth, sizeof(topicHealth), "%s/%u/%s", deviceId,
           COMPONENT_INDEX, TOPIC_TYPE_HEALTH);
}

bool publishJson(const char* topic, JsonDocument& doc, bool retain = true) {
  doc["timestamp"] = getCurrentTimestamp();

  char payload[384];
  const size_t payloadLength = serializeJson(doc, payload, sizeof(payload));
  if (payloadLength == 0 || payloadLength >= sizeof(payload) - 1) {
    Serial.print("Message too large to serialize safely [");
    Serial.print(topic);
    Serial.println("]");
    return false;
  }

  const bool published = mqttClient.publish(topic, payload, retain);
  if (published) {
    Serial.print("Message PUBLISHED [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(String(payload));
  } else {
    Serial.print("Message failed to publish [");
    Serial.print(topic);
    Serial.print("] payloadLength=");
    Serial.println(payloadLength);
  }

  return published;
}

void publishConfig() {
  JsonDocument doc;
  doc["type"] = TOPIC_TYPE_CONFIG;

  JsonObject message = doc["message"].to<JsonObject>();
  message["heartbeatIntervalSeconds"] = heartbeatIntervalSeconds;
  message["heartbeatIntervalMinSeconds"] = MIN_HEARTBEAT_INTERVAL_SECONDS;
  message["heartbeatIntervalMaxSeconds"] = MAX_HEARTBEAT_INTERVAL_SECONDS;
  message["heartbeatIntervalDefaultSeconds"] =
      DEFAULT_HEARTBEAT_INTERVAL_SECONDS;

  publishJson(topicConfig, doc, true);
}

void publishHealth() {
  JsonDocument doc;
  doc["type"] = TOPIC_TYPE_HEALTH;

  JsonObject message = doc["message"].to<JsonObject>();
  message["ipAddress"] = WiFi.localIP().toString();
  message["online"] = true;
  message["lastReadingAt"] = lastReadingTimestamp;
  message["heartbeatIntervalSeconds"] = heartbeatIntervalSeconds;

  publishJson(topicHealth, doc, true);
}

void publishStatus(bool retain = false) {
  if (isnan(lastTemperature) || isnan(lastHumidity)) {
    return;
  }

  JsonDocument doc;
  doc["type"] = TOPIC_TYPE_STATUS;

  JsonObject message = doc["message"].to<JsonObject>();
  message["temperature"] = lastTemperature;
  message["humidity"] = lastHumidity;
  message["heartbeatIntervalSeconds"] = heartbeatIntervalSeconds;

  publishJson(topicStatus, doc, retain);
}

bool readSensor() {
  sensors_event_t humidityEvent;
  sensors_event_t temperatureEvent;

  aht.getEvent(&humidityEvent, &temperatureEvent);

  if (isnan(temperatureEvent.temperature) ||
      isnan(humidityEvent.relative_humidity)) {
    Serial.println("AHT10 read failed");
    return false;
  }

  lastTemperature = temperatureEvent.temperature;
  lastHumidity = humidityEvent.relative_humidity;
  lastReadingTimestamp = getCurrentTimestamp();
  return true;
}

void publishCurrentReading(bool refreshSensor) {
  if (refreshSensor && !readSensor()) {
    return;
  }

  publishStatus(false);
  publishHealth();
}

void connectWiFi() {
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void syncTime() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, "pool.ntp.org");
  struct tm timeInfo;
  while (!getLocalTime(&timeInfo)) {
    Serial.println("Waiting for NTP time");
    delay(500);
  }
  Serial.println("Time synchronized:");
  Serial.println(&timeInfo, "%Y-%m-%d %H:%M:%S");
}

void testDNS() {
  Serial.println("\nTesting DNS resolution for MQTT server...");
  IPAddress resolvedIP;
  if (WiFi.hostByName(mqttServer, resolvedIP)) {
    Serial.print("DNS resolved: ");
    Serial.println(resolvedIP);
  } else {
    Serial.println("DNS resolution failed!");
  }
}

void onConfigMessage(const JsonDocument& doc) {
  const JsonVariantConst message = doc["message"];
  if (message.isNull()) {
    publishConfig();
    return;
  }

  if (message["heartbeatIntervalSeconds"].is<unsigned long>()) {
    heartbeatIntervalSeconds =
        clampUnsignedLong(message["heartbeatIntervalSeconds"].as<unsigned long>(),
                          MIN_HEARTBEAT_INTERVAL_SECONDS,
                          MAX_HEARTBEAT_INTERVAL_SECONDS);
  } else if (message["heartbeatInterval"].is<unsigned long>()) {
    heartbeatIntervalSeconds =
        clampUnsignedLong(message["heartbeatInterval"].as<unsigned long>(),
                          MIN_HEARTBEAT_INTERVAL_SECONDS,
                          MAX_HEARTBEAT_INTERVAL_SECONDS);
  }

  publishConfig();
  publishHealth();
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message RECEIVED [");
  Serial.print(topic);
  Serial.print("]: ");

  if (strcmp(topic, topicConfigGet) == 0) {
    Serial.println("(config get request)");
    publishConfig();
    return;
  }

  if (strcmp(topic, topicStatusGet) == 0) {
    Serial.println("(status get request)");
    publishCurrentReading(true);
    return;
  }

  String message;
  message.reserve(length);
  for (unsigned int i = 0; i < length; ++i) {
    message += static_cast<char>(payload[i]);
  }
  Serial.println(message);

  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    return;
  }

  if (strcmp(topic, topicConfigSet) == 0) {
    onConfigMessage(doc);
  }
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.println("Attempting MQTT connection...");
    if (mqttClient.connect(deviceId, mqttUser, mqttPassword)) {
      mqttClient.subscribe(topicConfigSet);
      Serial.print("MQTT subscribed to ");
      Serial.println(topicConfigSet);
      mqttClient.subscribe(topicConfigGet);
      Serial.print("MQTT subscribed to ");
      Serial.println(topicConfigGet);
      mqttClient.subscribe(topicStatusGet);
      Serial.print("MQTT subscribed to ");
      Serial.println(topicStatusGet);
      Serial.println("MQTT connected!");
      publishConfig();
      publishHealth();
      if (!isnan(lastTemperature) && !isnan(lastHumidity)) {
        publishStatus(false);
      }
      return;
    }

    Serial.print("failed. mqttClientState = ");
    Serial.println(mqttClient.state());
    delay(1000);
  }
}

void setupSensor() {
  Wire.begin(AHT10_SDA_PIN, AHT10_SCL_PIN);

  if (!aht.begin(&Wire)) {
    Serial.println("Failed to initialize AHT10 sensor");
    while (true) {
      delay(1000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  setDeviceId();
  buildTopics();
  setupSensor();

  wifiClient.setInsecure();

  connectWiFi();
  syncTime();

  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  publishCurrentReading(true);
  lastHeartbeatPublishAtMs = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    syncTime();
  }

  if (!mqttClient.connected()) {
    testDNS();
    connectMQTT();
  }

  mqttClient.loop();

  const unsigned long now = millis();
  const unsigned long heartbeatIntervalMs = heartbeatIntervalSeconds * 1000UL;

  if (now - lastHeartbeatPublishAtMs >= heartbeatIntervalMs) {
    lastHeartbeatPublishAtMs = now;
    publishCurrentReading(true);
  }
}
