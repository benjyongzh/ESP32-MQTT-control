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

const int message_timestamp_threshold = 5;

// valve status pin
// const int valve_status_pin = 32;  //23
#define MAX_VALVES 4

struct ValveConfig {
  uint8_t pin;
  unsigned long durationMs;
  bool active;
  unsigned long startTime;
};

ValveConfig valves[MAX_VALVES] = {
  {32, 3000, false, 0}, // Valve 0
  {15, 3000, false, 0}, // Valve 1
  {17, 3000, false, 0}, // Valve 2
  {18, 3000, false, 0}  // Valve 3
};

// wifi connection status pin
const int wifi_connection_status_pin = 27;  //15/27
bool wifi_disconnection_blinker_on = false;

// mqtt connection status pin
const int mqtt_connection_status_pin = 25;  //14/25
bool mqtt_disconnection_blinker_on = false;

// Default valve ON duration (ms)
const long valve_max_duration = 20000;
const long valve_min_duration = 500;

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

void publishCommand(const char* topic, const char* cmd) {
  JsonDocument doc;
  doc["message"] = cmd;
  doc["timestamp"] = getCurrentTimestamp();

  char payload[256];
  serializeJson(doc, payload);

  bool published = client.publish(topic, payload, true);
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
}

void activateSwitch(int valveIdInTopic) {
  digitalWrite(valves[valveIdInTopic-1].pin, HIGH);
  // Static buffer, max length: clientId + '/' + pin (3 chars max) + '/' + messageType + '\0'
  char topic_status[64];
  snprintf(topic_status, sizeof(topic_status), "%s/%i/%s", deviceId, valveIdInTopic, topic_type_status);
  publishCommand(topic_status, "HIGH");
  valves[valveIdInTopic].active = true;
  valves[valveIdInTopic].startTime = millis();
}

void deactivateSwitch(int valveIdInTopic) {
  digitalWrite(valves[valveIdInTopic-1].pin, LOW);
  char topic_status[64];
  snprintf(topic_status, sizeof(topic_status), "%s/%i/%s", deviceId, valveIdInTopic, topic_type_status);
  publishCommand(topic_status, "LOW");
  valves[valveIdInTopic].active = false;
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
      deactivateSwitch(topic_id);
    }
  } else if (String(topic_type) == String(topic_type_config)) {
    // Check nested structure
    if (doc["message"]["duration"]) {
      long received_duration = doc["message"]["duration"].as<unsigned long>();
      if (received_duration > valve_max_duration) {
        Serial.printf("Received valve duration of %lus\n", received_duration);
        valves[topic_id].durationMs = valve_max_duration;
      } else if (received_duration < valve_min_duration) {
        Serial.printf("Received valve duration of %lus\n", received_duration);
        valves[topic_id].durationMs = valve_min_duration;
      } else {
        valves[topic_id].durationMs = received_duration;
      }
      Serial.printf("✅ Valve duration for %i updated to %lus\n", topic_id, valves[topic_id].durationMs);
    } else {
      Serial.println("⚠️ JSON missing 'message.duration'");
    }
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
    if (valves[i].active == true) {
      unsigned long currentTime = millis();
      if (currentTime - valves[i].startTime >= valves[i].durationMs) {
        // Time's up, turn off the valve
        deactivateSwitch(i);
        Serial.printf("Valve %i auto-turned off after set duration\n", i);
      }
    }
 }
}