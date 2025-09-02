#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Mitsubishi.h>
#include <secrets.h>

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

const char* mqtt_server = MQTT_SERVER;
const int mqtt_port = MQTT_PORT;
const char* mqtt_user = MQTT_USERNAME;
const char* mqtt_pass = MQTT_PASSWORD;

const char* mqtt_topic = "mitsubishi-aircon/control";

WiFiClientSecure wifiClient;
PubSubClient client(wifiClient);

const uint16_t kIrLedPin = 4;
IRMitsubishiAC ac(kIrLedPin);

void connectWiFi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
  }
}

void connectMQTT() {
  while (!client.connected()) {
    if (client.connect("esp32-aircon", mqtt_user, mqtt_pass)) {
      client.subscribe(mqtt_topic);
    } else {
      delay(1000);
    }
  }
}

void sendAirconCommand(const char* cmd) {
  ac.setFan(kMitsubishiAcFanAuto);
  ac.setMode(kMitsubishiAcCool);
  ac.setTemp(24);
  if (String(cmd) == "ON") {
    ac.on();
  } else if (String(cmd) == "OFF") {
    ac.off();
  }
  ac.send();
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    return;
  }
  const char* cmd = doc["message"];
  sendAirconCommand(cmd);
}

void setup() {
  Serial.begin(115200);
  wifiClient.setInsecure();
  connectWiFi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  ac.begin();
}

void loop() {
  if (!client.connected()) {
    connectMQTT();
  }
  client.loop();
}
