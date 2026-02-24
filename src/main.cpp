#include <U8g2lib.h>
#include <Wire.h>
#include <SoftwareSerial.h> // Bắt buộc phải có để dùng Serial trên D5/D6
#include "wifi_manager.h"   // Quản lý wifi
#include "greetingcard.h"   // Giao diện chào trên màn hình điện tử
#include "buttongesture.h"  // Quản lý các hình thái bấm của 1 nút button
#include "main.h"           // Cấu hình chính

// --- CẤU HÌNH SOFTWARE SERIAL CHO SDS011 ---
// Sử dụng D5 làm RX, D6 làm TX
#define SDS_RX_PIN D5                             // GPIO14 -> Nối với SDS011 TX
#define SDS_TX_PIN D6                             // GPIO12 -> Nối với SDS011 RX
SoftwareSerial sdsSerial(SDS_RX_PIN, SDS_TX_PIN); // Khởi tạo cổng Serial mới

// --- CẤU HÌNH OLED (1.3" SH1106 I2C) ---
U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

// --- CÁC BIẾN SDS011 ---
float pm25_val = 0.0;
float pm10_val = 0.0;
const int SDS_PACKET_SIZE = 10;
/** Nội dung 1 gói tin SDS */
byte sds_buffer[SDS_PACKET_SIZE];

// Mảng lưu trữ 16 giá trị PM2.5 gần nhất. [0] là dữ liệu mới nhất
int aqi25_history[MAX_SAMPLES] = {0};
int aqi10_history[MAX_SAMPLES] = {0};
int sample_index = 0;

/** Quản lý các hình thái bấm của 1 nút button */
ButtonGesture configBtn(CFG_BUTTON);

// Chọn tên font mới
#define VIETNAMESE_FONT u8g2_font_unifont_t_vietnamese2

// --- Biến toàn cục chứa mode hoạt động --
// 0 = Home 1 = giá trị tức thời, 2 = đồ thị, 3 = kết luận
#define MODE_INFO 0
#define MODE_IMMEDIATE 1
#define MODE_PLOT 2
#define MODE_AQI 3
#define MODE_NUM 4
char g_mode = MODE_INFO;

// --------------------------------------------------------
// HÀM: Phân tích và tính toán dữ liệu từ gói 10 byte
// --------------------------------------------------------
void parseSdsData()
{
  // 1. Tính toán Checksum (từ Byte 2 đến Byte 7)
  byte calculated_checksum = 0;
  for (int i = 2; i <= 7; i++)
  {
    calculated_checksum += sds_buffer[i];
  }

  byte received_checksum = sds_buffer[8];

  // 2. Kiểm tra tính toàn vẹn gói dữ liệu
  if (sds_buffer[0] == 0xAA && sds_buffer[1] == 0xC0 && sds_buffer[9] == 0xAB && calculated_checksum == received_checksum)
  {

    // PM2.5 = (DATA 2 * 256 + DATA 1) / 10.0
    unsigned int pm25_int = (sds_buffer[3] << 8) | sds_buffer[2];
    pm25_val = (float)pm25_int / 10.0;

    // PM10 = (DATA 4 * 256 + DATA 3) / 10.0
    unsigned int pm10_int = (sds_buffer[5] << 8) | sds_buffer[4];
    pm10_val = (float)pm10_int / 10.0;

    // Gửi thông tin debug ra Serial MẶC ĐỊNH (cổng USB)
    Serial.print("PM2.5, ");
    Serial.println(pm25_val, 1);
    Serial.print("PM10, ");
    Serial.println(pm10_val, 1);
  }
  else
  {
    // Gửi lỗi ra Serial MẶC ĐỊNH
    Serial.print("Loi Checksum (Tinh: 0x");
    Serial.print(calculated_checksum, HEX);
    Serial.print(" vs Nhan: 0x");
    Serial.print(received_checksum, HEX);
    Serial.println(")");
  }
}

// --------------------------------------------------------
// HÀM: Cập nhật mảng lịch sử (FIFO - 16 mẫu)
// --------------------------------------------------------
void updateHistory(int new_aqi25, int new_aqi10)
{
  // 1. Dịch chuyển tất cả các mẫu cũ sang phải (từ cuối mảng về vị trí [1])
  // Ví dụ: [0] -> [1], [1] -> [2], ..., [MAX_SAMPLES-2] -> [MAX_SAMPLES-1]
  for (int i = MAX_SAMPLES - 1; i > 0; i--)
  {
    aqi25_history[i] = aqi25_history[i - 1];
    aqi10_history[i] = aqi10_history[i - 1];
  }

  // 2. Thêm giá trị mới vào vị trí đầu tiên [0]
  aqi25_history[0] = new_aqi25;
  aqi10_history[0] = new_aqi10;
}

