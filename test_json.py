#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
간단한 JSON 테스트 스크립트
"""

import sys
import json
import os
from datetime import datetime

# 환경 변수 설정
os.environ['USE_SIMPLE_LOGGING'] = '1'

def main():
    try:
        # 명령행 인수 확인
        if len(sys.argv) != 4:
            result = {
                "success": False,
                "error": "Usage: python test_json.py <stock_name> <start_date> <end_date>",
                "data": None
            }
        else:
            stock_name = sys.argv[1]
            start_date = sys.argv[2]
            end_date = sys.argv[3]
            
            # 간단한 성공 응답
            result = {
                "success": True,
                "error": None,
                "data": {
                    "stock_name": stock_name,
                    "start_date": start_date,
                    "end_date": end_date,
                    "analysis": {
                        "stock_name": stock_name,
                        "start_date": start_date,
                        "end_date": end_date,
                        "report": f"테스트 분석 완료: {stock_name} ({start_date} ~ {end_date})",
                        "news_data": [],
                        "analyzed_news": [],
                        "significant_news": [],
                        "indicators_data": {},
                        "message": "JSON 테스트 성공"
                    },
                    "timestamp": datetime.now().isoformat()
                }
            }
        
        # JSON 출력
        json_output = json.dumps(result, ensure_ascii=False, indent=2)
        sys.stdout.flush()
        print(json_output)
        sys.stdout.flush()
        
    except Exception as e:
        result = {
            "success": False,
            "error": f"Test script error: {str(e)}",
            "data": None
        }
        json_output = json.dumps(result, ensure_ascii=False, indent=2)
        sys.stdout.flush()
        print(json_output)
        sys.stdout.flush()
        sys.exit(1)

if __name__ == "__main__":
    main()
