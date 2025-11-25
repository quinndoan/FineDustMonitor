#include <U8g2lib.h>
#include <Wire.h>
#include <SoftwareSerial.h> // Bắt buộc phải có để dùng Serial trên D5/D6

// --- CẤU HÌNH SOFTWARE SERIAL CHO SDS011 ---
// Sử dụng D5 làm RX, D6 làm TX
#define SDS_RX_PIN D5 // GPIO14 -> Nối với SDS011 TX
#define SDS_TX_PIN D6 // GPIO12 -> Nối với SDS011 RX
SoftwareSerial sdsSerial(SDS_RX_PIN, SDS_TX_PIN); // Khởi tạo cổng Serial mới

// --- CẤU HÌNH OLED (1.3" SH1106 I2C) ---
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

// --- CÁC BIẾN SDS011 ---
float pm25_val = 0.0;
float pm10_val = 0.0;
const int SDS_PACKET_SIZE = 10;
byte sds_buffer[SDS_PACKET_SIZE]; 

// --- NÚT BẤM -----
#define CFG_BUTTON D7

// Chọn tên font mới
#define VIETNAMESE_FONT u8g2_font_unifont_t_vietnamese2

// --- Biến toàn cục chứa mode hoạt động --
// 0 = giá trị tức thời, 1 = đồ thị, 2 = kết luận
char g_mode = 0;
// --------------------------------------------------------
// HÀM: Phân tích và tính toán dữ liệu từ gói 10 byte
// --------------------------------------------------------
void parseSdsData() {
  // 1. Tính toán Checksum (từ Byte 2 đến Byte 7)
  byte calculated_checksum = 0;
  for (int i = 2; i <= 7; i++) {
    calculated_checksum += sds_buffer[i];
  }

  byte received_checksum = sds_buffer[8];

  // 2. Kiểm tra tính toàn vẹn gói dữ liệu
  if (sds_buffer[0] == 0xAA && sds_buffer[1] == 0xC0 && sds_buffer[9] == 0xAB && calculated_checksum == received_checksum) {
    
    // PM2.5 = (DATA 2 * 256 + DATA 1) / 10.0
    unsigned int pm25_int = (sds_buffer[3] << 8) | sds_buffer[2];
    pm25_val = (float)pm25_int / 10.0;

    // PM10 = (DATA 4 * 256 + DATA 3) / 10.0
    unsigned int pm10_int = (sds_buffer[5] << 8) | sds_buffer[4];
    pm10_val = (float)pm10_int / 10.0;
    
    // Gửi thông tin debug ra Serial MẶC ĐỊNH (cổng USB)
    Serial.print("PM2.5, "); Serial.println(pm25_val, 1);
    Serial.print("PM10, "); Serial.println(pm10_val, 1);
    
  } else {
    // Gửi lỗi ra Serial MẶC ĐỊNH
    Serial.print("Loi Checksum (Tinh: 0x"); 
    Serial.print(calculated_checksum, HEX);
    Serial.print(" vs Nhan: 0x"); 
    Serial.print(received_checksum, HEX);
    Serial.println(")");
  }

}

// --------------------------------------------------------
// HÀM: Hiển thị lên màn hình OLED
// --------------------------------------------------------
void displayData() {
  u8g2.clearBuffer(); 
  u8g2.setFontMode(0); 
  
  // Tiêu đề
  u8g2.setFont(VIETNAMESE_FONT); 
  u8g2.drawStr(0, 12, "Unit: ug/m3");
  
  // PM2.5
  u8g2.setFont(u8g2_font_helvR12_te); 
  u8g2.setCursor(0, 35);
  u8g2.print("PM2.5: ");

  u8g2.setFont(u8g2_font_helvR18_tn);   
  u8g2.setCursor(60, 35);
  u8g2.print(pm25_val, 1);

  // PM10
  u8g2.setFont(u8g2_font_helvR12_te); 
  u8g2.setCursor(0,60);
  u8g2.print("PM10: ");

  u8g2.setFont(u8g2_font_helvR18_tr);   
  u8g2.setCursor(60, 60);  
  u8g2.print(pm10_val, 1);
  
  u8g2.sendBuffer(); 
}

