// Arduino core
#include <Arduino.h>

// Hardware configuration MUST be included first
#include "HardwareConfig.h"
// Core modules (always included)
#include "ApiManager.h"    // Request HTTPS kiểm tra MSSV với Google Sheet
#include "ConfigManager.h" // Cấu hình ghi bộ nhớ Flash
#include "main.h"          // Thông tin dev

// Display module
#if ENABLE_OLED_DISPLAY

// Màn hình và I2C
#include "OledBackdrop.h" // Giao diện chào trên màn hình điện tử
#include <U8g2lib.h>
#include <Wire.h>

#endif

// Communication modules
#if ENABLE_WIFI
#include "WifiManager.h" // Quản lý wifi
#endif

#if ENABLE_MQTT
#include "MqttManager.h" // Gửi dữ liệu lên MQTT mặc định mqtt.toolhub.app
#endif

// Input modules
#if ENABLE_CONFIG_BUTTON
#include "ButtonGestures.h" // Quản lý các hình thái bấm của 1 nút button
#endif

// Output modules
#if ENABLE_BUZZER
#include "BuzzerManager.h" // Quản lý Loa Buzzer
#endif

// RFID/NFC modules
#if ENABLE_RFID_125KHZ
#include "Rfid125khzManager.h" // Quản lý RFID 125kHz
#endif

#if ENABLE_NFC_MFRC522
#include "NfcManager.h" // Quản lý MFRC522 13.56MHz
#endif

#include "ApiManager.h"        // Request HTTPS kiểm tra MSSV với Google Sheet
#include "ButtonGestures.h"    // Quản lý các hình thái bấm của 1 nút button
#include "BuzzerManager.h"     // Quản lý Loa Buzzer
#include "MqttManager.h"       // Gửi dữ liệu lên MQTT mặc định mqtt.toolhub.app
#include "NfcManager.h"        // Quản lý MFRC522 13.56MHz
#include "OledBackdrop.h"      // Giao diện chào trên màn hình điện tử
#include "QrManager.h"         // Quản lý QR scanner qua UART
#include "Rfid125khzManager.h" // Quản lý RFID 125kHz
#include "WifiManager.h"       // Quản lý wifi
#include "main.h"              // Thông tin dev


// --- KHÔNG CÒN SỬ DỤNG MODULE BỤI SDS011 ---

// LED status indicator
// LED_BUILTIN is defined in HardwareConfig.h

// --- GLOBAL OBJECTS (conditionally defined based on features) ---

// OLED Display
#if ENABLE_OLED_DISPLAY
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);
#endif

// Configuration button
#if ENABLE_CONFIG_BUTTON
ButtonGesture configBtn(CFG_BUTTON);
#endif

// Chọn tên font mới
#define VIETNAMESE_FONT u8g2_font_unifont_t_vietnamese2

// --- Biến toàn cục chứa mode hoạt động --
// 0 = Home 1 = giá trị tức thời, 2 = đồ thị, 3 = kết luận
#define MODE_IMMEDIATE 0
#define MODE_PLOT 1
#define MODE_AQI 2
#define MODE_INFO 3
#define MODE_MQTT 4
#define MODE_SETTINGS 5
#define MODE_NUM 6
char g_mode;

uint8_t settingCursorIndex = 0;
#define MAX_SETTINGS_ITEM 2

static String urlDecode(const String &encoded) {
  String out;
  out.reserve(encoded.length());

  for (size_t i = 0; i < encoded.length(); i++) {
    const char c = encoded.charAt(i);
    if (c == '%' && (i + 2) < encoded.length()) {
      const char h1 = encoded.charAt(i + 1);
      const char h2 = encoded.charAt(i + 2);

      auto hexVal = [](char x) -> int {
        if (x >= '0' && x <= '9')
          return x - '0';
        if (x >= 'A' && x <= 'F')
          return x - 'A' + 10;
        if (x >= 'a' && x <= 'f')
          return x - 'a' + 10;
        return -1;
      };

      const int v1 = hexVal(h1);
      const int v2 = hexVal(h2);
      if (v1 >= 0 && v2 >= 0) {
        out += (char)((v1 << 4) | v2);
        i += 2;
        continue;
      }
    }

    out += (c == '+') ? ' ' : c;
  }

  return out;
}

