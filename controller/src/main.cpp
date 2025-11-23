#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <time.h>
#include <ArduinoJson.h>
#include <secrets.h>
#include <EEPROM.h>

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

const int weightSensorPin = 34;
const unsigned long DEFAULT_WEIGHT_READ_INTERVAL_MS = 500;
const unsigned long MIN_WEIGHT_READ_INTERVAL_MS = 100;
const unsigned long MAX_WEIGHT_READ_INTERVAL_MS = 10000;
const float DEFAULT_TARGET_WEIGHT_INCREASE = 100.0f;
const float MIN_TARGET_WEIGHT_INCREASE = 0.0f;
const float DEFAULT_TOLERANCE_WEIGHT = 10.0f;
const float MIN_TOLERANCE_WEIGHT = 0.0f;
const unsigned long DEFAULT_TOLERANCE_DURATION_MS = 5000;
const unsigned long MIN_TOLERANCE_DURATION_MS = 1000;
const unsigned long MAX_TOLERANCE_DURATION_MS = 600000;

struct ValveConfig {
  uint8_t pin;
  bool active;
  unsigned long startTime;
  unsigned long lastWeightReadTime;
  float startWeight;
  float lastWeight;
  float targetWeightIncrease;
  float toleranceWeight;
  unsigned long toleranceDurationMs;
  unsigned long weightReadIntervalMs;
  bool toleranceSatisfied;
};

ValveConfig valves[MAX_VALVES] = {
  {32, false, 0, 0, 0.0f, 0.0f, DEFAULT_TARGET_WEIGHT_INCREASE, DEFAULT_TOLERANCE_WEIGHT, DEFAULT_TOLERANCE_DURATION_MS, DEFAULT_WEIGHT_READ_INTERVAL_MS, false},
  {15, false, 0, 0, 0.0f, 0.0f, DEFAULT_TARGET_WEIGHT_INCREASE, DEFAULT_TOLERANCE_WEIGHT, DEFAULT_TOLERANCE_DURATION_MS, DEFAULT_WEIGHT_READ_INTERVAL_MS, false},
  {17, false, 0, 0, 0.0f, 0.0f, DEFAULT_TARGET_WEIGHT_INCREASE, DEFAULT_TOLERANCE_WEIGHT, DEFAULT_TOLERANCE_DURATION_MS, DEFAULT_WEIGHT_READ_INTERVAL_MS, false},
  {18, false, 0, 0, 0.0f, 0.0f, DEFAULT_TARGET_WEIGHT_INCREASE, DEFAULT_TOLERANCE_WEIGHT, DEFAULT_TOLERANCE_DURATION_MS, DEFAULT_WEIGHT_READ_INTERVAL_MS, false}
};

float lastWeightReading = 0.0f;

// wifi connection status pin
const int wifi_connection_status_pin = 27;  //15/27
bool wifi_disconnection_blinker_on = false;

// mqtt connection status pin
const int mqtt_connection_status_pin = 25;  //14/25
bool mqtt_disconnection_blinker_on = false;

WiFiClientSecure wifiClient;
PubSubClient client(wifiClient);

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

  char payload[256];
  serializeJson(doc, payload);

  bool published = client.publish(topic, payload, retain);
  if (published) {
    Serial.print("Message PUBLISHED [");
    Serial.print(topic);
    Serial.print("]: ");
    Serial.println(String(payload));
  } else {
    Serial.print("Message failed to publish ❌ [");
    Serial.print(topic);
    Serial.println("]");
  }
  return published;
}

void publishCommand(const char* topic, const char* cmd, bool retain = true) {
  JsonDocument doc;
  doc["message"] = cmd;
  publishCommand(topic, doc, retain);
}

int topicIdToIndex(int topicId) {
  int index = topicId - 1;
  if (index < 0 || index >= MAX_VALVES) {
    Serial.printf("Invalid valve id %d in topic\n", topicId);
    return -1;
  }
  return index;
}

float readWeightSensor() {
  int rawValue = analogRead(weightSensorPin);
  float weight = static_cast<float>(rawValue);
  lastWeightReading = weight;
  return weight;
}