// --------------------------------------------------------
// HÀM: Hiển thị lên màn hình OLED
// --------------------------------------------------------
void displayData()
{
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
  u8g2.setCursor(55, 35);
  u8g2.print(pm25_val, 1);

  // PM10
  u8g2.setFont(u8g2_font_helvR12_te);
  u8g2.setCursor(0, 60);
  u8g2.print("PM10: ");

  u8g2.setFont(u8g2_font_helvR18_tr);
  u8g2.setCursor(55, 60);
  u8g2.print(pm10_val, 1);

  u8g2.sendBuffer();
}

// --------------------------------------------------------
// HÀM MỚI: Vẽ đồ thị cột PM2.5 và PM10
// --------------------------------------------------------
void plotData()
{
  u8g2.clearBuffer();
  u8g2.setFontMode(0);

  const int CENTER_X = 63;
  const int CHART_HEIGHT = 40;
  const int CHART_Y_START = 63;
  const int X_STEP = 4; // 4 pixels/sample

  // --- TIÊU ĐỀ VÀ GIÁ TRỊ HIỆN TẠI ---
  u8g2.setFont(u8g2_font_7x13_mf);
  u8g2.drawStr(3, 12, "AQI 2.5   AQI 10");

  // Vẽ đường phân chia và trục X chung
  u8g2.drawVLine(CENTER_X, 0, 64);
  u8g2.drawHLine(0, CHART_Y_START, 128);

  // --- VẼ ĐỒ THỊ ---
  // Chúng ta sẽ vẽ mảng từ trái sang phải, nhưng truy cập mảng theo thứ tự đảo ngược
  int prev_x_25 = -1;
  int prev_y_25 = -1;
  int prev_x_10 = -1;
  int prev_y_10 = -1;

  // Lặp qua các vị trí X trên màn hình (i từ 0 đến 15)
  for (int i = 0; i < MAX_SAMPLES; i++)
  {

    // Chỉ số của dữ liệu trong mảng: i=0 là điểm cũ nhất (vị trí [15]), i=15 là điểm mới nhất (vị trí [0])
    int data_index = MAX_SAMPLES - 1 - i;

    // Lấy giá trị AQI
    int capped_aqi_25 = min(aqi25_history[data_index], MAX_AQI_VALUE);
    int capped_aqi_10 = min(aqi10_history[data_index], MAX_AQI_VALUE);

    // Tỷ lệ Y
    float scaled_value_25 = (float)capped_aqi_25 * ((float)CHART_HEIGHT / (float)MAX_AQI_VALUE);
    float scaled_value_10 = (float)capped_aqi_10 * ((float)CHART_HEIGHT / (float)MAX_AQI_VALUE);

    // --- 1. AQI 2.5 (LEFT CHART) ---
    int current_x_25 = i * X_STEP; // X-axis 0 đến 60
    int current_y_25 = (int)round(CHART_Y_START - scaled_value_25);

    // Vẽ đường nối AQI 2.5
    if (prev_x_25 != -1)
    {
      u8g2.drawLine(prev_x_25, prev_y_25, current_x_25, current_y_25);
    }

    // --- 2. AQI 10 (RIGHT CHART) ---
    int current_x_10 = CENTER_X + (i * X_STEP); // X-axis 63 đến 127
    int current_y_10 = (int)round(CHART_Y_START - scaled_value_10);

    // Vẽ đường nối AQI 10
    if (prev_x_10 != -1)
    {
      u8g2.drawLine(prev_x_10, prev_y_10, current_x_10, current_y_10);
    }

    // --- Cập nhật biến lưu trữ ---
    prev_x_25 = current_x_25;
    prev_y_25 = current_y_25;
    prev_x_10 = current_x_10;
    prev_y_10 = current_y_10;
  }
  // Hiển thị giá trị hiện thời

  // HIển thị giá trị AQI mới nhất ở sát cạnh phải của cột đồ thị
  if (aqi25_history[0] > 37)
  {
    // Nếu AQI > 37 (tương đương Y < 40), in số ở phía dưới đường line để tránh mất số
    u8g2.setCursor(40, 54);
  }
  else
  {
    // Nếu AQI thấp, in số ở phía trên đường line
    u8g2.setCursor(40, 35);
  }
  // Hiển thị mức AQI hiện thời
  u8g2.print(aqi25_history[0]);

  if (aqi10_history[0] > 37)
  {
    u8g2.setCursor(CENTER_X + 40, 54);
  }
  else
  {
    u8g2.setCursor(CENTER_X + 40, 35);
  }
  u8g2.print(aqi10_history[0]);

  // Hiển thị
  u8g2.sendBuffer();
}

