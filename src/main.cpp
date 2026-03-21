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
#include "RfidManager.h"   // Quản lý RFID 125kHz

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
#define MODE_NUM 5
char g_mode;



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

  // 8. Mode hoạt động đầu tiên (vào thẳng trang đo đạc)
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
  }
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
    Serial.println("Bam nhanh: Chuyen Mode");
    g_mode = (g_mode + 1) % MODE_NUM;
    renderCurrentMode();       // Vẽ lại ngay lập tức
  }
  else if (evt == DOUBLE_CLICK and g_mode == MODE_INFO)
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
  else if (evt == LONG_PRESS_2S)
  {
    Serial.println("Giu 2s: Đăng kí WiFi");
    showAPConfig(u8g2);
    RegisterWiFi(WIFI_REGISTRATION_METHODS::SELF_STATION);
  }

  // Cập nhật dữ liệu từ module RFID
  rfid_update();

  // Nếu vừa đọc được thẻ RFID thì hiển thị lên Serial và OLED
  if (rfid_has_new_tag()) {
    String tag = rfid_get_last_tag();
    Serial.print("[RFID] Tag: ");
    Serial.println(tag);

    // Hiển thị mã thẻ trên OLED
    u8g2.print(tag.c_str());
  }


}