static String jsonEscape(const String &input) {
  String out;
  out.reserve(input.length() + 8);

  for (size_t i = 0; i < input.length(); i++) {
    const char c = input.charAt(i);
    if (c == '"' || c == '\\') {
      out += '\\';
      out += c;
    } else {
      out += c;
    }
  }

  return out;
}

static bool parseHustCardUrl(const String &qrPayload, String &studentIdOut,
                             String &fullNameOut) {
  const String marker = "https://ctsv.hust.edu.vn/#/card/";
  if (!qrPayload.startsWith(marker))
    return false;

  String tail = qrPayload.substring(marker.length());
  tail.trim();

  const int firstSlash = tail.indexOf('/');
  if (firstSlash <= 0)
    return false;

  String studentId = tail.substring(0, firstSlash);
  String fullNameRaw = tail.substring(firstSlash + 1);

  // Chỉ lấy phần tên, bỏ các token hoặc query phía sau nếu có.
  const int nextSlash = fullNameRaw.indexOf('/');
  if (nextSlash >= 0) {
    fullNameRaw = fullNameRaw.substring(0, nextSlash);
  }
  const int queryPos = fullNameRaw.indexOf('?');
  if (queryPos >= 0) {
    fullNameRaw = fullNameRaw.substring(0, queryPos);
  }

  studentId = urlDecode(studentId);
  fullNameRaw = urlDecode(fullNameRaw);
  fullNameRaw.replace("_", " ");

  studentId.trim();
  fullNameRaw.trim();

  if (studentId.length() == 0 || fullNameRaw.length() == 0) {
    return false;
  }

  // MSSV HUST thường là dãy số, kiểm tra để tránh nhận nhầm QR URL khác.
  for (size_t i = 0; i < studentId.length(); i++) {
    if (!isDigit(studentId.charAt(i)))
      return false;
  }

  studentIdOut = studentId;
  fullNameOut = fullNameRaw;
  return true;
}

static bool parseHustCardUrlToJson(const String &qrPayload, String &jsonOut) {
  String studentId;
  String fullName;
  if (!parseHustCardUrl(qrPayload, studentId, fullName))
    return false;

  const String studentIdEsc = jsonEscape(studentId);
  const String fullNameEsc = jsonEscape(fullName);
  const String rawUrlEsc = jsonEscape(qrPayload);

  jsonOut = "{";
  jsonOut += "\"type\":\"hust_card\",";
  jsonOut += "\"student_id\":\"" + studentIdEsc + "\",";
  jsonOut += "\"full_name\":\"" + fullNameEsc + "\",";
  jsonOut += "\"raw_url\":\"" + rawUrlEsc + "\"";
  jsonOut += "}";

  return true;
}

// --------------------------------------------------------
// CÁC HÀM HIỂN THỊ TRỐNG CHỜ TÍCH HỢP MODULE MỚI
// --------------------------------------------------------
void displayData() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
  u8g2.drawUTF8(5, 30, "Màn hình 1:");
  u8g2.drawUTF8(5, 50, "Đang chờ cảm biến...");
  u8g2.sendBuffer();
}

void plotData() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
  u8g2.drawUTF8(5, 30, "Màn hình 2:");
  u8g2.drawUTF8(5, 50, "Chưa có đồ thị");
  u8g2.sendBuffer();
}

void displayLevel() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
  u8g2.drawUTF8(5, 30, "Màn hình 3:");
  u8g2.drawUTF8(5, 50, "Đợi đánh giá AQI...");
  u8g2.sendBuffer();
}

