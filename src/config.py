import os
from datetime import datetime
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()


class Config:
    # 환경 변수에서 값을 가져오고, 없으면 기본값 사용
    CACHE_DIR = os.getenv("CACHE_DIR") or "cache"
    OUTPUT_DIR = os.getenv("OUTPUT_DIR") or "reports"
    
    # 뉴스 수집 설정
    NEWS_MAX_PAGES = int(os.getenv("NEWS_MAX_PAGES", "10"))
    NEWS_REQUEST_DELAY = float(os.getenv("NEWS_REQUEST_DELAY", "1.0"))
    NEWS_TIMEOUT = int(os.getenv("NEWS_TIMEOUT", "10"))
    
    # ECOS API 설정
    ECOS_API_KEY = os.getenv("ECOS_API_KEY")
    ECOS_BASE_URL = "https://ecos.bok.or.kr/api"
    ECOS_REQUEST_DELAY = float(os.getenv("ECOS_REQUEST_DELAY", "0.5"))
    ECOS_TIMEOUT = int(os.getenv("ECOS_TIMEOUT", "10"))
    
    # 분석 설정
    MIN_SIGNIFICANCE_SCORE = float(os.getenv("MIN_SIGNIFICANCE_SCORE", "0.5"))
    MAX_TOP_NEWS = int(os.getenv("MAX_TOP_NEWS", "3"))
    
    # 로그 설정
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    # 파일 인코딩
    DEFAULT_ENCODING = "utf-8"
    
    @classmethod
    def ensure_directories(cls):
        for directory in [cls.CACHE_DIR or "cache", cls.OUTPUT_DIR or "reports"]:
            if directory and not os.path.exists(directory):
                os.makedirs(directory)
    
    @classmethod
    def get_report_filename(cls, stock_name, date=None):
        if date is None:
            date = datetime.now().strftime("%Y%m%d")
        elif isinstance(date, datetime):
            date = date.strftime("%Y%m%d")
        
        return f"analysis_report_{stock_name}_{date}.txt"


class UserAgent:
    BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    
    @classmethod
    def get_headers(cls):
        return {
            'User-Agent': cls.BROWSER,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }