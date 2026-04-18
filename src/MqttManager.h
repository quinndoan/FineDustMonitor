#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include <WiFi.h>
#include <PubSubClient.h>
#include "ConfigManager.h"

// --- CẤU HÌNH MQTT SERVER ---
#define MQTT_SERVER "mqtt.toolhub.app"
#define MQTT_PORT 1883
#define MQTT_USER "demo"  // Thay bằng username của bạn
#define MQTT_PASS "demo" // Thay bằng password của bạn

// --- CẤU HÌNH TOPIC (Sử dụng DeviceID để cá nhân hóa) ---
// Upstream: Thiết bị -> Server (Gửi dữ liệu)
// Downstream: Server -> Thiết bị (Nhận lệnh)
#define MQTT_TOPIC_UP_TEMPLATE "monitor_student/%s/data"
#define MQTT_TOPIC_DOWN_TEMPLATE "monitor_student/%s/cmd"
#define MQTT_TOPIC_STARTUP "startup" // Topic chung cho mọi thiết bị báo danh
#define MQTT_CLIENT_ID_PREFIX "monitor_student-" // Công thức tạo mqtt client id = MQTT_CLIENT_ID_PREFIX + <deviceid> 

class MqttManager
{
private:
    WiFiClient espClient;
    PubSubClient client;

    /** giá trị thời gian (tính bằng milis giây) của lần cuối cùng thiết bị thử kết nối với Broker. Chu kì 5 giây */
    unsigned long lastReconnectAttempt = 0;

    /** trạng thái thành công/thất bại của lần kết nối kết nối cuối cùng với Broker. Chu kì 5 giây. True = thành công*/
    unsigned long lastReconnectAttemptStatus = false;

    char topicUp[64];
    char topicDown[64];


    // Gửi gói tin Startup và chờ xác nhận
    void sendStartupPacket();

    /**
     * @brief Hàm phản hồi (Callback) xử lý dữ liệu từ MQTT Broker gửi xuống.
     * @note Hàm này được thư viện PubSubClient gọi tự động mỗi khi có tin nhắn mới
     * từ các Topic mà thiết bị đã Subscribe (thông thường là topicDown).
     * @param topic   Con trỏ chuỗi chứa tên Topic vừa nhận được dữ liệu.
     * @param payload Mảng byte chứa nội dung tin nhắn (Dữ liệu nhị phân).
     * @param length  Độ dài của nội dung tin nhắn (tính theo byte).
     * @process:
     * 1. Chuyển đổi mảng byte 'payload' sang đối tượng String để dễ xử lý.
     * 2. In thông tin debug ra Serial Monitor.
     * 3. Kiểm tra nội dung lệnh (ví dụ: "reboot") và thực thi logic tương ứng.
     */
    static void callback(char *topic, byte *payload, unsigned int length);

public:
    MqttManager();
    bool setup();
    /** Có kết nối thành công với MQTT Broker không. cập nhật sau mỗi 5 giây */
    bool isLastConnectionToBrokerOk();
    
    /**
     * @brief Duy trì kết nối MQTT (Non-blocking)
     */
    void loop();
    bool connected();
    void disconnect();

    // Hàm gốc điều phối gửi tin
    bool publish(const uint8_t *payload, size_t length, bool retained = true);
    bool publish(const char *topic, const uint8_t *payload, size_t length, bool retained = true);

    // --- BIẾN THỂ CHUỖI VĂN BẢN (JSON / String) ---
    bool publishString(String payload, bool retained = false);

    // --- BIẾN THỂ TEXT (CSV) ---
    void publishText(float v1);
    void publishText(float v1, float v2);
    void publishText(float v1, float v2, float v3, float v4);

    // --- BIẾN THỂ BINARY (Raw Bytes) ---
    void publishBin(float v1);
    void publishBin(float v1, float v2);
    void publishBin(float v1, float v2, float v3, float v4);
};

void WakeupMQTT();
void ShutdownMQTT();

extern MqttManager mqttMgr;

#endif