// --------------------------------------------------------
// HÀM CHÍNH: setup()
// --------------------------------------------------------
void setup()
{
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
  configBtn.begin();

  // 6. Mode hoạt động
  g_mode = MODE_INFO;

  // Màn hinh chào
  showWelcomeScreen(u8g2, "", "");

  // Kiêm tra wifi.
  loadWiFiConfig();
  // Kết nối lần đầu
  handleWiFiConnection();
  // Màn hinh chào
  showWelcomeScreen(u8g2, wifiStatus ? wifiSSID.c_str() : "OFF", "OFF");

  delay(3000);
}

// --------------------------------------------------------
// HÀM: Phân loại chất lượng không khí dựa trên giá trị PM
// --------------------------------------------------------
const char *getAQIComment(float pmValue, const char *type)
{
  if (strcmp(type, "PM2.5") == 0)
  {
    if (pmValue >= 56)
      return "Hại";
    if (pmValue >= 36)
      return "Kém";
    if (pmValue >= 13)
      return "Vừa";
    return "Tốt"; // 12 trở xuống
  }
  else if (strcmp(type, "PM10") == 0)
  {
    if (pmValue >= 255)
      return "Hại";
    if (pmValue >= 155)
      return "Kém";
    if (pmValue >= 55)
      return "Vừa";
    return "Tốt"; // 54 trở xuống
  }
  return "Khong ro";
}

// --------------------------------------------------------
// HÀM MỚI: Tính toán chỉ số AQI từ nồng độ PM
// --------------------------------------------------------
int calculateAQI(float pmValue, const char *type)
{

  // Khai báo các điểm giới hạn AQI (US EPA Standard 24-hour)
  // C_breakpoints: Nồng độ PM (ug/m3)
  // I_breakpoints: Chỉ số AQI

  float C_breakpoints[6]; // Concentration breakpoints
  int I_breakpoints[6];   // AQI Index breakpoints

  // Số lượng ngưỡng AQI (0-50, 51-100, 101-150, 151-200, 201-300, 301-500)
  const int NUM_BREAKPOINTS = 6;

  // Nếu là PM2.5
  if (strcmp(type, "PM2.5") == 0)
  {
    // Nồng độ PM2.5 (ug/m3)
    C_breakpoints[0] = 0.0;
    C_breakpoints[1] = 12.1;
    C_breakpoints[2] = 35.5;
    C_breakpoints[3] = 55.5;
    C_breakpoints[4] = 150.5;
    C_breakpoints[5] = 250.5;
    // Chỉ số AQI tương ứng
    I_breakpoints[0] = 0;
    I_breakpoints[1] = 51;
    I_breakpoints[2] = 101;
    I_breakpoints[3] = 151;
    I_breakpoints[4] = 201;
    I_breakpoints[5] = 301;
  }
  // Nếu là PM10
  else if (strcmp(type, "PM10") == 0)
  {
    // Nồng độ PM10 (ug/m3)
    C_breakpoints[0] = 0;
    C_breakpoints[1] = 55;
    C_breakpoints[2] = 155;
    C_breakpoints[3] = 255;
    C_breakpoints[4] = 355;
    C_breakpoints[5] = 425;
    // Chỉ số AQI tương ứng
    I_breakpoints[0] = 0;
    I_breakpoints[1] = 51;
    I_breakpoints[2] = 101;
    I_breakpoints[3] = 151;
    I_breakpoints[4] = 201;
    I_breakpoints[5] = 301;
  }
  // Trường hợp không xác định (nên có kiểm tra lỗi tốt hơn)
  else
  {
    return -1; // Trả về lỗi
  }

  // 1. Xử lý trường hợp vượt ngưỡng cao nhất
  if (pmValue >= 500.5 && strcmp(type, "PM2.5") == 0)
    return 500;
  if (pmValue >= 604 && strcmp(type, "PM10") == 0)
    return 500;

  // 2. Tìm kiếm C_Lo, C_Hi, I_Lo, I_Hi
  int I_Lo = 0;
  int I_Hi = 50;
  float C_Lo = 0.0;
  float C_Hi = 12.0;

  for (int i = 0; i < NUM_BREAKPOINTS; i++)
  {
    // Kiểm tra xem giá trị C có nằm trong khoảng [C_Lo, C_Hi) không
    if (pmValue >= C_breakpoints[i])
    {
      C_Lo = C_breakpoints[i];
      I_Lo = I_breakpoints[i];

      // Tìm C_Hi và I_Hi
      if (i < NUM_BREAKPOINTS - 1)
      {
        // Ví dụ: khoảng 0-12.0 (i=0) => C_Hi là 12.1 (i=1), I_Hi là 100
        C_Hi = C_breakpoints[i + 1];
        I_Hi = I_breakpoints[i + 1] - 1; // Lấy ngưỡng trên của khoảng AQI (50, 100, 150,...)
        if (i == 0)
          I_Hi = 50; // Xử lý đặc biệt cho khoảng 0-50
      }
      else
      {
        // Xử lý khoảng cuối cùng (301-500)
        C_Hi = (strcmp(type, "PM2.5") == 0) ? 500.4 : 604;
        I_Hi = 500;
      }
    }
  }

  // Xử lý trường hợp nồng độ bằng C_Lo
  if (pmValue <= C_Lo)
    return I_Lo;

  // 3. Thực hiện công thức nội suy tuyến tính (Linear Interpolation)

  float aqi_float = (float)(I_Hi - I_Lo) / (C_Hi - C_Lo) * (pmValue - C_Lo) + I_Lo;

  // Trả về giá trị AQI làm tròn
  return (int)round(aqi_float);
}

