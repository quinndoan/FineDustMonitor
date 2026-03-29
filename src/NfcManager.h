#ifndef NFC_MANAGER_H
#define NFC_MANAGER_H

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>

// Default SPI pins for ESP32 (usually VSPI):
// SCK = 18, MISO = 19, MOSI = 23
#define SS_PIN  5   // CS (SDA) pin of MFRC522
#define RST_PIN 32  // RST pin of MFRC522 (moved from 22 to avoid conflict with OLED I2C SCL)

void nfc_init();
void nfc_update();
bool nfc_has_new_tag();
String nfc_get_last_tag();

#endif
