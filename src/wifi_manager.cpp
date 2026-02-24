#include <LittleFS.h>
#include <ESP8266WiFi.h>
#include "wifi_manager.h"
#include "main.h"

String wifiSSID, wifiPass, deviceID;
bool wifiStatus = false;
unsigned long lastWifiCheck = 0;
bool wifiEnabled = true; // Mặc định là bật

void loadWiFiConfig()
{
    if (!LittleFS.begin())
    {
        Serial.println("LittleFS Mount Failed");
        return;
    }

    // Đọc SSID
    File f1 = LittleFS.open("/deviceid.txt", "r");
    if (f1)
    {
        deviceID = f1.readStringUntil('\n');
        deviceID.trim();
        f1.close();
    }

    // Đọc Password
    File f2 = LittleFS.open("/password.txt", "r");
    if (f2)
    {
        wifiPass = f2.readStringUntil('\n');
        wifiPass.trim();
        f2.close();
    }

    // Đọc Device ID (Nếu có file)
    if (LittleFS.exists("/ssid.txt"))
    {
        File f = LittleFS.open("/ssid.txt", "r");
        if (f)
        {
            wifiSSID = f.readStringUntil('\n');
            wifiSSID.trim();
            f.close();
        }
    }
    else
    {
        Serial.println("LittleFS: /ssid.txt not found!");
    }

    // Thêm vào loadWiFiConfig() trong wifi_manager.cpp
    File fEnabled = LittleFS.open("/wifienabled.txt", "r");
    if (fEnabled)
    {
        String val = fEnabled.readStringUntil('\n');
        val.trim();
        wifiEnabled = (val == "1");
        fEnabled.close();
    }

    Serial.printf("Loaded Config: SSID='%s', ID='%s'\n", wifiSSID.c_str(), deviceID.c_str());
}

void handleWiFiConnection()
{
    // 1. Nếu WiFi bị vô hiệu hóa
    if (!wifiEnabled)
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

    if (currentMillis - lastWifiCheck >= 10000 || lastWifiCheck == 0)
    {
        lastWifiCheck = currentMillis;

        if (!wifiStatus)
        {
            WiFi.mode(WIFI_STA);
            WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
            Serial.println("Attempting to reconnect WiFi...");
        }
    }
}

void WakeupWiFi() {
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
    
}

void ShutdownWiFi() {
    #ifdef _DEBUG_
    Serial.println("[WiFi] Shutting down WiFi to save power...");
    #endif

    WiFi.disconnect(true);    // Ngắt kết nối và xóa cấu hình tạm thời
    WiFi.mode(WIFI_OFF);     // Tắt chip Radio RF

    #if defined(ARDUINO_ARCH_ESP8266)
        WiFi.forceSleepBegin(); // Lệnh đặc biệt cho ESP8266 để ngủ sâu hơn
    #endif
}