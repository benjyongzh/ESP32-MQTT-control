#include <Arduino.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <DHT.h>
#include <secrets.h>

namespace {
constexpr int EEPROM_SIZE = 8;
constexpr int DHT_PIN = 4;
constexpr int WIFI_STATUS_PIN = 27;
constexpr int MQTT_STATUS_PIN = 25;
constexpr uint8_t DHT_TYPE = DHT22;

constexpr float DEFAULT_READING_INTERVAL_SECONDS = 5.0f;
constexpr float MIN_READING_INTERVAL_SECONDS = 1.0f;
constexpr float MAX_READING_INTERVAL_SECONDS = 30.0f;
constexpr float DEFAULT_HEALTH_INTERVAL_MINUTES = 5.0f;
constexpr float MIN_HEALTH_INTERVAL_MINUTES = 0.1f;
constexpr float MAX_HEALTH_INTERVAL_MINUTES = 20.0f;

constexpr int COMPONENT_INDEX = 1;
constexpr char TOPIC_TYPE_STATUS[] = "status";
constexpr char TOPIC_TYPE_CONFIG[] = "config";
constexpr char TOPIC_TYPE_HEALTH[] = "controllerhealth";

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
DHT dht(DHT_PIN, DHT_TYPE);

char deviceId[32];
char topicStatus[96];
char topicConfig[96];
char topicHealth[96];

float readingIntervalSeconds = DEFAULT_READING_INTERVAL_SECONDS;
float healthIntervalMinutes = DEFAULT_HEALTH_INTERVAL_MINUTES;
float lastTemperature = NAN;
float lastHumidity = NAN;
String lastReadingTimestamp = "unknown";

unsigned long lastReadAtMs = 0;
unsigned long lastHealthPublishAtMs = 0;

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

float clampFloat(float value, float minValue, float maxValue) {
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
  snprintf(
    buffer,
    sizeof(buffer),
    "%04d-%02d-%02dT%02d:%02d:%02d.%03ldZ",
    timeInfo.tm_year + 1900,
    timeInfo.tm_mon + 1,
    timeInfo.tm_mday,
    timeInfo.tm_hour,
    timeInfo.tm_min,
    timeInfo.tm_sec,
    now.tv_usec / 1000);

  return String(buffer);
}

void buildTopics() {
  snprintf(topicStatus, sizeof(topicStatus), "%s/%d/%s", deviceId, COMPONENT_INDEX, TOPIC_TYPE_STATUS);
  snprintf(topicConfig, sizeof(topicConfig), "%s/%d/%s", deviceId, COMPONENT_INDEX, TOPIC_TYPE_CONFIG);
  snprintf(topicHealth, sizeof(topicHealth), "%s/%d/%s", deviceId, COMPONENT_INDEX, TOPIC_TYPE_HEALTH);
}

void setDeviceId() {
  uint16_t suffix = getOrCreateDeviceSuffix();
  snprintf(deviceId, sizeof(deviceId), "esp32-TH%04X", suffix);
}

bool publishJson(const char* topic, JsonDocument& doc, bool retain = true) {
  doc["timestamp"] = getCurrentTimestamp();

  char payload[256];
  serializeJson(doc, payload, sizeof(payload));

  const bool published = mqttClient.publish(topic, payload, retain);
  if (published) {
    Serial.print("Published [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(payload);
  } else {
    Serial.print("Publish failed [");
    Serial.print(topic);
    Serial.println("]");
  }

  return published;
}

void publishConfig() {
  JsonDocument doc;
  doc["type"] = TOPIC_TYPE_CONFIG;
  doc["message"]["readingIntervalSeconds"] = readingIntervalSeconds;
  publishJson(topicConfig, doc, true);
}

void publishHealth() {
  JsonDocument doc;
  doc["type"] = TOPIC_TYPE_HEALTH;
  doc["message"]["ipAddress"] = WiFi.localIP().toString();
  doc["message"]["online"] = true;
  doc["message"]["lastReadingAt"] = lastReadingTimestamp;
  publishJson(topicHealth, doc, true);
}

void publishStatus() {
  if (isnan(lastTemperature) || isnan(lastHumidity)) {
    return;
  }

  JsonDocument doc;
  doc["type"] = TOPIC_TYPE_STATUS;
  doc["message"]["temperature"] = lastTemperature;
  doc["message"]["humidity"] = lastHumidity;
  doc["message"]["readingIntervalSeconds"] = readingIntervalSeconds;
  publishJson(topicStatus, doc, false);
}

void readSensorAndPublish() {
  const float temperature = dht.readTemperature();
  const float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT read failed");
    return;
  }

  lastTemperature = temperature;
  lastHumidity = humidity;
  lastReadingTimestamp = getCurrentTimestamp();

  publishStatus();
  publishHealth();
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(WIFI_STATUS_PIN, !digitalRead(WIFI_STATUS_PIN));
    delay(1000);
    Serial.print(".");
  }