void publishValveState(int valveIdInTopic, const char* state, float weight,
                       float delta, bool retain = true,
                       const char* reason = nullptr) {
  char topic_status[64];
  snprintf(topic_status, sizeof(topic_status), "%s/%i/%s", deviceId,
           valveIdInTopic, topic_type_status);

  JsonDocument doc;
  JsonObject message = doc["message"].to<JsonObject>();
  message["state"] = state;
  message["weight"] = weight;
  message["weightDelta"] = delta;
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
  valve.toleranceSatisfied = valve.toleranceWeight <= MIN_TOLERANCE_WEIGHT;
  valve.startWeight = readWeightSensor();
  valve.lastWeight = valve.startWeight;
  valve.lastWeightReadTime = millis();

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
  float delta = valve.startWeight - valve.lastWeight;
  publishValveState(valveIdInTopic, "LOW", valve.lastWeight, delta, true,
                    reason);
  valve.startWeight = 0.0f;
  valve.lastWeight = 0.0f;
  valve.startTime = 0;
  valve.lastWeightReadTime = 0;
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
    const char* configType = doc["message"]["configType"];
    if (!configType) {
      Serial.println("⚠️ JSON missing 'message.configType'");
      return;
    }

    if (String(configType) == "weightControl") {
      if (doc["message"].containsKey("targetWeightIncrease")) {
        float receivedTarget =
            doc["message"]["targetWeightIncrease"].as<float>();
        if (receivedTarget >= MIN_TARGET_WEIGHT_INCREASE) {
          valve.targetWeightIncrease = receivedTarget;
          Serial.printf(
              "✅ Valve %d target weight decrease updated to %f\n",
              topic_id, valve.targetWeightIncrease);
        } else {
          Serial.println(
              "⚠️ targetWeightIncrease below minimum, ignoring update");
        }
      }

      if (doc["message"].containsKey("toleranceWeight")) {
        float receivedTolerance =
            doc["message"]["toleranceWeight"].as<float>();
        if (receivedTolerance >= MIN_TOLERANCE_WEIGHT) {
          valve.toleranceWeight = receivedTolerance;
          Serial.printf(
              "✅ Valve %d tolerance weight updated to %f\n",
              topic_id, valve.toleranceWeight);
        } else {
          Serial.println(
              "⚠️ toleranceWeight below minimum, ignoring update");
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
        Serial.printf(
            "✅ Valve %d tolerance duration updated to %lums\n",
            topic_id, valve.toleranceDurationMs);
      }

      if (doc["message"].containsKey("weightReadIntervalMs")) {
        unsigned long receivedInterval =
            doc["message"]["weightReadIntervalMs"].as<unsigned long>();
        if (receivedInterval < MIN_WEIGHT_READ_INTERVAL_MS) {
          receivedInterval = MIN_WEIGHT_READ_INTERVAL_MS;
        } else if (receivedInterval > MAX_WEIGHT_READ_INTERVAL_MS) {
          receivedInterval = MAX_WEIGHT_READ_INTERVAL_MS;
        }
        valve.weightReadIntervalMs = receivedInterval;
        Serial.printf(
            "✅ Valve %d weight read interval updated to %lums\n",
            topic_id, valve.weightReadIntervalMs);
      }
    } else if (String(configType) == "heartbeatInterval") {
      if (doc["message"]["heartbeatInterval"]) {
        float receivedInterval =
            doc["message"]["heartbeatInterval"].as<float>();
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
      } else {
        Serial.println("⚠️ JSON missing 'message.heartbeatInterval'");
      }
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
  pinMode(weightSensorPin, INPUT);
  for (int i=0; i < MAX_VALVES; i++ ) {
    pinMode(valves[i].pin, OUTPUT);
  }

  setDeviceId();
  connectWiFi();
  setTime();

  wifiClient.setInsecure();  // For testing with self-signed cert
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
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

    if (now - valve.lastWeightReadTime >= valve.weightReadIntervalMs) {
      float currentWeight = readWeightSensor();
      valve.lastWeight = currentWeight;
      valve.lastWeightReadTime = now;

      float delta = valve.startWeight - valve.lastWeight;
      int pinState = digitalRead(valve.pin);
      publishValveState(i + 1, pinState == HIGH ? "HIGH" : "LOW",
                        valve.lastWeight, delta, false);

      if (delta >= valve.targetWeightIncrease) {
        Serial.printf("Valve %d target weight decrease reached, closing valve\n",
                      i + 1);
        deactivateSwitch(i + 1, "target_reached");
        continue;
      }

      if (!valve.toleranceSatisfied && delta >= valve.toleranceWeight) {
        valve.toleranceSatisfied = true;
      }
    }

    if (!valve.toleranceSatisfied &&
        now - valve.startTime >= valve.toleranceDurationMs) {
      float delta = valve.startWeight - valve.lastWeight;
      if (delta < valve.toleranceWeight) {
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