// --------------------------------------------------------
// HÀM MỚI: Hiển thị giá trị và Nhận xét AQI
// --------------------------------------------------------
void displayLevel()
{
  u8g2.clearBuffer();
  u8g2.setFontMode(1);
  u8g2.setFont(u8g2_font_7x13_mf); // Font tiêu chuẩn

  const int CENTER_X = 64;
  const int PM10_START_X = CENTER_X + 2; // Bắt đầu từ 66

  // 1. Tiêu đề
  u8g2.drawStr(10, 10, "PM2.5  AQI  PM10");

  // 2. Vẽ đường phân chia ở giữa
  u8g2.drawVLine(CENTER_X, 16, 64);

  // --- PHẦN BÊN TRÁI: PM2.5 ---
  // 3. Giá trị thực tế
  u8g2.setCursor(5, 45);
  u8g2.setFont(u8g2_font_helvR24_tr); // Font lớn hơn cho số liệu
  u8g2.print(aqi25_history[0]);

  // 4. Nhận xét (Tốt/Vừa/Kém/Hại)
  const char *comment25 = getAQIComment(pm25_val, "PM2.5");
  u8g2.setFont(u8g2_font_unifont_t_vietnamese1);
  u8g2.drawUTF8(5, 62, comment25);

  // --- PHẦN BÊN PHẢI: PM10 ---

  // 5. Giá trị thực tế
  u8g2.setCursor(PM10_START_X + 5, 45);
  u8g2.setFont(u8g2_font_helvR24_tr);
  u8g2.print(aqi10_history[0]);

  // 6. Nhận xét (Tốt/Vừa/Kém/Hại)
  const char *comment10 = getAQIComment(pm10_val, "PM10");
  u8g2.setFont(u8g2_font_unifont_t_vietnamese1);
  u8g2.drawUTF8(PM10_START_X + 5, 62, comment10);

  u8g2.sendBuffer();
}

// --------------------------------------------------------
// HÀM CHÍNH: loop()
// --------------------------------------------------------
void loop()
{

  // WiFi được duy trì liên tục. Sễ passthough nếu thành công rồi
  handleWiFiConnection();

  // Kiểm tra sự kiện phím bấm
  ButtonEvent evt = configBtn.update();

  // Hiển thị Led chỉ thị mặc định theo nút bấm
  if (evt == SHORT_PRESS)
  {
    Serial.println("Bam nhanh: Chuyen Mode");
    g_mode = (g_mode + 1) % MODE_NUM;
  }
  else if (evt == DOUBLE_CLICK)
  {
    Serial.println("Bam dup: Reset thong so hoặc một lệnh gì đó");
  }
  else if (evt == LONG_PRESS_2S)
  {
    Serial.println("Giu 2s: Bat/Tat WiFi");
    wifiEnabled = !wifiEnabled;

    // Cập nhật file cấu hình
    // saveWiFiEnabledStatus(wifiEnabled);
  }

  // Đọc từ cổng Software Serial (sdsSerial)
  if (sdsSerial.available() >= SDS_PACKET_SIZE)
  {
    // Tìm kiếm Header (0xAA)
    if (sdsSerial.peek() == 0xAA)
    {

      // Đọc toàn bộ gói 10 byte vào buffer
      sdsSerial.readBytes(sds_buffer, SDS_PACKET_SIZE);

      // Phân tích và hiển thị lên OLED
      parseSdsData();
      // Lưu mảng lịch sử
      updateHistory(calculateAQI(pm25_val, "PM2.5"), calculateAQI(pm10_val, "PM10"));
      if (g_mode == MODE_INFO)
      {
        showFlashConfig(u8g2);
      }
      else if (g_mode == MODE_IMMEDIATE)
      {
        displayData();
      }
      else if (g_mode == MODE_PLOT)
      {
        plotData();
      }
      else
      {
        displayLevel();
      }
    }
    else
    {
      // Loại bỏ 1 byte bị lệch khỏi Header và tiếp tục tìm kiếm
      sdsSerial.read();
    }
  }
}