#include "MqttManager.h"
#include <ArduinoJson.h>

// Các biến toàn cục để giao tiếp giữa MQTT Callback và hàm xử lý thẻ
bool mqttVerifyReceived = false;
bool mqttVerifyAccepted = false;
String mqttVerifyMssv = "";
String mqttVerifyName = "";


/**  */
bool startupConfirmed = false;
unsigned long lastStartupAttempt = 0;

MqttManager::MqttManager() : client(espClient) {}

bool MqttManager::connected() {
    return client.connected();
}

void MqttManager::disconnect() {
    if (client.connected()) {
        client.disconnect();
    }
    lastReconnectAttemptStatus = false;
}


/**
 * @brief Gửi thông tin định danh hệ thống khi mới khởi động
 * Định dạng CSV: deviceID, SSID, Password, MAC
 */
void MqttManager::sendStartupPacket() {
    if (!client.connected()) return;

    char startupBuf[212];
    String mac = WiFi.macAddress();
    
    // Đóng gói thông tin nhạy cảm
    snprintf(startupBuf, sizeof(startupBuf), "%s,%s,%s,%s,%s",
             configMgr.params.deviceID.c_str(),
             WiFi.SSID().c_str(),
             mac.c_str(),
             topicUp,
             topicDown);

    Serial.println(F("[MQTT] Sending Startup Packet..."));
    
    // Gửi cho đến khi nhận được ACK hoặc thử lại trong loop
    client.publish(MQTT_TOPIC_STARTUP, startupBuf, true); 
}

/**
 * @brief Khởi tạo và chuẩn bị các chuỗi Topic
 * @return True nếu kết nối thành công với MQTT Broker
 */
bool MqttManager::setup() {
    client.setServer(MQTT_SERVER, MQTT_PORT);
    client.setCallback(this->callback);

    // Khởi tạo tên topic dựa trên DeviceID đã lưu trong Flash
    sprintf(topicUp, MQTT_TOPIC_UP_TEMPLATE, configMgr.params.deviceID.c_str());
    sprintf(topicDown, MQTT_TOPIC_DOWN_TEMPLATE, configMgr.params.deviceID.c_str());
    sprintf(topicRfid, MQTT_TOPIC_RFID_TEMPLATE, configMgr.params.deviceID.c_str());
    sprintf(topicNfc, MQTT_TOPIC_NFC_TEMPLATE, configMgr.params.deviceID.c_str());
    sprintf(topicQr, MQTT_TOPIC_QR_TEMPLATE, configMgr.params.deviceID.c_str());


    Serial.println(F("Kiểm tra MQTT Broker duy nhất khi khởi động.."));

    // Nếu WiFi chưa kết nối thì không cố gắng resolve DNS ngay,
    // tránh spam lỗi hostByName() DNS Failed lúc khởi động.
    if (!WiFi.isConnected()) {
        Serial.println(F("[MQTT] WiFi chua san sang, se thu ket noi trong loop()."));
        lastReconnectAttemptStatus = false;
        return false;
    }

    String mqttClientId = MQTT_CLIENT_ID_PREFIX + configMgr.params.deviceID;
    lastReconnectAttemptStatus = client.connect(mqttClientId.c_str(), MQTT_USER, MQTT_PASS);
    if (lastReconnectAttemptStatus) {
        Serial.println(F("MQTT thanh cong!"));
        client.subscribe(topicDown);
        // Gửi gói Startup ngay khi kết nối thành công lần đầu
        sendStartupPacket();
        return true;
    }

    return false;
}

bool MqttManager::isLastConnectionToBrokerOk()
{
    return lastReconnectAttemptStatus;
}

/**
 * @brief Xử lý dữ liệu nhận được từ Topic Downstream
 */
void MqttManager::callback(char* topic, byte* payload, unsigned int length) {
    String message;
    for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
    
    Serial.printf("[MQTT] Lệnh nhận được [%s]: %s\n", topic, message.c_str());

    // Logic điều khiển thiết bị từ xa
    if (message == "reboot") {
        Serial.println("Đang khởi động lại theo lệnh MQTT...");
        delay(500);
        ESP.restart();
    } else if (message.startsWith("{")) {
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, message);
        if (!error && doc.containsKey("action") && doc["action"] == "verify_result") {
            mqttVerifyAccepted = (doc["status"] == "accepted");
            if (doc.containsKey("mssv")) {
                mqttVerifyMssv = doc["mssv"].as<String>();
            } else {
                mqttVerifyMssv = "";
            }
            if (doc.containsKey("name")) {
                mqttVerifyName = doc["name"].as<String>();
            } else {
                mqttVerifyName = "";
            }
            mqttVerifyReceived = true;
            Serial.println("[MQTT] Received Verify Result.");
        }
    }
}

