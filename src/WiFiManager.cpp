#include <LittleFS.h>
#include <WiFi.h>
#if defined(ARDUINO_ARCH_ESP32)
#include "esp_wifi.h"
#endif
#include "WifiManager.h"
#include "WiFiSelfEnroll.h"
#include "WiFiEnrollBySerial.h"
#include "configmanager.h"
#include "main.h"

bool wifiStatus = false;
unsigned long lastWifiCheck = 0;

void WiFi_ApplySpoofedStaMacIfConfigured()
{
#if defined(ARDUINO_ARCH_ESP32) && defined(WIFI_SPOOFED_STA_MAC)
    // Parse MAC string WIFI_SPOOFED_STA_MAC in format "AA:BB:CC:DD:EE:FF"
    const char *macStr = WIFI_SPOOFED_STA_MAC;
    unsigned int values[6];
    if (sscanf(macStr, "%x:%x:%x:%x:%x:%x",
               &values[0], &values[1], &values[2],
               &values[3], &values[4], &values[5]) == 6)
    {
        uint8_t mac[6];
        for (int i = 0; i < 6; ++i)
        {
            mac[i] = static_cast<uint8_t>(values[i]);
        }

        esp_err_t err = esp_wifi_set_mac(WIFI_IF_STA, mac);
        if (err == ESP_OK)
        {
            Serial.print(F("[WiFi] Spoofed STA MAC to: "));
            Serial.println(WiFi.macAddress());
        }
        else
        {
            Serial.print(F("[WiFi] Failed to spoof STA MAC, esp_err="));
            Serial.println(static_cast<int>(err));
        }
    }
    else
    {
        Serial.println(F("[WiFi] WIFI_SPOOFED_STA_MAC has invalid format, expected AA:BB:CC:DD:EE:FF"));
    }
#else
    // No-op on non-ESP32 or when spoofing is not configured
#endif
}

void CheckAndEstablishWiFiConnection(unsigned long interval)
{
    // 1. Nếu WiFi bị vô hiệu hóa
    if (!configMgr.params.wifiEnabled)
    {
        if (wifiStatus)
        { // Nếu đang kết nối thì ngắt đi
            WiFi.disconnect();
            wifiStatus = false;
            Serial.println(F("WiFi Disabled. Disconnected."));
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
            WiFi_ApplySpoofedStaMacIfConfigured();
            WiFi.begin(configMgr.params.ssid.c_str(), configMgr.params.password.c_str());
            Serial.println(F("Attempting to reconnect WiFi..."));
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

    // Optionally apply spoofed STA MAC on wakeup as well
    WiFi_ApplySpoofedStaMacIfConfigured();

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