// --------------------------------------------------------
// HÀM MỚI: Vẽ đồ thị cột PM2.5 và PM10
// --------------------------------------------------------
void plotData() {
  u8g2.clearBuffer(); 
  u8g2.setFontMode(1); // Set transparent mode
  
  // Chiều cao màn hình (64px) cho giá trị tối đa (64 ug/m3)
  const int MAX_HEIGHT = 64; 
  const int BAR_WIDTH = 30;
  
  // --- Xử lý giá trị PM2.5 (Phần bên trái) ---
  // Giới hạn giá trị ở 64 (1 pixel/ug)
  int pm25_capped = (int)round(min(pm25_val, (float)MAX_HEIGHT)); 
  int pm25_bar_x = 17; // x = (64 - 30) / 2
  int pm25_bar_y_top = MAX_HEIGHT - pm25_capped; // Bar vẽ từ dưới lên
  
  // 1. Vẽ cột PM2.5
  u8g2.drawBox(pm25_bar_x, pm25_bar_y_top, BAR_WIDTH, pm25_capped);
  
  // 2. Vẽ nhãn và giá trị PM2.5
  u8g2.setFont(u8g2_font_7x13_mf); // Font nhỏ để hiển thị giá trị
  u8g2.drawStr(10, 10, "PM2.5");
  u8g2.setCursor(15, 25);
  u8g2.print(pm25_val, 1);
  u8g2.drawStr(20, 40, "ug/m3");

  // --- Xử lý giá trị PM10 (Phần bên phải) ---
  int pm10_capped = (int)round(min(pm10_val, (float)MAX_HEIGHT));
  int pm10_bar_x = 64 + 17; // x = 64 + (64 - 30) / 2
  int pm10_bar_y_top = MAX_HEIGHT - pm10_capped; 
  
  // 3. Vẽ cột PM10
  u8g2.drawBox(pm10_bar_x, pm10_bar_y_top, BAR_WIDTH, pm10_capped);

  // 4. Vẽ nhãn và giá trị PM10
  u8g2.drawStr(64 + 10, 10, "PM10");
  u8g2.setCursor(64 + 15, 25);
  u8g2.print(pm10_val, 1);
  u8g2.drawStr(64 + 20, 40, "ug/m3");
  
  // 5. Vẽ đường phân chia ở giữa (x=63)
  u8g2.drawVLine(63, 0, MAX_HEIGHT); 

  u8g2.sendBuffer(); 
}

// --------------------------------------------------------
// HÀM CHÍNH: setup()
// --------------------------------------------------------
void setup() {
  // 1. Serial MẶC ĐỊNH (cho Debug/PC)
  Serial.begin(115200); 
  Serial.println("\nKhoi dong Wemos D1 Mini. Software Serial tren D5/D6.");

  // 2. Software Serial cho SDS011
  sdsSerial.begin(9600); 

  // 3. Cấu hình OSD
  u8g2.begin();
  u8g2.setFont(VIETNAMESE_FONT);
 
  // 4. Led mặc định  LED_BUILTIN = D4
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  // 5. Nút bấm
  pinMode(CFG_BUTTON, INPUT_PULLUP);

  // 6. Mode hoạt động 
  g_mode = 0;

  // Màn hinh chào
  u8g2.clearBuffer(); 
  u8g2.drawUTF8(0, 12, "Máy đo bụi mịn");
  u8g2.drawStr(12, 40, "PM2.5, PM10");
  u8g2.sendBuffer(); 
  
  delay(1500);

}