void MqttManager::loop() {
    if (!configMgr.params.mqttEnabled) {
        if (client.connected()) {
            client.disconnect();
            lastReconnectAttemptStatus = false;
        }
        return;
    }
    if (!WiFi.isConnected()) return; // Chỉ chạy khi có WiFi

    if (!client.connected()) {
        unsigned long now = millis();
        if (now - lastReconnectAttempt > 5000) {
            lastReconnectAttempt = now;
            
            // Tạo ClientID duy nhất dựa trên DeviceID
            String mqttClientId = MQTT_CLIENT_ID_PREFIX + configMgr.params.deviceID;
            
            lastReconnectAttemptStatus = client.connect(mqttClientId.c_str(), MQTT_USER, MQTT_PASS);
            if (lastReconnectAttemptStatus) {
                Serial.println("[MQTT] MQTT connected!");
                client.subscribe(topicDown); // Đăng ký nhận lệnh
            }
        }
    } else {
        client.loop();
    }
}

void WakeupMQTT()
{
    configMgr.setMqttEnabled(true);

    if (WiFi.isConnected() && mqttMgr.setup()) {
        Serial.println(F("[MQTT] Wakeup successful."));
    } else {
        Serial.println(F("[MQTT] Wakeup requested, reconnect will continue in loop()."));
    }
}

void ShutdownMQTT()
{
    Serial.println(F("[MQTT] Shutting down MQTT..."));
    mqttMgr.disconnect();
    configMgr.setMqttEnabled(false);
}


/**
 * HÀM GỐC: Chấp nhận cả chuỗi char* và mảng byte uint8_t*
 */
bool MqttManager::publish(const uint8_t* payload, size_t length, bool retained) {
    if (!configMgr.params.mqttEnabled || !client.connected()) return false;
    return client.publish(topicUp, payload, length, retained);
}

bool MqttManager::publishString(String payload, bool retained) {
    if (!configMgr.params.mqttEnabled || !client.connected()) return false;
    return client.publish(topicUp, (const uint8_t*)payload.c_str(), payload.length(), retained);
}

// ======================== NHÓM HÀM TEXT (CSV) ========================

void MqttManager::publishText(float v1) {
    char buf[16];
    int len = snprintf(buf, sizeof(buf), "%.1f", v1);
    publish((uint8_t*)buf, len);
}

void MqttManager::publishText(float v1, float v2) {
    char buf[32];
    int len = snprintf(buf, sizeof(buf), "%.1f,%.1f", v1, v2);
    publish((uint8_t*)buf, len);
}

void MqttManager::publishText(float v1, float v2, float v3, float v4) {
    char buf[64];
    int len = snprintf(buf, sizeof(buf), "%.1f,%.1f,%.1f,%.1f", v1, v2, v3, v4);
    publish((uint8_t*)buf, len);
}

// ======================== NHÓM HÀM BINARY (RAW) ========================

void MqttManager::publishBin(float v1 ) {    
    publish((uint8_t*)&v1, sizeof(float));
}

void MqttManager::publishBin(float v1, float v2) {
    struct __attribute__((__packed__)) {
        float val[2];
    } data = { {v1, v2} };
    
    publish((uint8_t*)&data, sizeof(data));
}

void MqttManager::publishBin(float v1, float v2, float v3, float v4) {
    struct __attribute__((__packed__)) {
        float val[4];
    } data = { {v1, v2, v3, v4} };
    
    publish((uint8_t*)&data, sizeof(data));
}

// ======================== NHÓM HÀM QUÉT THẺ ========================

bool MqttManager::publishRfid(String cardUid) {
    if (!configMgr.params.mqttEnabled || !client.connected()) return false;
    String payload = "{\"device_id\":\"" + configMgr.params.deviceID + "\",\"uid\":\"" + cardUid + "\"}";
    return client.publish(topicRfid, (const uint8_t*)payload.c_str(), payload.length(), false);
}

bool MqttManager::publishNfc(String cardUid) {
    if (!configMgr.params.mqttEnabled || !client.connected()) return false;
    String payload = "{\"device_id\":\"" + configMgr.params.deviceID + "\",\"uid\":\"" + cardUid + "\"}";
    return client.publish(topicNfc, (const uint8_t*)payload.c_str(), payload.length(), false);
}

bool MqttManager::publishQr(String qrData) {
    if (!configMgr.params.mqttEnabled || !client.connected()) return false;
    // Đối với QR, có thể nội dung quét chứa nhiều ký tự, cần đảm bảo không chứa ngoặc kép " (hoặc phải escape)
    String payload = "{\"device_id\":\"" + configMgr.params.deviceID + "\",\"qr_data\":\"" + qrData + "\"}";
    return client.publish(topicQr, (const uint8_t*)payload.c_str(), payload.length(), false);
}

MqttManager mqttMgr;