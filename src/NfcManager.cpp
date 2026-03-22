#include "NfcManager.h"

// Tạo đối tượng MFRC522 cục bộ
MFRC522 mfrc522(SS_PIN, RST_PIN);  

static String nfcBuffer = "";
static bool nfcTagReady = false;

// Tránh việc đọc liên tục 1 thẻ đang để sát vào module, ta set 1 khoảng thời gian cooldown chặn spam
static unsigned long lastTimeRead = 0;
static const unsigned long READ_COOLDOWN_MS = 2000; 

void nfc_init() {
  SPI.begin();           // Khởi tạo bus SPI cứng (18, 19, 23)
  mfrc522.PCD_Init();    // Lệnh khởi động bo mạch con MFRC522
  Serial.println(F("[NFC/MFRC522] Initialized on SPI bus (CS:5, RST:32)"));
}

void nfc_update() {
  // 1. Chỉ kiểm tra thẻ khi đã hết thời gian chống spam cooldown
  if (millis() - lastTimeRead < READ_COOLDOWN_MS) {
      return; 
  }

  // 2. Tìm thẻ mới (Trả về true nếu có thẻ áp sát)
  if ( ! mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // 3. Đọc dữ liệu thẻ (Đọc mã UID của nhà sản xuất)
  if ( ! mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // 4. Nếu đọc UID thành công -> Cấu trúc thành mảng hex (ví dụ mảng 4 bytes [A1 B2 C3 01] ra biến chuỗi "A1B2C301")
  String uidString = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    // Thêm số '0' ở đầu nếu byte hiện tại nhỏ hơn 0x10 (16) để format thành dạng 0X
    if(mfrc522.uid.uidByte[i] < 0x10) {
        uidString += "0";
    }
    uidString += String(mfrc522.uid.uidByte[i], HEX);
  }
  
  uidString.toUpperCase();

  // 5. Lưu trữ mã vào buffer chờ main loop xử lý quét
  nfcBuffer = uidString;
  nfcTagReady = true;

  // 6. Cập nhật lại mốc thời gian đọc gần nhất (Bắt đầu cooldown 2000ms)
  lastTimeRead = millis();

  // 7. Tạm dừng (Halt) kết nối với thẻ hiện tại để module chuyển sang giao tiếp khác nếu cần
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

bool nfc_has_new_tag() {
  return nfcTagReady;
}

String nfc_get_last_tag() {
  String tag = nfcBuffer;
  nfcBuffer = "";
  nfcTagReady = false;
  return tag; // Trả về dạng UID in hoa, ví dụ: 05A2B1BC
}
