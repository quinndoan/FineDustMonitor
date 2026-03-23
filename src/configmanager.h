#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <Arduino.h>
#include <LittleFS.h>

// --- ĐỊNH NGHĨA TÊN FILE TRONG LITTLEFS ---
#define FILE_WIFI_SSID    "/ssid.txt"
#define FILE_WIFI_PASS    "/password.txt"
#define FILE_DEVICE_ID    "/deviceid.txt"
#define FILE_WIFI_ENABLE  "/enabled.txt"
#define FILE_MQTT_ENABLE  "/mqtt_enabled.txt"

struct PersistentParams {
    String ssid;
    String password;
    String deviceID;
    bool wifiEnabled;
    bool mqttEnabled;
};

class ConfigManager {
public:
    PersistentParams params;

    ConfigManager();
    bool begin();
    void loadAll();
    void saveAll();

    // Các hàm cập nhật từng thành phần và lưu ngay
    void setWifiEnabled(bool enabled);
    void setWiFiConfig(String ssid, String pass);
    void setDeviceID(String id);

private:
    void readFile(const char* path, String &val);
    void writeFile(const char* path, String val);
};

extern ConfigManager configMgr; 

#endif