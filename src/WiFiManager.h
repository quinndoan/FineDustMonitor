#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>


// /// @brief the default wifi SSID
// #define WIFI_SSID_NAME "SOICT_CORE_BOARD"
// /// @brief the default wifi password
// #define WIFI_SSID_PASS "12345678"

// wifi cho chế độ STA, gần như là không cần thiết vì đang đọc từ litlefs rồi
#define WIFI_SSID_NAME "Quinn"
// @brief the default wifi password
#define WIFI_SSID_PASS "27032021"

// Cấu hình thời gian kiểm tra WiFi (1 phút)
#define WIFI_CHECK_INTERVAL 60000 

enum WIFI_REGISTRATION_METHODS {
    SELF_STATION,
    SERIAL_INTERFACE,
};
 
/**
 * @brief Kết nối lại WiFi nếu cần. Nhưng sẽ bỏ qua nếu @wifiEnabled = false, 
 *        hoặc chưa quá khoảng thời gian interval
 * @param interval 
 * @see wifiEnabled 
 */
void CheckAndEstablishWiFiConnection(unsigned long interval = WIFI_CHECK_INTERVAL);
void WakeupWiFi();
void ShutdownWiFi();

/**
 * @brief Đăng ký thông tin WiFi dựa trên phương thức được chọn.
 * @param method Phương thức đăng ký (SELF_STATION: Web Captive Portal, SERIAL_INTERFACE: Qua Serial)
 * @return bool Trả về kết quả thành công hoặc thất bại của quá trình đăng ký.
 */
bool RegisterWiFi(WIFI_REGISTRATION_METHODS method = WIFI_REGISTRATION_METHODS::SELF_STATION);

#endif