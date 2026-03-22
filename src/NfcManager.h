#ifndef NFC_MANAGER_H
#define NFC_MANAGER_H

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>

// Chân giao tiếp mặc định cho SPI của ESP32 (Thường là VSPI):
// SCK = 18, MISO = 19, MOSI = 23
#define SS_PIN  5  // Chân CS (SDA) của MFRC522
#define RST_PIN 32  // Chân RST của MFRC522 (Đổi từ 22 sang 32 để tránh trùng I2C SCL của ngõ màn OLED)

void nfc_init();
void nfc_update();
bool nfc_has_new_tag();
String nfc_get_last_tag();

#endif
