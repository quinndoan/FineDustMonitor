// Arduino core
#include <Arduino.h>

// Màn hình và I2C
#include <U8g2lib.h>
#include <Wire.h>

#include "ConfigManager.h"  // Cấu hình ghi bộ nhớ Flash
#include "WifiManager.h"    // Quản lý wifi
#include "OledBackdrop.h"   // Giao diện chào trên màn hình điện tử
#include "ButtonGestures.h" // Quản lý các hình thái bấm của 1 nút button
#include "MqttManager.h"    // Gửi dữ liệu lên MQTT mặc định mqtt.toolhub.app
#include "main.h"           // Thông tin dev
#include "Rfid125khzManager.h"   // Quản lý RFID 125kHz
#include "BuzzerManager.h" // Quản lý Loa Buzzer
#include "ApiManager.h"    // Request HTTPS kiểm tra MSSV với Google Sheet
#include "NfcManager.h"    // Quản lý MFRC522 13.56MHz

// --- KHÔNG CÒN SỬ DỤNG MODULE BỤI SDS011 ---

#ifndef LED_BUILTIN
  // Đa số board ESP32 dùng GPIO2 cho LED on-board
  #define LED_BUILTIN 2
#endif

// --- CẤU HÌNH OLED (1.3" SH1106 I2C) ---
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

// Mảng lưu trữ các thông tin khác (nếu cần sau này)

/** Quản lý các hình thái bấm của 1 nút button */
ButtonGesture configBtn(CFG_BUTTON);

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



// --------------------------------------------------------
// CÁC HÀM HIỂN THỊ TRỐNG CHỜ TÍCH HỢP MODULE MỚI
// --------------------------------------------------------
void displayData()
{
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
  u8g2.drawUTF8(5, 30, "Màn hình 1:");
  u8g2.drawUTF8(5, 50, "Đang chờ cảm biến...");
  u8g2.sendBuffer();
}

void plotData()
{
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
  u8g2.drawUTF8(5, 30, "Màn hình 2:");
  u8g2.drawUTF8(5, 50, "Chưa có đồ thị");
  u8g2.sendBuffer();
}

void displayLevel()
{
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
  u8g2.drawUTF8(5, 30, "Màn hình 3:");
  u8g2.drawUTF8(5, 50, "Đợi đánh giá AQI...");
  u8g2.sendBuffer();
}

// --------------------------------------------------------
// HÀM CHÍNH: setup()
// --------------------------------------------------------
void setup()
{
  // 1. Serial MẶC ĐỊNH (cho Debug/PC)
  Serial.begin(115200);
  Serial.println("\nKhoi dong thiet bi quan trac bui min.");

  // 2. Lấy cấu hình từ Flash
  if (configMgr.begin())
  {
    configMgr.loadAll(); // Toàn bộ thông số từ LittleFS đã nằm trong configMgr.params
  }

  // 3. Cấu hình OSD
  u8g2.begin();
  u8g2.setFont(VIETNAMESE_FONT);

  // 4. Màn hinh chào
  showWelcomeScreen(u8g2);



  // 6. Led mặc định  LED_BUILTIN = D4
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  // 7. Nút bấm
  configBtn.begin();

  // 8. Khởi tạo còi Buzzer
  buzzerMgr.begin();
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

  delay(2000);
}



