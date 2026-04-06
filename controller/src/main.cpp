#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>
#include <ArduinoJson.h>
#include <secrets.h>
#include <EEPROM.h>
#include "HX711.h"

// HX711 scale
#define HX711_DT 16
#define HX711_SCK 17
const float calibration_factor = 259.6;
HX711 scale;

// device ID
#define EEPROM_SIZE 8
char deviceId[32];

// Wi-Fi
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// MQTT
const char* mqtt_server = MQTT_SERVER;
const int mqtt_port = MQTT_PORT;
const char* mqtt_user = MQTT_USERNAME;
const char* mqtt_pass = MQTT_PASSWORD;

// MQTT topic to publish to
const char* topic_type_status = "status";
// MQTT topic to subscribe to
const char* topic_type_control = "control";
// MQTT topic to subscribe to
const char* topic_type_config = "config";
const char* topic_type_config_request = "config/get";
// MQTT topic to publish to
const char* topic_type_health = "controllerhealth";

const int message_timestamp_threshold = 5;

// system health check
const float healthInterval_max_duration = 20;
const float healthInterval_min_duration = 0.1;
unsigned long lastHealthPublish = 0;
float healthInterval = 5;// 5 minutes

// valve status pin
// const int valve_status_pin = 32;  //23
#define MAX_VALVES 4


const unsigned long DEFAULT_SENSOR_READ_INTERVAL_MS = 500;
const unsigned long MIN_SENSOR_READ_INTERVAL_MS = 100;
const unsigned long MAX_SENSOR_READ_INTERVAL_MS = 1000;
const unsigned long DEFAULT_HIGH_DURATION_MS = 3000;
const unsigned long MIN_HIGH_DURATION_MS = 1000;
const unsigned long MAX_HIGH_DURATION_MS = 600000;
const float DEFAULT_TARGET_WEIGHT_CHANGE = 100.0f;
const float MIN_TARGET_WEIGHT_CHANGE = 50.0f;
const float DEFAULT_TOLERANCE_WEIGHT = 10.0f;
const float MIN_TOLERANCE_WEIGHT = 0.0f;
const unsigned long DEFAULT_TOLERANCE_DURATION_MS = 5000;
const unsigned long MIN_TOLERANCE_DURATION_MS = 1000;
const unsigned long MAX_TOLERANCE_DURATION_MS = 600000;
const uint8_t WEIGHT_SAMPLE_COUNT = 1; // keep reads fast to respect short intervals

enum ControlMode {
  CONTROL_MODE_WEIGHT,
  CONTROL_MODE_TIME,
};

struct ValveConfig {
  uint8_t pin;
  bool active;
  unsigned long startTime;
  unsigned long lastWeightReadTime;
  unsigned long lastProgressPublishTime;
  float startWeight;
  float lastWeight;
  ControlMode controlMode;
  unsigned long highDurationMs;
  float targetWeightChange;
  float toleranceWeight;
  unsigned long toleranceDurationMs;
  unsigned long sensorReadIntervalMs;
  bool toleranceSatisfied;
};

ValveConfig valves[MAX_VALVES] = {
  {32, false, 0, 0, 0, 0.0f, 0.0f, CONTROL_MODE_TIME, DEFAULT_HIGH_DURATION_MS, DEFAULT_TARGET_WEIGHT_CHANGE, DEFAULT_TOLERANCE_WEIGHT, DEFAULT_TOLERANCE_DURATION_MS, DEFAULT_SENSOR_READ_INTERVAL_MS, false},
  {15, false, 0, 0, 0, 0.0f, 0.0f, CONTROL_MODE_TIME, DEFAULT_HIGH_DURATION_MS, DEFAULT_TARGET_WEIGHT_CHANGE, DEFAULT_TOLERANCE_WEIGHT, DEFAULT_TOLERANCE_DURATION_MS, DEFAULT_SENSOR_READ_INTERVAL_MS, false},
  {19, false, 0, 0, 0, 0.0f, 0.0f, CONTROL_MODE_TIME, DEFAULT_HIGH_DURATION_MS, DEFAULT_TARGET_WEIGHT_CHANGE, DEFAULT_TOLERANCE_WEIGHT, DEFAULT_TOLERANCE_DURATION_MS, DEFAULT_SENSOR_READ_INTERVAL_MS, false},
  {18, false, 0, 0, 0, 0.0f, 0.0f, CONTROL_MODE_TIME, DEFAULT_HIGH_DURATION_MS, DEFAULT_TARGET_WEIGHT_CHANGE, DEFAULT_TOLERANCE_WEIGHT, DEFAULT_TOLERANCE_DURATION_MS, DEFAULT_SENSOR_READ_INTERVAL_MS, false}
};