// --------------------------------------------------------
// HÀM: Phân loại chất lượng không khí dựa trên giá trị PM
// --------------------------------------------------------
const char* getAQIComment(float pmValue, const char* type) {
    if (strcmp(type, "PM2.5") == 0) {
        if (pmValue >= 56) return "Hại";
        if (pmValue >= 36) return "Kém";
        if (pmValue >= 13) return "Vừa";
        return "Tốt"; // 12 trở xuống
    } else if (strcmp(type, "PM10") == 0) {
        if (pmValue >= 255) return "Hại";
        if (pmValue >= 155) return "Kém";
        if (pmValue >= 55) return "Vừa";
        return "Tốt"; // 54 trở xuống
    }
    return "Khong ro"; 
}

// --------------------------------------------------------
// HÀM MỚI: Hiển thị giá trị và Nhận xét AQI
// --------------------------------------------------------
void displayLevel() {
  u8g2.clearBuffer(); 
  u8g2.setFontMode(1);
  u8g2.setFont(u8g2_font_7x13_mf); // Font tiêu chuẩn
  
  const int CENTER_X = 64;
  const int PM10_START_X = CENTER_X + 2; // Bắt đầu từ 66

  // Vẽ đường phân chia ở giữa
  u8g2.drawVLine(CENTER_X, 0, 64); 

  // --- PHẦN BÊN TRÁI: PM2.5 ---
  
  // 1. Tiêu đề
  u8g2.drawStr(10, 10, "PM2.5");
  
  // 2. Giá trị thực tế
  u8g2.setCursor(5, 30);
  u8g2.setFont(u8g2_font_helvR14_tr); // Font lớn hơn cho số liệu
  u8g2.print(pm25_val, 1);
  
  // 3. Nhận xét (Tốt/Vừa/Kém/Hại)
  const char* comment25 = getAQIComment(pm25_val, "PM2.5");
  u8g2.setFont(u8g2_font_unifont_t_vietnamese1);
  u8g2.drawUTF8(5, 62, comment25);

  
  // --- PHẦN BÊN PHẢI: PM10 ---

  // 1. Tiêu đề
  u8g2.drawStr(PM10_START_X + 10, 10, "PM10");
  
  // 2. Giá trị thực tế
  u8g2.setCursor(PM10_START_X + 5, 30);
  u8g2.setFont(u8g2_font_helvR14_tr); 
  u8g2.print(pm10_val, 1);

  
  // 3. Nhận xét (Tốt/Vừa/Kém/Hại)
  const char* comment10 = getAQIComment(pm10_val, "PM10");
  u8g2.setFont(u8g2_font_unifont_t_vietnamese1);
  u8g2.drawUTF8(PM10_START_X + 5, 62, comment10);

  u8g2.sendBuffer(); 
}



// --------------------------------------------------------
// HÀM CHÍNH: loop()
// --------------------------------------------------------
void loop() {
  // Hiển thị Led chỉ thị mặc định theo nút bấm
  if (digitalRead(CFG_BUTTON) == LOW) {
    g_mode = (g_mode + 1) % 3; 
    digitalWrite(LED_BUILTIN, LOW);
    delay(200);   // Tránh nhảy phím đơn giản
  } else {
    digitalWrite(LED_BUILTIN, HIGH);
  }

  // Đọc từ cổng Software Serial (sdsSerial)
  if (sdsSerial.available() >= SDS_PACKET_SIZE) {
    // Tìm kiếm Header (0xAA)
    if (sdsSerial.peek() == 0xAA) { 
      
      // Đọc toàn bộ gói 10 byte vào buffer
      sdsSerial.readBytes(sds_buffer, SDS_PACKET_SIZE); 

      // Phân tích và hiển thị lên OLED
      parseSdsData();
      if (g_mode == 0) {
        displayData();
      } else if (g_mode == 1) {
        plotData();
      } else {
        displayLevel();
      }
      
    } else {
      // Loại bỏ 1 byte bị lệch khỏi Header và tiếp tục tìm kiếm
      sdsSerial.read(); 
    }
  }
}