  digitalWrite(WIFI_STATUS_PIN, HIGH);
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());
}

void syncTime() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, "pool.ntp.org");
  struct tm timeInfo;
  while (!getLocalTime(&timeInfo)) {
    Serial.println("Waiting for NTP time");
    delay(500);
  }
}

void onConfigMessage(const JsonDocument& doc) {
  if (doc["message"]["readingIntervalSeconds"].is<float>()) {
    readingIntervalSeconds = clampFloat(
      doc["message"]["readingIntervalSeconds"].as<float>(),
      MIN_READING_INTERVAL_SECONDS,
      MAX_READING_INTERVAL_SECONDS);
  }

  if (doc["message"]["heartbeatInterval"].is<float>()) {
    healthIntervalMinutes = clampFloat(
      doc["message"]["heartbeatInterval"].as<float>(),
      MIN_HEALTH_INTERVAL_MINUTES,
      MAX_HEALTH_INTERVAL_MINUTES);
  }

  publishConfig();
  publishHealth();
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  message.reserve(length);
  for (unsigned int i = 0; i < length; ++i) {
    message += static_cast<char>(payload[i]);
  }

  JsonDocument doc;
  const DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.println("Failed to parse MQTT payload");
    return;
  }

  if (strcmp(topic, topicConfig) == 0) {
    onConfigMessage(doc);
  }
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.println("Attempting MQTT connection...");
    if (mqttClient.connect(deviceId, mqttUser, mqttPassword)) {
      mqttClient.subscribe(topicConfig);
      digitalWrite(MQTT_STATUS_PIN, HIGH);
      publishConfig();
      publishHealth();
      if (!isnan(lastTemperature) && !isnan(lastHumidity)) {
        publishStatus();
      }
      return;
    }

    digitalWrite(MQTT_STATUS_PIN, !digitalRead(MQTT_STATUS_PIN));
    Serial.print("MQTT connect failed, state=");
    Serial.println(mqttClient.state());
    delay(1000);
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(WIFI_STATUS_PIN, OUTPUT);
  pinMode(MQTT_STATUS_PIN, OUTPUT);
  digitalWrite(WIFI_STATUS_PIN, LOW);
  digitalWrite(MQTT_STATUS_PIN, LOW);

  setDeviceId();
  buildTopics();

  dht.begin();
  wifiClient.setInsecure();

  connectWiFi();
  syncTime();

  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(mqttCallback);

  readSensorAndPublish();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (!mqttClient.connected()) {
    connectMQTT();
  }

  mqttClient.loop();

  const unsigned long now = millis();
  const unsigned long readingIntervalMs =
    static_cast<unsigned long>(readingIntervalSeconds * 1000.0f);
  const unsigned long healthIntervalMs =
    static_cast<unsigned long>(healthIntervalMinutes * 60.0f * 1000.0f);

  if (now - lastReadAtMs >= readingIntervalMs) {
    lastReadAtMs = now;
    readSensorAndPublish();
  }

  if (now - lastHealthPublishAtMs >= healthIntervalMs) {
    lastHealthPublishAtMs = now;
    publishHealth();
  }
}
