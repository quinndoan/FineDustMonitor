#include "RfidManager.h"

// Sử dụng Serial2 cho module RFID 125kHz
// Nhiều module 125kHz (VD: RDM6300) gửi chuỗi ASCII kết thúc bằng \r hoặc \n

static String rfidBuffer;
static bool rfidTagReady = false;
static bool rfidInFrame = false;

static void finishTagIfValid() {
  if (rfidBuffer.length() > 0) {
    rfidTagReady = true;
  }
}

void rfid_init() {
  rfidBuffer.reserve(32);
  Serial2.begin(RFID_BAUD, SERIAL_8N1, RFID_RX_PIN, RFID_TX_PIN);
  Serial.println("[RFID] Initialized on Serial2");
}

void rfid_update() {
  while (Serial2.available() > 0) {
    char c = (char)Serial2.read();

    // STX: bắt đầu frame RFID (chuẩn phổ biến của RDM6300)
    if (c == 0x02) {
      rfidBuffer = "";
      rfidInFrame = true;
      continue;
    }

    // ETX: kết thúc frame RFID
    if (c == 0x03) {
      if (rfidInFrame) {
        finishTagIfValid();
      }
      rfidInFrame = false;
      continue;
    }

    // Một số module trả dữ liệu theo dòng thay vì STX/ETX
    if (c == '\n' || c == '\r') {
      finishTagIfValid();
      rfidInFrame = false;
      continue;
    }

    // Lọc chỉ cho phép ký tự in được
    if (isPrintable(c)) {
      // Giới hạn độ dài để tránh tràn
      if (rfidBuffer.length() < 32) {
        rfidBuffer += c;
      }
    }
  }
}

bool rfid_has_new_tag() {
  return rfidTagReady;
}

String rfid_get_last_tag() {
  String tag = rfidBuffer;
  rfidBuffer = "";
  rfidTagReady = false;
  return tag;
}
