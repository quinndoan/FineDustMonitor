#ifndef WIFI_ENROLL_BY_SERIAL_H
#define WIFI_ENROLL_BY_SERIAL_H

#include <Arduino.h>
#include "ConfigManager.h"

/**
 * @brief Đọc Serial và cập nhật cấu hình
 * Cú pháp: ssid=TenWifi, pass=MatKhau, id=MaThietBi
 */
bool EnrollBySerial();

#endif