// --------------------------------------------------------
// HÀM CHÍNH: setup()
// --------------------------------------------------------
void setup() {
  // 1. Serial MẶC ĐỊNH (cho Debug/PC)
  Serial.begin(115200);
  Serial.println("\nStart Monitor Student Device...");

  // 2. Lấy cấu hình từ Flash
  if (configMgr.begin()) {
    configMgr.loadAll(); // Toàn bộ thông số từ LittleFS đã nằm trong
                         // configMgr.params
  }

  // 3. Cấu hình OSD
  u8g2.begin();
  u8g2.setFont(VIETNAMESE_FONT);

  // 4. Màn hinh chào
  showWelcomeScreen(u8g2);

  // 6. Led mặc định  LED_BUILTIN = D4
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  // 7. Initialize Config Button
#if ENABLE_CONFIG_BUTTON
  configBtn.begin();
#endif

  // 8. Initialize Buzzer
#if ENABLE_BUZZER
  buzzerMgr.begin();
#endif
  buzzerMgr.beepShort(); // Còi bíp 1 tiếng báo hiệu boot xong

  // 9. Mode hoạt động đầu tiên (vào thẳng trang đo đạc)
  g_mode = MODE_IMMEDIATE;

  // 9. Bắt đầu khởi tạo internet
  if (configMgr.params.wifiEnabled) {
    // Kết nối lần đầu
    CheckAndEstablishWiFiConnection();

    // Thiết lập MQTT
    mqttMgr.setup(); // Khởi tạo MQTT (set server, callback, topic)
  }

  // Khởi tạo RFID 125kHz
  rfid_init();

  // Khởi tạo module NFC 13.56MHz (MFRC522)
  nfc_init();

  // Khởi tạo module QR scanner UART (MH-ET LIVE)
  qr_init();

  delay(2000);
}

// --------------------------------------------------------
// HÀM CHÍNH: loop()
// --------------------------------------------------------
void renderCurrentMode() {
  if (g_mode == MODE_INFO) {
    showFlashConfig(
        u8g2, (mqttMgr.isLastConnectionToBrokerOk() ? "MQTT Ok" : "MQTT dis"));
  } else if (g_mode == MODE_IMMEDIATE) {
    displayData();
  } else if (g_mode == MODE_PLOT) {
    plotData();
  } else if (g_mode == MODE_AQI) {
    displayLevel();
  } else if (g_mode == MODE_MQTT) {
    showMqttConfig(u8g2);
  } else if (g_mode == MODE_SETTINGS) {
    showSettingsPage(u8g2, settingCursorIndex);
  }
}

void handleCardCheck(String tag, const char *logPrefix) {
  buzzerMgr.beepShort(); // Bíp ngắn chạm thẻ cực nhạy

  Serial.print(logPrefix);
  Serial.print(" Tag UID: ");
  Serial.println(tag);

  // Gửi data lên MQTT theo từng topic riêng biệt
  if (String(logPrefix).indexOf("RFID") >= 0) {
      mqttMgr.publishRfid(tag);
  } else if (String(logPrefix).indexOf("NFC") >= 0) {
      mqttMgr.publishNfc(tag);
  }

  // --- BƯỚC 4: GỌI API KIỂM TRA HỢP LỆ VÀ XUẤT LÊN MÀN HÌNH ---
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_8x13B_tr);
  u8g2.drawUTF8(5, 20, "Processing...");
  u8g2.sendBuffer();

  // Đợi phản hồi từ MQTT
  extern bool mqttVerifyReceived;
  extern bool mqttVerifyAccepted;
  extern String mqttVerifyMssv;
  extern String mqttVerifyName;

  mqttVerifyReceived = false;
  unsigned long startWait = millis();
  while (millis() - startWait < 5000) {
      if (wifiStatus) mqttMgr.loop();
      if (mqttVerifyReceived) break;
      delay(10);
  }

  bool isAccepted = false;
  String studentId = "";
  String studentName = "";

  if (mqttVerifyReceived) {
      isAccepted = mqttVerifyAccepted;
      studentId = mqttVerifyMssv;
      studentName = mqttVerifyName;
  } else {
      u8g2.clearBuffer();
      u8g2.setFont(u8g2_font_7x14B_tr);
      u8g2.drawUTF8(5, 35, "Timeout / Error");
      u8g2.sendBuffer();
      buzzerMgr.beepError();
      delay(2000);
      renderCurrentMode();
      return;
  }

  u8g2.clearBuffer();
  if (isAccepted) {
    // HỢP LỆ — dùng font nhỏ để vừa 3 dòng trên 64px
    u8g2.setFont(u8g2_font_6x12_tr);
    u8g2.drawUTF8(5, 10, "Student: Accepted");

    if (studentId.length() > 0) {
      Serial.print("[API] Student ID: ");
      Serial.println(studentId);

      u8g2.drawUTF8(5, 22, ("MSSV: " + studentId).c_str());
    }

    // Vẽ tên tiếng Việt có dấu — font nhỏ hơn, bắt đầu từ Y=36
    drawVietnameseNameCompact(u8g2, studentName);

    u8g2.sendBuffer();

    buzzerMgr.beepOk(); // Bíp dài
  } else {
    // TỪ CHỐI
    u8g2.setFont(u8g2_font_7x14B_tr);
    u8g2.drawUTF8(15, 35, "Student Denied");
    u8g2.sendBuffer();

    buzzerMgr.beepError(); // Bíp, bíp, bíp (lỗi)
  }

  delay(2000);
  renderCurrentMode(); // Phục hồi trang cũ

  // Xóa bộ đệm và reset cooldown của các module tránh bị bắt trùng thẻ cũ lưu
  // trong RX rfid_clear_rx(); nfc_clear_rx();
}

