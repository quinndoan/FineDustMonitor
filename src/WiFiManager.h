#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
//#include "WiFiSelfEnroll.h" // Quản lý cấu hình wifi

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
bool RegisterWiFi(WIFI_REGISTRATION_METHODS method = WIFI_REGISTRATION_METHODS::SELF_STATION);

#endif