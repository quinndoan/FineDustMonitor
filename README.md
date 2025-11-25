# THIẾT BỊ QUAN TRĂC BỤI MIN

Thiết bị hiển thị mức bụi min PM2.5 và PM10 theo 3 cách:

1. Hiển thị trên màn hình
2. Gửi qua serial (cổng usb) về máy tính gới giá trị dạng text
3. Gửi về máy chủ MQTT tại <mqtt.toolhub.app>

Mặt khác, một đèn led chỉ thị _(led built-in D4 trên board Wemos D1 R2 mini)_ sáng mỗi khi bấm __nút chuyển trạng thái__ hiển thị.

1. số liệu
2. đồ thị 64 giá trị
3. mức ô nhiễm theo AQI

![số liệu](./displayData.jpg) ![đồ thị](./plotData.jpg) ![AQI](./displayLevel.jpg)

## Bảng tra chất lượng không khí theo bụi

Đơn vị đo: Nồng độ bụi (µm/m3)

|Chất lượng không khí chung|PM10 (Bụi thô)|PM2.5 (Bụi mịn)|PM1.0 (Bụi siêu siêu mịn)|
|--|--|--|--|
|Hại |255 trở lên |56 trở lên |56 trở lên |
|Kém|155 - 254|36 - 55|36 - 55|
|Vừa phải|55 - 154|13 - 35|13 - 35|
|Tốt|54 trở xuống|12 trở xuống|12 trở xuống|

Tham khảo: <https://www.studocu.vn/vn/document/truong-dai-hoc-thu-dau-mot/quan-ly-moi-truong/2022-world-air-quality-report-vi/111575198>

## Danh sách vật tư

1. [Board điều khiên trung tâm Wemos D1 R2 mini](https://github.com/neittien0110/MCU/blob/master/ESP8266/Wemosd1r2mini.md)
2. [Module cảm biến bụi SDS011](https://github.com/neittien0110/linhkiendientu/?tab=readme-ov-file#b%E1%BB%A5i)
3. [Màn hình Oled 1"3 để hiển thị mức bụi trực tiếp](https://github.com/neittien0110/linhkiendientu/blob/master/Screens.md)
4. Nút bấm để chuyển trạng thái hiển thị

## Kết nối

![alt text](wemosd1r2mini.png)
![alt text](oled_i2c_13.png)

|STT|Module 1|Module2|
|--|--|--|
|1|Wemos D1 R2 / Pin 5V | SDS011 / Pin 5V |
|2|Wemos D1 R2 / Pin G | SDS011 / Pin G |
|3|Wemos D1 R2 / Pin RX (D5=GPIO3) | SDS011 / Pin TX |
|4|Wemos D1 R2 / Pin TX (D6=GPIO1) | SDS011 / Pin R X |
|--|--|--|
|1|Wemos D1 R2 / Pin 3v3 | Oled / Pin VCC |
|2|Wemos D1 R2 / Pin G | Oled / Pin GND |
|3|Wemos D1 R2 / Pin D1=SCL (GPIO5) | Oled / Pin SCL |
|4|Wemos D1 R2 / Pin D2=SDA (GPIO4) | Oled / Pin SDA |
|--|--|--|
|1|Wemos D1 R2 / Pin D7 (GPIO13) | Nút bấm / Pin 1 |
|2|Wemos D1 R2 / Pin G | Nút bấm / Pin 2 |
|--|--|--|
|0|Wemos D1 R2 / USB | Nguồn cấp 5V |
|0|Wemos D1 R2 / USB | Cổng serial 115200 |
