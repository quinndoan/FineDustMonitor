#include "WiFiSelfEnroll.h"
#include <Arduino.h>

#ifndef LED_BUILTIN
#define LED_BUILTIN 2   // nếu board dùng GPIO2 cho LED on-board
#endif

/// @brief print more debug information to serial
#define _DEBUG_

#if defined(ARDUINO_ARCH_ESP32)
    /// @brief Press BOOT Button whenever restart to force device into Adhoc Station mode
    //#define BOOT_BUTTON GPIO_NUM_9
#elif defined(ARDUINO_ARCH_ESP8266)
    //#define BOOT_BUTTON 0   // GPIO 0  là nút bấm Flash với nội trở kéo lên
#endif    

/// @brief  the current ssid. A pointer to parambuf
String WiFiSelfEnroll::ssid;
char WiFiSelfEnroll::myssid[32];
/// @brief  the current password. A pointer to parambuf
String WiFiSelfEnroll::password;
char WiFiSelfEnroll::mypassword[20];
/// @brief  the current deviceid. A pointer to parambuf
String WiFiSelfEnroll::deviceid;
char WiFiSelfEnroll::mydeviceid[30];
#if defined(ARDUINO_ARCH_ESP32)        
    /// @brief  adhoc webserver to configure the new wifi network
    WebServer WiFiSelfEnroll::server(80);
#elif  defined(ARDUINO_ARCH_ESP8266)
    /// @brief  adhoc webserver to configure the new wifi network
    ESP8266WebServer WiFiSelfEnroll::server(80);        
#endif    

WiFiClient WiFiSelfEnroll::wificlient;
/*-------------------------------------------------------------------------*/
/// @brief send the homepage html to client
/// @details entrypoint http://192.168.15.1/
void WiFiSelfEnroll::_HomePage() {
    File file = LittleFS.open("/index.html", "r");
    if (!file) {
        server.send(404, "text/plain", "File not found");
        return;
    }
    server.streamFile(file, "text/html");
    file.close();
}

/*-------------------------------------------------------------------------*/
/// @brief send the scan wifi html to client
/// @details entrypoint http://192.168.15.1/enroll
void WiFiSelfEnroll::_EnrollPage() {
    File file = LittleFS.open("/enroll.html", "r");
    if (!file) {
        server.send(404, "text/plain", "File not found");
        return;
    }
    server.streamFile(file, "text/html");
    file.close();
}

/*-------------------------------------------------------------------------*/
/// @brief send wifi list in csv format to web client
/// @details entrypoint http://192.168.15.1/cgi/scan
/// @example 812A,12345678,dce-ktmt,66668888
void WiFiSelfEnroll::_APIScan()  {
    int n = WiFi.scanNetworks();
    Serial.println("scan done");
    String res = String(200);
    res = "";
    if (n != 0) {
        Serial.print(n);
        Serial.println(" networks found");
        for (int i = 0; i < n; ++i) {
            // Print SSID and RSSI for each network found
            res = res + WiFi.SSID(i) + ',' + WiFi.RSSI(i);
            if (i != n-1) {res = res +',';}
            Serial.println(res);
        delay(10);
        }
    }
#ifdef _DEBUG_        
    Serial.println(res);
#endif
    server.send(200,"text/plain", res);
}
/*-------------------------------------------------------------------------*/
/// @brief WebAPI: receive ssid, pass from the HttpGet and save to permanent storage
/// @details exntrypoint http://192.168.15.1/cgi/save?s=ssid&p=password
void WiFiSelfEnroll::_APISave()  {
#ifdef _DEBUG_       
    Serial.println("WiFiSelf: /cgi/save");
    Serial.println(server.uri());
#endif        
    String myArg="s";
    /// Save SSID
    if (server.hasArg(myArg)) {
        ssid = server.arg(myArg);
        File f = LittleFS.open("/ssid.txt", "w");
        f.print(ssid);
        f.close();
    }    

    /// Save Password
    myArg="p";
    if (server.hasArg(myArg)) {
        ssid = server.arg(myArg);
        File f = LittleFS.open("/password.txt", "w");
        f.print(ssid);
        f.close();
    }    

    /// Save DeviceID
    myArg="d";
    if (server.hasArg(myArg)) {
        ssid = server.arg(myArg);
        File f = LittleFS.open("/deviceid.txt", "w");
        f.print(ssid);
        f.close();
    }    

    /// clear all params


    
    /// Response to the web client
    server.send(200,"text/plain", "done deal");
}