// --------------------------------------------------------
// HÀM CHÍNH: loop()
// --------------------------------------------------------
void renderCurrentMode() {
  if (g_mode == MODE_INFO) {
    showFlashConfig(u8g2, (mqttMgr.isLastConnectionToBrokerOk() ? "MQTT Ok" : "MQTT dis"));
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

void handleCardCheck(String tag, const char* logPrefix) {
    buzzerMgr.beepShort(); // Bíp ngắn chạm thẻ cực nhạy
    
    Serial.print(logPrefix);
    Serial.print(" Tag UID: ");
    Serial.println(tag);

    // Gửi chung gói dữ liệu về server qua trường "rfid".
    // Bạn có thể đổi JSON thành {"nfc":...} nếu muốn phân biệt với 125KHz ở sheet
    String jsonPayload = "{\"rfid\":\"" + tag + "\"}";
    mqttMgr.publishString(jsonPayload);

    // --- BƯỚC 4: GỌI API KIỂM TRA HỢP LỆ VÀ XUẤT LÊN MÀN HÌNH ---
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
    u8g2.drawUTF8(5, 20, "Đang xử lý...");
    u8g2.sendBuffer();
    
    // Yêu cầu API quét (mất ~1-2s)
    String studentName = apiMgr.verifyStudent(tag, true);
    
    u8g2.clearBuffer();
    if(studentName != "") {
        // HỢP LỆ
        u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
        u8g2.drawUTF8(5, 20, "Vào cửa: OK");
        
        // Vẽ tên tiếng Việt có dấu to rõ với tính năng chia dòng
        drawVietnameseName(u8g2,studentName);
        
        u8g2.sendBuffer();
        
        buzzerMgr.beepOk(); // Bíp dài
    } else {
        // TỪ CHỐI
        u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
        u8g2.drawUTF8(20, 35, "[X] TỪ CHỐI");
        u8g2.sendBuffer();
        
        buzzerMgr.beepError(); // Bíp, bíp, bíp (lỗi)
    }

    delay(2000);
    renderCurrentMode(); // Phục hồi trang cũ
    
    // Xóa bộ đệm và reset cooldown của các module tránh bị bắt trùng thẻ cũ lưu trong RX
    // rfid_clear_rx();
    // nfc_clear_rx();
}

void loop()
{

  // WiFi được duy trì liên tục. Sễ passthough nếu thành công rồi
  CheckAndEstablishWiFiConnection();
  // Duy trì kết nối MQTT
  if (wifiStatus)
  {
    mqttMgr.loop();
  }

  // Kiểm tra sự kiện phím bấm
  ButtonEvent evt = configBtn.update();

  // Hiển thị Led chỉ thị mặc định theo nút bấm
  if (evt == SHORT_PRESS)
  {
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
        renderCurrentMode();       // Vẽ lại ngay lập tức
    }
  }
  else if (evt == DOUBLE_CLICK)
  {
    if (g_mode == MODE_SETTINGS) {
        // Bấm đúp tại Settings -> Bật / Tắt giá trị mục đang đứng
        if (settingCursorIndex == 0) {
            configMgr.params.wifiEnabled = !configMgr.params.wifiEnabled; 
            if (!configMgr.params.wifiEnabled) ShutdownWiFi(); else WakeupWiFi();
        } else if (settingCursorIndex == 1) {
            configMgr.params.mqttEnabled = !configMgr.params.mqttEnabled;
        }
        
        configMgr.saveAll();  // Quan trọng: Lưu trực tiếp cấu hình xuống Flash
        buzzerMgr.beepShort(); // Kêu 1 tiếng báo hiệu đã lưu 
        renderCurrentMode();  // Vẽ lại OLED (Để ON đổi thành OFF)
        
    } 
    else if (g_mode == MODE_INFO)
    {
      if (configMgr.params.wifiEnabled)
      {
        Serial.println("Tắt WiFi");
        ShutdownWiFi();
      }
      else
      {
        Serial.println("Bật WiFi");
        WakeupWiFi();
        // hàm  handleWiFiConnection(); sẽ làm nốt phần việc còn lại ở đầu vòng lắp
      }
    }
  }
  else if (evt == LONG_PRESS_2S)
  {
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
  }

  // Nếu vừa đọc được thẻ NFC (Mifare)
  if (nfc_has_new_tag()) {
    handleCardCheck(nfc_get_last_tag(), "[NFC/MFRC522]");
  }

  // --- BƯỚC 1: GIẢ LẬP ĐỌC QR CODE TỪ SERIAL (Mục 1) ---
  if (Serial.available() > 0) {
    String qr_url = Serial.readStringUntil('\n');
    qr_url.trim(); // Loại bỏ khoảng trắng hoặc ký tự \r dư thừa ở cuối

    if (qr_url.length() > 0) {
      buzzerMgr.beepOk(); // Kêu dài để mô phỏng qr nhận
      
      Serial.print("\n[QR_SIMULATION] Quet thanh cong URL: ");
      Serial.println(qr_url);

      // Gửi data URL lên MQTT Server (Gộp chung logic Bước 3)
      String jsonPayload = "{\"qr\":\"" + qr_url + "\"}";
      mqttMgr.publishString(jsonPayload);

      // --- BƯỚC 4: GỌI API BẰNG LINK QR VỪA QUÉT THAY VÌ MÃ THẺ ---
      u8g2.clearBuffer();
      u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
      u8g2.drawUTF8(5, 20, "Tra cứu Server");
      u8g2.sendBuffer();
      
      String studentName = apiMgr.verifyStudent(qr_url, false);
      
      u8g2.clearBuffer();
      if(studentName != "") {
          u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
          u8g2.drawUTF8(5, 20, "Vào cửa: OK");
          
          // Vẽ tên tiếng Việt hiển thị đủ dấu
          drawVietnameseName(u8g2,studentName);
          
          u8g2.sendBuffer();
          buzzerMgr.beepOk();
      } else {
          u8g2.setFont(u8g2_font_unifont_t_vietnamese2);
          u8g2.drawUTF8(20, 35, "[X] LỖI QR");
          u8g2.sendBuffer();
          buzzerMgr.beepError();
      }

      // Giữ màn hình báo nhận thẻ trong 2.5s rồi hồi phục
      delay(2500);
      
      renderCurrentMode();
      
      // Reset cooldown các module tránh dội thẻ
      // rfid_clear_rx();
      // nfc_clear_rx();
    }
  }

}