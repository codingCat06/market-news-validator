import json
import os
from datetime import datetime
import hashlib


def save_json(data, filepath, encoding='utf-8'):
    with open(filepath, 'w', encoding=encoding) as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_json(filepath, encoding='utf-8'):
    if not os.path.exists(filepath):
        return None
    
    try:
        with open(filepath, 'r', encoding=encoding) as f:
            return json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"JSON 파일 읽기 오류: {e}")
        return None


def generate_cache_key(*args):
    key_string = "_".join(str(arg) for arg in args)
    return hashlib.md5(key_string.encode('utf-8')).hexdigest()


def format_date(date_input, output_format="%Y-%m-%d"):
    if isinstance(date_input, str):
        # 다양한 날짜 형식 파싱 시도
        formats_to_try = [
            "%Y-%m-%d",
            "%Y.%m.%d",
            "%Y/%m/%d",
            "%Y-%m-%d %H:%M",
            "%Y.%m.%d %H:%M",
            "%Y%m%d"
        ]
        
        for fmt in formats_to_try:
            try:
                date_obj = datetime.strptime(date_input, fmt)
                return date_obj.strftime(output_format)
            except ValueError:
                continue
        
        raise ValueError(f"날짜 형식을 인식할 수 없습니다: {date_input}")
    
    elif isinstance(date_input, datetime):
        return date_input.strftime(output_format)
    
    else:
        raise TypeError("날짜는 문자열 또는 datetime 객체여야 합니다")


def clean_text(text):
    if not isinstance(text, str):
        return ""
    
    # 불필요한 공백 및 특수문자 제거
    text = text.strip()
    text = " ".join(text.split())  # 연속된 공백을 하나로
    
    # HTML 태그 간단 제거 (정확한 파싱이 아닌 기본적 제거)
    import re
    text = re.sub(r'<[^>]+>', '', text)
    
    return text


def truncate_text(text, max_length=100, suffix="..."):
    if len(text) <= max_length:
        return text
    
    return text[:max_length-len(suffix)].strip() + suffix


def ensure_directory(directory_path):
    if not os.path.exists(directory_path):
        os.makedirs(directory_path)
        return True
    return False


def calculate_percentage_change(current, previous):
    if previous == 0:
        return 0.0
    
    return ((current - previous) / previous) * 100


def validate_date_range(start_date, end_date):
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, "%Y-%m-%d")
    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, "%Y-%m-%d")
    
    if start_date > end_date:
        raise ValueError("시작일이 종료일보다 늦습니다")
    
    if end_date > datetime.now():
        raise ValueError("종료일이 현재 날짜보다 늦습니다")
    
    return start_date, end_date


def print_progress_bar(current, total, bar_length=50, prefix="Progress"):
    if total == 0:
        return
        
    progress = current / total
    filled_length = int(bar_length * progress)
    
    bar = "█" * filled_length + "-" * (bar_length - filled_length)
    percentage = progress * 100
    
    print(f"\r{prefix}: |{bar}| {percentage:.1f}% ({current}/{total})", end="", flush=True)
    
    if current == total:
        print()  # 완료 시 새 줄