/*-------------------------------------------------------------------------*/
/// @brief WebAPI: reponse the wifi configuration and device id
/// @details exntrypoint http://192.168.15.1/cgi/save?n=ssid&p=password
void WiFiSelfEnroll::_APISettings()  {
    char buf[50];
    (ssid + "," + password + ',' + deviceid).toCharArray(buf,50);
#ifdef _DEBUG_       
    Serial.print("WiFiSelf: /cgi/settings - ");
    Serial.println(buf);
#endif
    /// Response to the web client
    server.send(200,"text/plain", buf);
}

/*-------------------------------------------------------------------------*/
/// @brief Read the ssid / deviceid into flash memory
/// @return e.g. '812A,12345678'
void WiFiSelfEnroll::ReadWiFiConfig()  {
#ifdef _DEBUG_       
    Serial.printf("ReadWiFiConfig");
#endif    
    /// Control the flash memory with its idendification namespace, and read mode
    if (LittleFS.exists("/ssid.txt")) {
        File f = LittleFS.open("/ssid.txt", "r");
        ssid = f.readStringUntil('\n');
        f.close();
    }

    if (LittleFS.exists("/deviceid.txt")) {
        File f = LittleFS.open("/deviceid.txt", "r");
        deviceid = f.readStringUntil('\n');
        f.close();
    }    

    if (LittleFS.exists("/password.txt")) {
        File f = LittleFS.open("/password.txt", "r");
        password = f.readStringUntil('\n');
        f.close();
    }  
}        
    
/*-------------------------------------------------------------------------*/
/// @brief Reboot the device
void WiFiSelfEnroll::_Reboot()  {
    #ifdef _DEBUG_             
    Serial.println("restart...");
    #endif              
    ESP.restart();
}

/*-------------------------------------------------------------------------*/
/// @brief setup the Adhoc wifi
/// @param ssid     Wifi name. E.g "My WiFi"
/// @param password  Wifi secret password.
void WiFiSelfEnroll::SetupStation(const char * adhoc_ssid, const char * adhoc_password) {
    APMode = true;
    
    // Read the current wifi config
    ReadWiFiConfig();

    IPAddress local_ip(192,168,15,1);
    IPAddress gateway(192,168,15,1);
    IPAddress subnet(255,255,255,0);

    ///LED_BUILTIN is used for wifi indicator 
    // pinMode(LED_BUILTIN, OUTPUT);

    /// Indicator: start the wifi
    digitalWrite(LED_BUILTIN, HIGH);       

#ifdef _DEBUG_
    Serial.print("Adhoc WiFi: ");
    Serial.print(adhoc_ssid);
    Serial.print(" / ");
    Serial.println(adhoc_password);
#endif    
    
    /// set as a Wi-Fi station and access point simultaneously
    WiFi.mode(WIFI_AP_STA);

    /// Broadcast the Adhoc WiFi
    if (WiFi.softAPConfig(local_ip,gateway,subnet)) {
#ifdef _DEBUG_
        Serial.println("WiFi configuration is okay");
#endif                
    }
    if (WiFi.softAP(adhoc_ssid, adhoc_password,9,false)) {
#ifdef _DEBUG_
        Serial.println("WiFi is ready!");
#endif                 
    }

#ifdef _DEBUG_        
    /// WiFi is ready
    Serial.print("IP address: ");
    Serial.println(WiFi.softAPIP());
#endif    

    /// Route the website
    server.on("/", _HomePage);
    server.on("/enroll", _EnrollPage);
    server.on("/cgi/scan", _APIScan);
    server.on("/cgi/save", _APISave);
    server.on("/cgi/settings", _APISettings);
    server.on("/restart", _Reboot);
    /// Show the own website
    server.begin();
    _loop();
    _Reboot();
}