void handleQrCardCheck(const String &qrPayload) {
  // Bước 1: Parse URL thẻ HUST để lấy MSSV
  String parsedStudentId;
  String parsedName;
  if (!parseHustCardUrl(qrPayload, parsedStudentId, parsedName)) {
    Serial.print("[QR/UART] QR không phải thẻ HUST: ");
    Serial.println(qrPayload);
    return;
  }

  buzzerMgr.beepShort();
  Serial.print("[QR/UART] Parsed MSSV: ");
  Serial.print(parsedStudentId);
  Serial.print(" Name: ");
  Serial.println(parsedName);

  // Bước 2: Gửi JSON lên MQTT vào topic riêng của QR
  mqttMgr.publishQr(qrPayload);

  // Bước 3: Hiển thị Processing trên OLED
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_8x13B_tr);
  u8g2.drawUTF8(5, 20, "Processing...");
  u8g2.sendBuffer();

  // Bước 4: Đợi phản hồi từ MQTT
  extern bool mqttVerifyReceived;
  extern bool mqttVerifyAccepted;
  extern String mqttVerifyMssv;
  extern String mqttVerifyName;

  mqttVerifyReceived = false;
  unsigned long startWait = millis();
  while (millis() - startWait < 5000) {
      if (wifiStatus) mqttMgr.loop();
      if (mqttVerifyReceived) break;
      delay(10);
  }

  bool isAccepted = false;
  String studentId = parsedStudentId;
  String studentName = parsedName;

  if (mqttVerifyReceived) {
      isAccepted = mqttVerifyAccepted;
      if (mqttVerifyMssv.length() > 0) studentId = mqttVerifyMssv;
      if (mqttVerifyName.length() > 0) studentName = mqttVerifyName;
  } else {
      u8g2.clearBuffer();
      u8g2.setFont(u8g2_font_7x14B_tr);
      u8g2.drawUTF8(5, 35, "Timeout / Error");
      u8g2.sendBuffer();
      buzzerMgr.beepError();
      delay(2000);
      renderCurrentMode();
      return;
  }

  // Bước 5: Hiển thị kết quả lên OLED
  u8g2.clearBuffer();
  if (isAccepted) {
    u8g2.setFont(u8g2_font_6x12_tr);
    u8g2.drawUTF8(5, 10, "Student: Accepted");

    // Ưu tiên MSSV từ API, fallback về parsed từ URL
    const String &displayId =
        (studentId.length() > 0) ? studentId : parsedStudentId;
    if (displayId.length() > 0) {
      Serial.print("[API] Student ID: ");
      Serial.println(displayId);
      u8g2.drawUTF8(5, 22, ("MSSV: " + displayId).c_str());
    }

    // Ưu tiên tên từ API, fallback về parsed từ URL
    const String &displayName =
        (studentName.length() > 0) ? studentName : parsedName;
    drawVietnameseNameCompact(u8g2, displayName);

    u8g2.sendBuffer();
    buzzerMgr.beepOk();
  } else {
    u8g2.setFont(u8g2_font_7x14B_tr);
    u8g2.drawUTF8(15, 35, "Student Denied");
    u8g2.sendBuffer();
    buzzerMgr.beepError();
  }

  delay(2000);
  renderCurrentMode();
}

