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
#define WIFI_SPOOFED_STA_MAC "74:04:F1:4E:AF:3E"

static bool wifiConnectAttemptInProgress = false;
static unsigned long wifiConnectStartMs = 0;
static unsigned long wifiLastProgressLogMs = 0;
static wl_status_t wifiLastStatusLogged = WL_IDLE_STATUS;
static bool wifiEventLoggerInitialized = false;

static const unsigned long WIFI_CONNECT_PROGRESS_LOG_MS = 2000;
static const unsigned long WIFI_CONNECT_TIMEOUT_MS = 20000;

static const char *WiFiStatusToString(wl_status_t status)
{
    switch (status)
    {
    case WL_IDLE_STATUS:
        return "IDLE";
    case WL_NO_SSID_AVAIL:
        return "NO_SSID_AVAIL";
    case WL_SCAN_COMPLETED:
        return "SCAN_COMPLETED";
    case WL_CONNECTED:
        return "CONNECTED";
    case WL_CONNECT_FAILED:
        return "CONNECT_FAILED";
    case WL_CONNECTION_LOST:
        return "CONNECTION_LOST";
    case WL_DISCONNECTED:
        return "DISCONNECTED";
    default:
        return "UNKNOWN";
    }
}

static void WiFi_LogConnectionSnapshot(const char *prefix)
{
    const wl_status_t st = WiFi.status();
    Serial.print(prefix);
    Serial.print(F(" status="));
    Serial.print(WiFiStatusToString(st));
    Serial.print(F("("));
    Serial.print((int)st);
    Serial.print(F(")"));
    Serial.print(F(" ssid='"));
    Serial.print(configMgr.params.ssid);
    Serial.print(F("' mac="));
    Serial.print(WiFi.macAddress());

    if (st == WL_CONNECTED)
    {
        Serial.print(F(" ip="));
        Serial.print(WiFi.localIP());
        Serial.print(F(" rssi="));
        Serial.print(WiFi.RSSI());
    }

    Serial.println();
}

#if defined(ARDUINO_ARCH_ESP32)
static void WiFi_OnEvent(WiFiEvent_t event, WiFiEventInfo_t info)
{
    switch (event)
    {
    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
        Serial.println(F("[WiFi][Event] STA connected to AP."));
        break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
        Serial.print(F("[WiFi][Event] STA disconnected, reason="));
        Serial.println((int)info.wifi_sta_disconnected.reason);
        break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
        Serial.print(F("[WiFi][Event] STA got IP: "));
        Serial.println(IPAddress(info.got_ip.ip_info.ip.addr));
        break;
    default:
        break;
    }
}

static void WiFi_EnsureEventLogger()
{
    if (!wifiEventLoggerInitialized)
    {
        WiFi.onEvent(WiFi_OnEvent);
        wifiEventLoggerInitialized = true;
        Serial.println(F("[WiFi] Event logger initialized."));
    }
}
#else
static void WiFi_EnsureEventLogger() {}
#endif

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
    WiFi_EnsureEventLogger();

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

    wl_status_t currentStatus = WiFi.status();
    if (currentStatus != wifiLastStatusLogged)
    {
        Serial.print(F("[WiFi] Status transition: "));
        Serial.print(WiFiStatusToString(wifiLastStatusLogged));
        Serial.print(F(" -> "));
        Serial.println(WiFiStatusToString(currentStatus));
        wifiLastStatusLogged = currentStatus;
    }

    if (wifiConnectAttemptInProgress)
    {
        if (wifiStatus)
        {
            WiFi_LogConnectionSnapshot("[WiFi] Connected:");
            wifiConnectAttemptInProgress = false;
        }
        else
        {
            if (currentMillis - wifiLastProgressLogMs >= WIFI_CONNECT_PROGRESS_LOG_MS)
            {
                wifiLastProgressLogMs = currentMillis;
                WiFi_LogConnectionSnapshot("[WiFi] Connecting...");
            }

            if (currentMillis - wifiConnectStartMs >= WIFI_CONNECT_TIMEOUT_MS)
            {
                WiFi_LogConnectionSnapshot("[WiFi] Connect timeout:");
                Serial.println(F("[WiFi] Timeout reached, forcing disconnect before next retry."));
                WiFi.disconnect();
                wifiConnectAttemptInProgress = false;
            }
        }
    }

    if (currentMillis - lastWifiCheck >= interval || lastWifiCheck == 0)
    {
        lastWifiCheck = currentMillis;

        if (!wifiStatus)
        {
            WiFi.mode(WIFI_STA);
            WiFi_ApplySpoofedStaMacIfConfigured();
            WiFi.begin(configMgr.params.ssid.c_str(), configMgr.params.password.c_str());
            Serial.println(F("Attempting to reconnect WiFi..."));
            WiFi_LogConnectionSnapshot("[WiFi] Begin connect:");
            wifiConnectAttemptInProgress = true;
            wifiConnectStartMs = currentMillis;
            wifiLastProgressLogMs = currentMillis;
        }
        else
        {
            WiFi_LogConnectionSnapshot("[WiFi] Already connected:");
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
    WiFi_LogConnectionSnapshot("[WiFi] Wakeup state:");

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