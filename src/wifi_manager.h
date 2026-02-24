#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

// Cấu hình thời gian kiểm tra WiFi (1 phút)
#define WIFI_CHECK_INTERVAL 60000 

// Khai báo các hàm quản lý
void loadWiFiConfig();
bool checkWiFiConnection();
void handleWiFiConnection();
void WakeupWiFi();
void ShutdownWiFi();

#endif