void loop() {

  // WiFi được duy trì liên tục. Sễ passthough nếu thành công rồi
  CheckAndEstablishWiFiConnection();
  // Duy trì kết nối MQTT
  if (wifiStatus) {
    mqttMgr.loop();
  }
  
  // Cập nhật và xử lý dữ liệu từ module QR scanner
  qr_update();
  if (qr_has_new_payload()) {
    const String qrPayload = qr_get_last_payload();
    if (qrPayload.length() > 0) {
      handleQrCardCheck(qrPayload);
    }
  }

  // Kiểm tra sự kiện phím bấm
  ButtonEvent evt = configBtn.update();

  // Hiển thị Led chỉ thị mặc định theo nút bấm
  if (evt == SHORT_PRESS) {
    if (g_mode == MODE_SETTINGS) {
      // NẾU: Đang ở trang Settings -> Bấm nhanh là XUỐNG DÒNG (Chuyển con trỏ)
      settingCursorIndex++;
      if (settingCursorIndex >= MAX_SETTINGS_ITEM) {
        // Nếu qua hết các tuỳ chọn -> Thoát để đi sang trang (g_mode) tiếp theo
        settingCursorIndex = 0;
        g_mode = (g_mode + 1) % MODE_NUM;
      }
      renderCurrentMode(); // Vẽ lại menu làm con trỏ nhảy dòng
    } else {
      Serial.println("Bam nhanh: Chuyen Mode");
      g_mode = (g_mode + 1) % MODE_NUM;
      renderCurrentMode(); // Vẽ lại ngay lập tức
    }
  } else if (evt == DOUBLE_CLICK) {
    if (g_mode == MODE_SETTINGS) {
      // Bấm đúp tại Settings -> Bật / Tắt giá trị mục đang đứng
      if (settingCursorIndex == 0) {
        configMgr.params.wifiEnabled = !configMgr.params.wifiEnabled;
        if (!configMgr.params.wifiEnabled)
          ShutdownWiFi();
        else
          WakeupWiFi();
      } else if (settingCursorIndex == 1) {
        if (configMgr.params.mqttEnabled) {
          ShutdownMQTT();
        } else {
          WakeupMQTT();
        }
      }

      buzzerMgr.beepShort(); // Kêu 1 tiếng báo hiệu đã lưu
      renderCurrentMode();   // Vẽ lại OLED (Để ON đổi thành OFF)

    } else if (g_mode == MODE_INFO) {
      if (configMgr.params.wifiEnabled) {
        Serial.println("Tắt WiFi");
        ShutdownWiFi();
      } else {
        Serial.println("Bật WiFi");
        WakeupWiFi();
        // hàm  handleWiFiConnection(); sẽ làm nốt phần việc còn lại ở đầu vòng
        // lắp
      }
    }
  } else if (evt == LONG_PRESS_2S) {
    if (g_mode == MODE_SETTINGS) {
      // Bấm giữ 2s để thoát nhanh về màn hình chính
      g_mode = MODE_IMMEDIATE;
      settingCursorIndex = 0;
      renderCurrentMode();
    } else {
      Serial.println("Giữ 2s: Đăng kí WiFi");
      showAPConfig(u8g2);
      RegisterWiFi(WIFI_REGISTRATION_METHODS::SELF_STATION);
    }
  }

  // Cập nhật dữ liệu từ module RFID 125kHz
  rfid_update();

  // Cập nhật dữ liệu từ module MFRC522 13.56MHz
  nfc_update();

  // Nếu vừa đọc được thẻ RFID
  if (rfid_has_new_tag()) {
    handleCardCheck(rfid_get_last_tag(), "[RFID/125kHz]");
    rfid_flush(); // Xả buffer Serial2 + reset cooldown tránh xử lý trùng
  }

  // Nếu vừa đọc được thẻ NFC (Mifare)
  if (nfc_has_new_tag()) {
    handleCardCheck(nfc_get_last_tag(), "[NFC/MFRC522]");
  }
}