float lastWeightReading = 0.0f;
bool weightSensorInitialized = false;

// wifi connection status pin
const int wifi_connection_status_pin = 27;  //15/27
bool wifi_disconnection_blinker_on = false;

// mqtt connection status pin
const int mqtt_connection_status_pin = 25;  //14/25
bool mqtt_disconnection_blinker_on = false;

WiFiClientSecure wifiClient;
PubSubClient client(wifiClient);

int topicIdToIndex(int topicId);
const char* controlModeToString(ControlMode mode);
void publishValveConfig(int valveIdInTopic);

// Time config (UTC+8 for example)
#define GMT_OFFSET_SEC 0//8 * 3600
#define DAYLIGHT_OFFSET_SEC 0

uint16_t getOrCreateDeviceId() {
  uint16_t id;
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(0, id);

  if (id == 0xFFFF || id == 0) {
    id = esp_random();
    EEPROM.put(0, id);
    EEPROM.commit();
  }

  return id;
}

void setDeviceId(){
  // uint64_t chipId = ESP.getEfuseMac(); // Unique ID 015C
  uint16_t randomId = getOrCreateDeviceId();
  // snprintf(deviceId, sizeof(deviceId), "esp32-%04X-%04X", (uint16_t)(chipId & 0xFFFF), randomId); 
  snprintf(deviceId, sizeof(deviceId), "esp32-%04X", randomId);
  Serial.print("deviceId: ");
  Serial.println(deviceId);

};

void connectWiFi() {
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    wifi_disconnection_blinker_on = !wifi_disconnection_blinker_on;
    delay(1000);
    Serial.print(".");
    if (wifi_disconnection_blinker_on) {
      digitalWrite(wifi_connection_status_pin, HIGH);
    } else {
      digitalWrite(wifi_connection_status_pin, LOW);
    }
  }
  Serial.println("\n✅ WiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  digitalWrite(wifi_connection_status_pin, HIGH);
}

void setTime() {
  // Set up time
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, "pool.ntp.org");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.println("⏳ Waiting for NTP time...");
    delay(500);
  }
  Serial.println("🕒 Time synchronized:");
  Serial.println(&timeinfo, "%Y-%m-%d %H:%M:%S");
}

void testDNS() {
  Serial.println("\n🔍 Testing DNS resolution for MQTT server...");
  IPAddress resolvedIP;
  if (WiFi.hostByName(mqtt_server, resolvedIP)) {
    Serial.print("✅ DNS resolved: ");
    Serial.println(resolvedIP);
  } else {
    Serial.println("❌ DNS resolution failed!");
  }
}

void mqttSubscribe(const char* topic_type) {
  char topic_fullname[64];
  for (int i=0; i < MAX_VALVES; i++ ) {
    snprintf(topic_fullname, sizeof(topic_fullname), "%s/%i/%s", deviceId, i+1, topic_type);
    client.subscribe(topic_fullname);
    Serial.print("MQTT subscribed to ");
    Serial.println(topic_fullname);
  }
}

