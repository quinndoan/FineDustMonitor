#ifndef WiFiSelfEnroll_h
#define WiFiSelfEnroll_h
#include <LittleFS.h>
#if defined(ARDUINO_ARCH_ESP32)
    #include <WiFi.h>
    #include <WebServer.h>              /// create webserver
#elif  defined(ARDUINO_ARCH_ESP8266)
    #include <ESP8266WiFi.h>
    #include <ESP8266WebServer.h>       /// create webserver
#endif



/// @brief the default wifi SSID
#define SOICT_WIFI_SSID "SOICT_CORE_BOARD"
/// @brief the default wifi password
#define SOICT_WIFI_PASSWORD "12345678"

/// @brief loop times try to reconnect to the AP before activating the station mode
#define MAX_TRY_WIFI_ACCESS 15

/// @brief Auto restart the device after 5 minute. 
/// This is very useful to make sure that the device isn't trapped in WiFi Adhoc Station mode forever. 
/// Such as in cases the AP restarts, or the electricty gone out.
#define ADHOC_STATION_DURATION 5 * 60

class WiFiSelfEnroll{
    private:
        static String ssid;
        static char myssid[32];
        static String password;
        static char mypassword[20];
        static String deviceid;
        static char mydeviceid[30];
        static WiFiClient wificlient;
#if defined(ARDUINO_ARCH_ESP32)        
        static WebServer server;
#elif  defined(ARDUINO_ARCH_ESP8266)
        static ESP8266WebServer server;
#endif    
    private:
        /// @brief true if the Adhoc WiFi is active
        bool    APMode;
        static void _HomePage();
        static void _EnrollPage();
        static void _APIScan() ;
        static void _APISave();
        static void _APISettings();
        static void _Reboot();  
        void _loop();
    public:
        void ReadWiFiConfig();
        void SetupStation(const char * ssid, const char * password);    
        void setup();  
        void setup(const char * adhoc_ssid, const char * adhoc_password);    
        char * GetSSID();
        char * GetPassword();
        char * GetDeviceID();
        bool IsConfigOK();
};
#endif