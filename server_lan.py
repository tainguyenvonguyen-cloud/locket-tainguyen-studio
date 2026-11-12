import http.server
import socket

PORT = 8080

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

if __name__ == "__main__":
    ip = get_local_ip()
    print("=" * 60)
    print("  LOCKET AI & PHOTOBOOTH STUDIO - CHAY TREN DIEN THOAI")
    print("=" * 60)
    print(f"1. Dam bao Dien thoai va May tinh bat cung 1 mang Wi-Fi.")
    print(f"2. Mo Safari/Chrome tren dien thoai va truy cap dia chi:")
    print(f"\n   👉  http://{ip}:{PORT}\n")
    print("Luu y: Neu muon mo Camera truc tiep tren iPhone (Safari yeu cau HTTPS),")
    print("hay keo thu muc 'locket-ai-studio' tha vao https://app.netlify.com/drop")
    print("=" * 60)

    server = http.server.HTTPServer(("0.0.0.0", PORT), http.server.SimpleHTTPRequestHandler)
    server.serve_forever()

