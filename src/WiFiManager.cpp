#include <LittleFS.h>
#include <ESP8266WiFi.h>
#include "WifiManager.h"
#include "WiFiSelfEnroll.h"     // Quản lý đăng kí tài khoản WiFi bằng self hosting
#include "WiFiEnrollBySerial.h" // Quản lý đăng kí tài khoản WiFi bằng lệnh serial
#include "configmanager.h"
#include "main.h"

bool wifiStatus = false;
unsigned long lastWifiCheck = 0;

void CheckAndEstablishWiFiConnection(unsigned long interval)
{
    // 1. Nếu WiFi bị vô hiệu hóa
    if (!configMgr.params.wifiEnabled)
    {
        if (wifiStatus)
        { // Nếu đang kết nối thì ngắt đi
            WiFi.disconnect();
            wifiStatus = false;
            Serial.println("WiFi Disabled. Disconnected.");
        }
        return; // Thoát luôn, không kiểm tra interval hay kết nối lại
    }

    // 2. Logic kiểm tra WiFi bình thường khi wifiEnabled == true
    unsigned long currentMillis = millis();
    wifiStatus = (WiFi.status() == WL_CONNECTED);

    if (currentMillis - lastWifiCheck >= interval || lastWifiCheck == 0)
    {
        lastWifiCheck = currentMillis;

        if (!wifiStatus)
        {
            WiFi.mode(WIFI_STA);
            WiFi.begin(configMgr.params.ssid.c_str(), configMgr.params.password.c_str());
            Serial.println("Attempting to reconnect WiFi...");
        }
    }
}

void WakeupWiFi()
{
#ifdef _DEBUG_
    Serial.println("[WiFi] Waking up WiFi...");
#endif

#if defined(ARDUINO_ARCH_ESP8266)
    // Đánh thức ESP8266 khỏi chế độ forceSleep
    WiFi.forceSleepWake();
    delay(1);
#endif

    // Khởi động lại chế độ Station
    WiFi.mode(WIFI_STA);

    // Ghi nhớ đã bật wifi
    configMgr.setWifiEnabled(true);
}

void ShutdownWiFi()
{
#ifdef _DEBUG_
    Serial.println("[WiFi] Shutting down WiFi to save power...");
#endif

    WiFi.disconnect(true); // Ngắt kết nối và xóa cấu hình tạm thời
    WiFi.mode(WIFI_OFF);   // Tắt chip Radio RF

#if defined(ARDUINO_ARCH_ESP8266)
    WiFi.forceSleepBegin(); // Lệnh đặc biệt cho ESP8266 để ngủ sâu hơn
#endif

    // Ghi nhớ đã tắt wifi
    configMgr.setWifiEnabled(false);
}

/** Quản lý cấu hình wifi động*/
WiFiSelfEnroll *MyWiFi = nullptr;

bool RegisterWiFi(WIFI_REGISTRATION_METHODS method)
{
    switch (method)
    {
    case WIFI_REGISTRATION_METHODS::SELF_STATION:
    {
        if (MyWiFi == nullptr)
        {
            MyWiFi = new WiFiSelfEnroll();
        }
        // Kích hoạt trạm phát AP để user vào cài đặt
        MyWiFi->setup();
        return true;
    }
    case WIFI_REGISTRATION_METHODS::SERIAL_INTERFACE:
    {
        return EnrollBySerial(); // Gọi hàm từ module mới
    }
    }
    return false;
}