/// @brief loop with led indicator in a shorttime. just to debug
void WiFiSelfEnroll::_loop()  {          
    unsigned int time_in_station_mode = ADHOC_STATION_DURATION;
    while (time_in_station_mode > 0) {
    #ifdef _DEBUG_     
        if (APMode) {
            Serial.printf("Stations connected to soft-AP = %d \n", WiFi.softAPgetStationNum());
        }
    #endif        
        //polling and call event functions
        server.handleClient();
        //Indicator
        digitalWrite(LED_BUILTIN, HIGH);       
        delay(100);
        digitalWrite(LED_BUILTIN, LOW);        
        delay(100);
        digitalWrite(LED_BUILTIN, HIGH);       
        delay(100);
        digitalWrite(LED_BUILTIN, LOW);                 
        delay(1000);
        time_in_station_mode--;
    }
}

char * WiFiSelfEnroll::GetSSID()  { 
    ssid.toCharArray(myssid, 30);
    return myssid;
}

char * WiFiSelfEnroll::GetPassword()  { 
    password.toCharArray(mypassword, 20);
    return mypassword;
}

char * WiFiSelfEnroll::GetDeviceID()  { 
    deviceid.toCharArray(mydeviceid, 30);
    return mydeviceid;
}

/**
 * @brief Kiểm tra xem ssid và password có chính xác không
 * @return true  kết nối mạng thành công
 * @return false 
 */
bool WiFiSelfEnroll::IsConfigOK(){
    // WiFi Access Status
    wl_status_t wf_status;

    // loop times try to reconnect to the AP before activating the station mode
    byte try_access_times = MAX_TRY_WIFI_ACCESS;

    /// Read the ssid and password stored in the flash memory
    ReadWiFiConfig();

    /// set as a Wi-Fi station and try to connect to the AP
    WiFi.mode(WIFI_STA);
    WiFi.begin(GetSSID(), GetPassword());
#ifdef _DEBUG_     
    Serial.printf("Connecting to %s / %s\n", GetSSID(), GetPassword());
#endif    
    while (try_access_times > 0)
    {
        wf_status = WiFi.status();
#ifdef _DEBUG_        
        switch(wf_status) {
          case WL_NO_SSID_AVAIL:
            Serial.println("[WiFi] SSID not found");
            break;
          case WL_CONNECT_FAILED:
            Serial.print("[WiFi] Failed - WiFi not connected! Reason: ");
            break;
          case WL_CONNECTION_LOST:
            Serial.println("[WiFi] Connection was lost");
            break;
          case WL_SCAN_COMPLETED:
            Serial.println("[WiFi] Scan is completed");
            break;
          case WL_DISCONNECTED:
            Serial.println("[WiFi] WiFi is disconnected");
            break;
#endif
          case WL_CONNECTED:
            #ifdef _DEBUG_       
                Serial.println();
                Serial.print("Connected, IP address: ");
                Serial.println(WiFi.localIP());    
            #endif          
            return true;
                
          default:
            Serial.print("[WiFi] WiFi Status: ");
            Serial.println(WiFi.status());
            break;
        }
        try_access_times = try_access_times -1;
        delay(1000);
    }
    WiFi.disconnect();
    return false;
}

/// @brief make sure WiFi ssid/password is correct. Otherwise, raise the Adhoc AP Station with ssid = SOICT_CORE_BOARD and password =  12345678
void WiFiSelfEnroll::setup() {
    WiFiSelfEnroll::setup(AP_WIFI_SSID, AP_WIFI_PASSWORD);
}

/// @brief make sure WiFi ssid/password is correct. Otherwise, raise the Adhoc AP Station to enter the new config
/// @param ssid     Wifi name. E.g "My WiFi"
/// @param password  Wifi secret password.
/// @note should let it at the first part of the global setup() function in Arduino Code.
/// @example  WiFiSelfEnroll MyWiFi;  MyWiFi.setup("ABC","12345678");  
void WiFiSelfEnroll::setup(const char * adhoc_ssid, const char * adhoc_password) {
    SetupStation(adhoc_ssid, adhoc_password);
}