#ifndef API_MANAGER_H
#define API_MANAGER_H

#include <Arduino.h>

// Bạn cần thay thế URL này bằng đường link Web App (Google Apps Script) thật của bạn.
// Lưu ý: phải giữ lại /exec ở cuối thay vì /edit
#define MASTER_API_URL "https://script.google.com/macros/s/AKfycbzWF7wlngKlPK0G-t-TKuhNBFC8M-smhzQ0rm5XgRYshKE4VzOIVrXh8queL87xv9IKRQ/exec"

class ApiManager {
public:
    ApiManager();
    
    /**
     * @brief Gọi API Google Sheet để xác thực
     * @param scannedData Chuỗi URL quét được hoặc mã RFID
     * @param isRfid Biến bool đánh dấu xem đây là thẻ RFID hay mã QR (để Google phân loại dò tìm)
     * @return String rỗng ("") nếu bị Từ chối/Lỗi. Trả về tên hoặc mssv nếu Hợp lệ.
     */
    String verifyStudent(String scannedData, bool isRfid);
};

extern ApiManager apiMgr;

#endif