void connectMQTT() {
  Serial.println("📡 Attempting MQTT connection...");
  while (!client.connect(deviceId, mqtt_user, mqtt_pass)) {
    mqtt_disconnection_blinker_on = !mqtt_disconnection_blinker_on;
    Serial.print("❌ failed. mqttClientState = ");
    Serial.println(client.state());
    if (mqtt_disconnection_blinker_on) {
      digitalWrite(mqtt_connection_status_pin, HIGH);
    } else {
      digitalWrite(mqtt_connection_status_pin, LOW);
    }
    delay(1000);
  }
  Serial.println("✅ MQTT connected!");
  mqttSubscribe(topic_type_control);
  mqttSubscribe(topic_type_config);
  mqttSubscribe(topic_type_config_request);
  digitalWrite(mqtt_connection_status_pin, HIGH);
}

String getCurrentTimestamp() {
  struct tm timeinfo;
  char buffer[30];

  if (!getLocalTime(&timeinfo)) {
    return "unknown";
  }

  struct timeval tv;
  gettimeofday(&tv, nullptr);

  // Format: YYYY-MM-DDTHH:MM:SS.mmmZ
  snprintf(buffer, sizeof(buffer),
           "%04d-%02d-%02dT%02d:%02d:%02d.%03ldZ",
           timeinfo.tm_year + 1900,
           timeinfo.tm_mon + 1,
           timeinfo.tm_mday,
           timeinfo.tm_hour,
           timeinfo.tm_min,
           timeinfo.tm_sec,
           tv.tv_usec / 1000  // milliseconds
  );

  return String(buffer);
}

