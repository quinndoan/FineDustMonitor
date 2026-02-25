#include "WiFiEnrollBySerial.h"
#include <Arduino.h>

void printUsage() {
    Serial.println(F("\n--- AIR MONITOR SERIAL CONFIG MODE ---"));
    Serial.println(F("Commands:"));
    Serial.println(F("  ssid=[name]  : Set WiFi SSID"));
    Serial.println(F("  pass=[key]   : Set WiFi Password"));
    Serial.println(F("  id=[name]    : Set Device ID"));
    Serial.println(F("  exit         : Save and Exit"));
    Serial.println(F("--------------------------------------"));
}

bool EnrollBySerial() {
    unsigned long lastActivity = millis();
    const unsigned long interval = 30000; // 30 giây
    bool shouldExit = false;

    printUsage();

    while (!shouldExit) {
        // 1. Kiểm tra nếu quá 30 giây không có tương tác
        if (millis() - lastActivity > interval) {
            printUsage();
            lastActivity = millis(); // Reset timer
        }

        // 2. Đọc dữ liệu từ Serial
        if (Serial.available() > 0) {
            String input = Serial.readStringUntil('\n');
            input.trim();
            
            if (input.length() == 0) continue;
            
            lastActivity = millis(); // Có hoạt động, reset timer

            if (input == "exit") {
                Serial.println(F(">> Exiting Config Mode..."));
                shouldExit = true;
            } 
            else if (input.startsWith("ssid=")) {
                String val = input.substring(5);
                configMgr.setWiFiConfig(val, configMgr.params.password);
                Serial.printf(">> OK: SSID set to [%s]\n", val.c_str());
            } 
            else if (input.startsWith("pass=")) {
                String val = input.substring(5);
                configMgr.setWiFiConfig(configMgr.params.ssid, val);
                Serial.println(F(">> OK: Password updated."));
            } 
            else if (input.startsWith("id=")) {
                String val = input.substring(3);
                configMgr.setDeviceID(val);
                Serial.printf(">> OK: Device ID set to [%s]\n", val.c_str());
            } 
            else {
                Serial.println(F(">> Unknown command!"));
                printUsage();
            }
        }
        
        yield(); // Quan trọng: Tránh lỗi WDT (Watchdog Timer) trên ESP8266
    }

    return true;
}