#include "ApiManager.h"
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFi.h>

ApiManager apiMgr;

ApiManager::ApiManager() {}

String ApiManager::verifyStudent(String scannedData, bool isRfid) {
    if(WiFi.status() != WL_CONNECTED) {
        Serial.println(F("[API] Lỗi: WiFi chưa kết nối!"));
        return "";
    }

    // Google Apps Script yêu cầu HTTPS và mã hoá
    HTTPClient http;
    WiFiClientSecure client;
    client.setInsecure(); // Bỏ qua xác thực chứng chỉ SSL để tránh crash do hết hạn Root CA trên mạch cũ

    // Tạo URL: thêm tham số mã hoá
    // Ví dụ: ?type=rfid&data=123AB hoặc ?type=qr&data=https://...
    String requestUrl = String(MASTER_API_URL) + "?type=" + (isRfid ? "rfid" : "qr") + "&data=" + scannedData;
    
    Serial.print(F("[API] Đang gọi Webhook lên Google Sheet: "));
    Serial.println(requestUrl);

    // Google Apps Script luôn trả về mã HTTP 302 Moved Temporarily, 
    // phải set biến này để mạch chạy theo link redirect thì mới ra mã 200 OK chứa body kết quả.
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    
    if (http.begin(client, requestUrl)) {
        int httpCode = http.GET();
        if (httpCode > 0) {
            if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_MOVED_PERMANENTLY) {
                String payload = http.getString();
                payload.trim(); 
                
                Serial.print(F("[API] Server Google phản hồi: "));
                Serial.println(payload);
                http.end();
                
                // Quy ước: Nếu Script trả về chuỗi "ERROR" (hoặc không gì cả) -> Từ chối!
                // Ngược lại nếu trả về tên "Doan Thi Thu Quyen" -> Hợp lệ!
                if (payload.equalsIgnoreCase("error") || payload.length() == 0 || payload.equalsIgnoreCase("invalid")) {
                    return "";
                }
                return payload;
            } else {
                Serial.printf("[API] Lỗi HTTP Code: %d\n", httpCode);
                http.end();
            }
        } else {
            Serial.printf("[API] Yêu cầu HTTP thất bại, mã lỗi: %s\n", http.errorToString(httpCode).c_str());
            http.end();
        }
    } else {
        Serial.println(F("[API] Không thể thiết lập kết nối (Có thể do sai host hoặc quá tải)"));
    }

    return "";
}