bool publishCommand(const char* topic, JsonDocument& doc, bool retain = true) {
  doc["timestamp"] = getCurrentTimestamp();

  char payload[384];
  size_t payloadLength = serializeJson(doc, payload, sizeof(payload));
  if (payloadLength == 0 || payloadLength >= sizeof(payload) - 1) {
    Serial.print("Message too large to serialize safely [");
    Serial.print(topic);
    Serial.println("]");
    return false;
  }

  bool published = client.publish(topic, payload, retain);
  if (published) {
    Serial.print("Message PUBLISHED [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(String(payload));
  } else {
    Serial.print("Message failed to publish ❌ [");
    Serial.print(topic);
    Serial.print("] payloadLength=");
    Serial.println(payloadLength);
  }
  return published;
}

void publishCommand(const char* topic, const char* cmd, bool retain = true) {
  JsonDocument doc;
  doc["message"] = cmd;
  publishCommand(topic, doc, retain);
}

void publishValveConfig(int valveIdInTopic) {
  int index = topicIdToIndex(valveIdInTopic);
  if (index < 0) {
    return;
  }

  ValveConfig &valve = valves[index];
  char topic[64];
  snprintf(topic, sizeof(topic), "%s/%i/%s", deviceId, valveIdInTopic,
           topic_type_config);

  JsonDocument doc;
  doc["type"] = topic_type_config;
  JsonObject message = doc["message"].to<JsonObject>();
  message["controlMode"] = controlModeToString(valve.controlMode);
  message["highDuration"] = valve.highDurationMs;
  message["targetWeightChange"] = valve.targetWeightChange;
  message["toleranceWeight"] = valve.toleranceWeight;
  message["toleranceDurationMs"] = valve.toleranceDurationMs;
  message["sensorReadIntervalMs"] = valve.sensorReadIntervalMs;
  message["heartbeatInterval"] = healthInterval;

  publishCommand(topic, doc, true);
}

int topicIdToIndex(int topicId) {
  int index = topicId - 1;
  if (index < 0 || index >= MAX_VALVES) {
    Serial.printf("Invalid valve id %d in topic\n", topicId);
    return -1;
  }
  return index;
}

const char* controlModeToString(ControlMode mode) {
  return mode == CONTROL_MODE_TIME ? "time" : "weight";
}

ControlMode parseControlMode(const char* mode) {
  if (mode && String(mode) == "time") {
    return CONTROL_MODE_TIME;
  }
  return CONTROL_MODE_WEIGHT;
}

float readWeightSensor() {
  if (!weightSensorInitialized) {
    scale.begin(HX711_DT, HX711_SCK);
    scale.set_scale(calibration_factor);
    scale.tare(20);
    weightSensorInitialized = true;
  }
  float weight = scale.get_units(WEIGHT_SAMPLE_COUNT);
  lastWeightReading = weight;
  return weight;
}

void publishValveState(int valveIdInTopic, const char* state, float weight,
                       float weightChange, bool retain = true,
                       const char* reason = nullptr) {
  char topic_status[64];
  snprintf(topic_status, sizeof(topic_status), "%s/%i/%s", deviceId,
           valveIdInTopic, topic_type_status);

  JsonDocument doc;
  doc["type"] = topic_type_status;
  JsonObject message = doc["message"].to<JsonObject>();
  message["state"] = state;
  message["weight"] = weight;
  message["weightChange"] = weightChange;
  int index = topicIdToIndex(valveIdInTopic);
  if (index >= 0) {
    ValveConfig &valve = valves[index];
    message["controlMode"] = controlModeToString(valves[index].controlMode);
    if (valve.controlMode == CONTROL_MODE_TIME) {
      float elapsedSeconds = valve.startTime == 0
                                 ? 0.0f
                                 : (millis() - valve.startTime) / 1000.0f;
      float targetSeconds = valve.highDurationMs / 1000.0f;
      message["progressValue"] = elapsedSeconds > targetSeconds
                                     ? targetSeconds
                                     : elapsedSeconds;
      message["targetValue"] = targetSeconds;
      message["progressUnit"] = "s";
    } else {
      message["progressValue"] = weightChange;
      message["targetValue"] = valve.targetWeightChange;
      message["progressUnit"] = "g";
    }
  }
  if (reason) {
    message["reason"] = reason;
  }
  publishCommand(topic_status, doc, retain);
}

void activateSwitch(int valveIdInTopic) {
  int index = topicIdToIndex(valveIdInTopic);
  if (index < 0) {
    return;
  }

  ValveConfig &valve = valves[index];
  if (valve.active) {
    Serial.printf("Valve %d already active\n", valveIdInTopic);
    return;
  }

  digitalWrite(valve.pin, HIGH);
  valve.active = true;
  valve.startTime = millis();
  valve.toleranceSatisfied =
      valve.controlMode == CONTROL_MODE_WEIGHT &&
      valve.toleranceWeight <= MIN_TOLERANCE_WEIGHT;
  valve.startWeight = valve.controlMode == CONTROL_MODE_WEIGHT
                          ? readWeightSensor()
                          : 0.0f;
  valve.lastWeight = valve.startWeight;
  valve.lastWeightReadTime = millis();
  valve.lastProgressPublishTime = millis();

  publishValveState(valveIdInTopic, "HIGH", valve.startWeight, 0.0f, true);
}

void deactivateSwitch(int valveIdInTopic, const char* reason = nullptr) {
  int index = topicIdToIndex(valveIdInTopic);
  if (index < 0) {
    return;
  }

  ValveConfig &valve = valves[index];
  if (!valve.active) {
    Serial.printf("Valve %d already inactive\n", valveIdInTopic);
    return;
  }

  digitalWrite(valve.pin, LOW);
  valve.active = false;
  float weightChange = valve.startWeight - valve.lastWeight;
  publishValveState(valveIdInTopic, "LOW", valve.lastWeight, weightChange, true,
                    reason);
  valve.startWeight = 0.0f;
  valve.lastWeight = 0.0f;
  valve.startTime = 0;
  valve.lastWeightReadTime = 0;
  valve.lastProgressPublishTime = 0;
  valve.toleranceSatisfied = false;
}

time_t timegm_fallback(struct tm *tm) {
  time_t local = mktime(tm);
  struct tm *gmtm = gmtime(&local);
  time_t gm = mktime(gmtm);
  return local + (local - gm);
}

// Utility to convert ISO8601 string to epoch
time_t parseISOTimeToEpoch(const char* isoString) {
  struct tm tm = {0};
  char temp[25];

  // Copy and strip 'Z' if it's there
  strncpy(temp, isoString, sizeof(temp));
  temp[sizeof(temp) - 1] = '\0';
  size_t len = strlen(temp);
  if (temp[len - 1] == 'Z') {
      temp[len - 1] = '\0';
  }

  // Parse the string (assumes UTC)
  if (strptime(temp, "%Y-%m-%dT%H:%M:%S", &tm)) {
      // Use timegm for UTC (not mktime)
      time_t t = timegm_fallback(&tm);
      return t;
  }

  return 0;
}

bool isTimestampInRange(const char* timestampStr){
    time_t messageTime = parseISOTimeToEpoch(timestampStr);
    time_t now;
    time(&now);

    Serial.printf("Message time: %ld, Current time: %ld\n", messageTime, now);

    return (abs(now - messageTime) <= message_timestamp_threshold);
}

int getIdFromTopic(char* topic){
  // TODO
  char buffer[64];
  strncpy(buffer, topic, sizeof(buffer));
  buffer[sizeof(buffer) - 1] = '\0';

  char* token;
  char* saveptr;

  token = strtok_r(buffer, "/", &saveptr);  // skip clientId
  token = strtok_r(nullptr, "/", &saveptr); // pin
  return token ? atoi(token) : -1;
}

char* getMessageTypeFromTopic(char* topic){
  // TODO
  static char buffer[64];
  strncpy(buffer, topic, sizeof(buffer));
  buffer[sizeof(buffer) - 1] = '\0';

  char* token;
  char* saveptr;

  token = strtok_r(buffer, "/", &saveptr);  // skip clientId
  token = strtok_r(nullptr, "/", &saveptr); // skip pin
  token = strtok_r(nullptr, "/", &saveptr); // messageType
  return token;
}

char* getTopicActionFromTopic(char* topic){
  static char buffer[64];
  strncpy(buffer, topic, sizeof(buffer));
  buffer[sizeof(buffer) - 1] = '\0';

  char* token;
  char* saveptr;

  token = strtok_r(buffer, "/", &saveptr);  // skip clientId
  token = strtok_r(nullptr, "/", &saveptr); // skip pin
  token = strtok_r(nullptr, "/", &saveptr); // skip messageType
  token = strtok_r(nullptr, "/", &saveptr); // action
  return token;
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message RECEIVED [");
  Serial.print(topic);
  Serial.print("]: ");

  // Copy payload to a string
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println(message);

  // Parse JSON
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("deserializeJson() failed ❌: ");
    Serial.println(error.f_str());
    return;
  }

  int topic_id = getIdFromTopic(topic);
  char* topic_type = getMessageTypeFromTopic(topic);
  char* topic_action = getTopicActionFromTopic(topic);

  if (String(topic_type) == String(topic_type_config) &&
      topic_action != nullptr &&
      String(topic_action) == "get") {
    publishValveConfig(topic_id);
    return;
  }

  if (String(topic_type) == String(topic_type_control)) {
    const char* messageTimestamp = doc["timestamp"];
    if(!isTimestampInRange(messageTimestamp)){
      Serial.println("Ignoring stale message");
      return;
    }

    const char* messageContent = doc["message"];
    if (String(messageContent) == "HIGH") {
      activateSwitch(topic_id);
    } else if (String(messageContent) == "LOW") {
      deactivateSwitch(topic_id, "manual");
    }
  } else if (String(topic_type) == String(topic_type_config)) {
    int index = topicIdToIndex(topic_id);
    if (index < 0) {
      return;
    }

    ValveConfig &valve = valves[index];

    if (doc["message"].containsKey("controlMode")) {
      const char* receivedMode = doc["message"]["controlMode"];
      valve.controlMode = parseControlMode(receivedMode);
      Serial.printf("✅ Valve %d control mode updated to %s\n", topic_id,
                    controlModeToString(valve.controlMode));
    }

    if (doc["message"].containsKey("highDuration")) {
      unsigned long receivedDuration =
          doc["message"]["highDuration"].as<unsigned long>();
      if (receivedDuration < MIN_HIGH_DURATION_MS) {
        receivedDuration = MIN_HIGH_DURATION_MS;
      } else if (receivedDuration > MAX_HIGH_DURATION_MS) {
        receivedDuration = MAX_HIGH_DURATION_MS;
      }
      valve.highDurationMs = receivedDuration;
      Serial.printf("✅ Valve %d high duration updated to %lums\n", topic_id,
                    valve.highDurationMs);
    }

    const char* targetWeightKey =
        doc["message"].containsKey("targetWeightChange")
            ? "targetWeightChange"
            : (doc["message"].containsKey("targetWeightIncrease")
                   ? "targetWeightIncrease"
                   : nullptr);

    if (targetWeightKey) {
      float receivedTarget = doc["message"][targetWeightKey].as<float>();
      if (receivedTarget >= MIN_TARGET_WEIGHT_CHANGE) {
        valve.targetWeightChange = receivedTarget;
        Serial.printf("✅ Valve %d target weight change updated to %f\n",
                      topic_id, valve.targetWeightChange);
      } else {
        Serial.println("⚠️ targetWeightChange below minimum, ignoring update");
      }
    }

    if (doc["message"].containsKey("toleranceWeight")) {
      float receivedTolerance = doc["message"]["toleranceWeight"].as<float>();
      if (receivedTolerance >= MIN_TOLERANCE_WEIGHT) {
        valve.toleranceWeight = receivedTolerance;
        Serial.printf("✅ Valve %d tolerance weight updated to %f\n", topic_id,
                      valve.toleranceWeight);
      } else {
        Serial.println("⚠️ toleranceWeight below minimum, ignoring update");
      }
    }

    if (doc["message"].containsKey("toleranceDurationMs")) {
      unsigned long receivedDuration =
          doc["message"]["toleranceDurationMs"].as<unsigned long>();
      if (receivedDuration < MIN_TOLERANCE_DURATION_MS) {
        receivedDuration = MIN_TOLERANCE_DURATION_MS;
      } else if (receivedDuration > MAX_TOLERANCE_DURATION_MS) {
        receivedDuration = MAX_TOLERANCE_DURATION_MS;
      }
      valve.toleranceDurationMs = receivedDuration;
      Serial.printf("✅ Valve %d tolerance duration updated to %lums\n",
                    topic_id, valve.toleranceDurationMs);
    }

      if (doc["message"].containsKey("sensorReadIntervalMs")) {
        unsigned long receivedInterval =
            doc["message"]["sensorReadIntervalMs"].as<unsigned long>();
        if (receivedInterval < MIN_SENSOR_READ_INTERVAL_MS) {
          receivedInterval = MIN_SENSOR_READ_INTERVAL_MS;
        } else if (receivedInterval > MAX_SENSOR_READ_INTERVAL_MS) {
          receivedInterval = MAX_SENSOR_READ_INTERVAL_MS;
        }
      valve.sensorReadIntervalMs = receivedInterval;
      Serial.printf("✅ Valve %d sensor read interval updated to %lums\n",
                    topic_id, valve.sensorReadIntervalMs);
    }

    if (doc["message"].containsKey("heartbeatInterval")) {
      float receivedInterval = doc["message"]["heartbeatInterval"].as<float>();
      if (receivedInterval > healthInterval_max_duration) {
        Serial.printf("Received heartbeat interval duration of %fminutes\n",
                      receivedInterval);
        healthInterval = healthInterval_max_duration;
      } else if (receivedInterval < healthInterval_min_duration) {
        Serial.printf("Received heartbeat interval duration of %fminutes\n",
                      receivedInterval);
        healthInterval = healthInterval_min_duration;
      } else {
        healthInterval = receivedInterval;
      }
      Serial.printf(
          "✅ Heartbeat interval duration for index %i updated to %fminutes\n",
          topic_id, healthInterval);
    }
  }
}

void publishHealthStatus() {
  IPAddress ip = WiFi.localIP();
  char ipStr[16];
  snprintf(ipStr, sizeof(ipStr), "%u.%u.%u.%u", ip[0], ip[1], ip[2], ip[3]);

  for (int i=0; i < MAX_VALVES; i++ ) {
    char topic[64];
    snprintf(topic, sizeof(topic), "%s/%i/%s", deviceId, i+1, topic_type_health);

    JsonDocument doc;
    doc["type"] = topic_type_health;
    JsonObject message = doc["message"].to<JsonObject>();
    message["ipAddress"] = ipStr;
    message["active"] = digitalRead(valves[i].pin) == HIGH;
    message["weight"] = lastWeightReading;
    publishCommand(topic, doc, true);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(wifi_connection_status_pin, OUTPUT);
  pinMode(mqtt_connection_status_pin, OUTPUT);
  for (int i=0; i < MAX_VALVES; i++ ) {
    pinMode(valves[i].pin, OUTPUT);
  }

  setDeviceId();
  connectWiFi();
  setTime();

  wifiClient.setInsecure();  // For testing with self-signed cert
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setBufferSize(512);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    setTime();
  } else if (!client.connected()) {
    testDNS();
    connectMQTT();
  } else {
    client.loop();
  }

  for (int i=0; i < MAX_VALVES; i++ ) {
    ValveConfig &valve = valves[i];
    if (!valve.active) {
      continue;
    }

    unsigned long now = millis();

    if (valve.controlMode == CONTROL_MODE_TIME) {
      if (now - valve.lastProgressPublishTime >= valve.sensorReadIntervalMs) {
        publishValveState(i + 1, "HIGH", valve.lastWeight, 0.0f, false);
        valve.lastProgressPublishTime = now;
      }
      if (now - valve.startTime >= valve.highDurationMs) {
        Serial.printf("Valve %d timer elapsed, closing valve\n", i + 1);
        deactivateSwitch(i + 1, "duration_elapsed");
      }
      continue;
    }

    if (now - valve.lastWeightReadTime >= valve.sensorReadIntervalMs) {
      float currentWeight = readWeightSensor();
      valve.lastWeight = currentWeight;
      valve.lastWeightReadTime = now;

      float weightChange = valve.startWeight - valve.lastWeight;
      int pinState = digitalRead(valve.pin);
      publishValveState(i + 1, pinState == HIGH ? "HIGH" : "LOW",
                        valve.lastWeight, weightChange, false);
      valve.lastProgressPublishTime = now;

      if (weightChange >= valve.targetWeightChange) {
        Serial.printf("Valve %d target weight change reached, closing valve\n",
                      i + 1);
        deactivateSwitch(i + 1, "target_reached");
        continue;
      }

      if (!valve.toleranceSatisfied && weightChange >= valve.toleranceWeight) {
        valve.toleranceSatisfied = true;
      }
    }

    if (!valve.toleranceSatisfied &&
        now - valve.startTime >= valve.toleranceDurationMs) {
      float weightChange = valve.startWeight - valve.lastWeight;
      if (weightChange < valve.toleranceWeight) {
        Serial.printf("Valve %d tolerance condition not met, closing valve\n",
                      i + 1);
        deactivateSwitch(i + 1, "tolerance_timeout");
        continue;
      } else {
        valve.toleranceSatisfied = true;
      }
    }
 }

//  system health
 if (millis() - lastHealthPublish >= healthInterval * 60 * 1000) {
  publishHealthStatus();
  lastHealthPublish = millis();
}
}
