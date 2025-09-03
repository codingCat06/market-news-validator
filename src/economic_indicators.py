import requests
import pandas as pd
from datetime import datetime, timedelta
import json
import os
import time
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()
try:
    from .config import Config
except ImportError:
    import sys
    import os
    # src 디렉토리를 path에 추가
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    from config import Config


class EconomicIndicatorCollector:
    def __init__(self, cache_dir=None):
        self.cache_dir = cache_dir or os.environ.get("CACHE_DIR", "cache")
        self.ecos_base_url = os.environ.get("ECOS_BASE_URL", "https://ecos.bok.or.kr/api")
        self.api_key = os.environ.get("ECOS_API_KEY")
        
        # 주요 지표 코드 매핑
        self.indicators = {
            'base_rate': {
                'stat_code': '722Y001',
                'item_code': 'BBKA00',
                'name': '한국은행 기준금리'
            },
            'cpi': {
                'stat_code': '901Y009',
                'item_code': '0',
                'name': '소비자물가지수'
            },
            'exchange_rate_usd': {
                'stat_code': '731Y001',
                'item_code': '0000001',
                'name': '원/달러 환율'
            },
            'exchange_rate_jpy': {
                'stat_code': '731Y001', 
                'item_code': '0000002',
                'name': '원/엔 환율'
            },
            'exchange_rate_eur': {
                'stat_code': '731Y001',
                'item_code': '0000003', 
                'name': '원/유로 환율'
            }
        }
        
        if not os.path.exists(self.cache_dir):
            os.makedirs(self.cache_dir)

    def set_api_key(self, api_key):
        self.api_key = api_key

    def _get_cache_filename(self, indicator, start_date, end_date):
        return f"{self.cache_dir}/indicator_{indicator}_{start_date}_{end_date}.json"

    def _load_cached_data(self, indicator, start_date, end_date):
        cache_file = self._get_cache_filename(indicator, start_date, end_date)
        if os.path.exists(cache_file):
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def _save_to_cache(self, indicator, start_date, end_date, data):
        cache_file = self._get_cache_filename(indicator, start_date, end_date)
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _make_ecos_request(self, stat_code, item_code, start_date, end_date, cycle='M'):
        """ECOS API 요청 실행 (날짜 범위 자동 조정)"""
        if not self.api_key:
            print(f"❌ ECOS API 키가 설정되지 않았습니다.")
            raise ValueError("ECOS API 키가 필요합니다. .env 파일에 ECOS_API_KEY를 설정하세요.")
        
        # 날짜 범위 자동 조정 (최대 30일로 제한)
        try:
            start_dt = datetime.strptime(start_date, "%Y%m")
            end_dt = datetime.strptime(end_date, "%Y%m")
            
            # 30개월 이상 차이나면 최근 30개월로 조정
            months_diff = (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month)
            if months_diff > 30:
                print(f"⚠️ 요청 기간이 30개월을 초과하여 최근 30개월로 조정합니다.")
                start_dt = end_dt - timedelta(days=30*30)  # 대략 30개월
                start_date = start_dt.strftime("%Y%m")
        except ValueError:
            pass  # 날짜 형식이 다르면 그대로 진행
        
        url = f"{self.ecos_base_url}/StatisticSearch/{self.api_key}/json/kr/1/1000/{stat_code}/{cycle}/{start_date}/{end_date}/{item_code}"
        
        try:
            print(f"📡 ECOS API 요청: {stat_code} ({start_date} ~ {end_date})")
            response = requests.get(url, timeout=int(os.getenv("ECOS_TIMEOUT", "10")))
            response.raise_for_status()
            
            # 요청 간 딜레이
            time.sleep(0.2)
            
            data = response.json()
            
            # 응답 데이터 검증
            if 'StatisticSearch' not in data:
                print(f"❌ 응답 형식 오류: {data}")
                raise ValueError(f"경제지표 데이터를 찾을 수 없습니다: {stat_code}")
            
            if 'row' not in data['StatisticSearch']:
                print(f"⚠️ 데이터 없음: {stat_code} (기간: {start_date} ~ {end_date})")
                # 기간을 더 짧게 조정해서 재시도
                if months_diff > 12:
                    print(f"🔄 기간을 12개월로 단축하여 재시도...")
                    start_dt = end_dt - timedelta(days=12*30)  # 대략 12개월
                    return self._make_ecos_request(stat_code, item_code, start_dt.strftime("%Y%m"), end_date, cycle)
                else:
                    raise ValueError(f"경제지표 데이터를 찾을 수 없습니다: {stat_code}")
            
            rows = data['StatisticSearch']['row']
            if not rows:
                raise ValueError(f"경제지표 데이터가 비어있습니다: {stat_code}")
            
            print(f"✅ {len(rows)}개 데이터 수집 완료")
            return rows
            
        except requests.exceptions.RequestException as e:
            print(f"❌ API 요청 실패: {e}")
            raise ValueError(f"ECOS API 요청 실패: {e}")
        except Exception as e:
            print(f"❌ 데이터 처리 실패: {e}")
            # 최후의 수단: 최근 3개월 데이터라도 가져오기
            if months_diff > 3:
                print(f"🔄 최근 3개월 데이터로 재시도...")
                start_dt = end_dt - timedelta(days=3*30)  # 대략 3개월
                return self._make_ecos_request(stat_code, item_code, start_dt.strftime("%Y%m"), end_date, cycle)
            else:
                raise ValueError(f"경제지표 수집 중 오류 발생: {e}")

    def collect_indicator(self, indicator_name, start_date, end_date):
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d")

        start_str = start_date.strftime("%Y-%m")
        end_str = end_date.strftime("%Y-%m")
        
        cached_data = self._load_cached_data(indicator_name, start_str, end_str)
        if cached_data:
            print(f"캐시된 데이터를 사용합니다: {indicator_name}")
            return cached_data

        if indicator_name not in self.indicators:
            raise ValueError(f"지원하지 않는 지표입니다: {indicator_name}")

        indicator_info = self.indicators[indicator_name]
        ecos_start = start_date.strftime("%Y%m")
        ecos_end = end_date.strftime("%Y%m")

        raw_data = self._make_ecos_request(
            indicator_info['stat_code'],
            indicator_info['item_code'],
            ecos_start,
            ecos_end
        )

        processed_data = []
        for item in raw_data:
            try:
                date_str = item['TIME']
                if len(date_str) == 6:
                    date = datetime.strptime(date_str, "%Y%m")
                else:
                    date = datetime.strptime(date_str, "%Y%m%d")
                
                processed_data.append({
                    'date': date.strftime("%Y-%m-%d"),
                    'value': float(item['DATA_VALUE']),
                    'indicator': indicator_name,
                    'name': indicator_info['name']
                })
            except (ValueError, KeyError) as e:
                print(f"데이터 처리 오류: {e}")
                continue

        processed_data = sorted(processed_data, key=lambda x: x['date'])
        self._save_to_cache(indicator_name, start_str, end_str, processed_data)
        
        print(f"{indicator_info['name']} 데이터 {len(processed_data)}개 수집 완료")
        return processed_data

    def collect_all_indicators(self, start_date, end_date):
        all_data = {}
        
        print(f"📊 경제지표 수집 시작 (기간: {start_date} ~ {end_date})")
        print(f"🔍 수집 대상 지표: {len(self.indicators)}개")
        
        if not self.api_key or self.api_key == 'your_ecos_api_key_here':
            print("⚠️  ECOS API 키가 설정되지 않았습니다. 모의 데이터를 사용합니다.")
            print("   실제 데이터 사용을 원하시면 .env 파일에 ECOS_API_KEY를 설정하세요.")
        else:
            print(f"✅ ECOS API 키 확인됨: {self.api_key[:10]}...")
            print(f"🌐 한국은행 ECOS API 연결 준비 완료")
        
        indicator_count = 0
        total_indicators = len(self.indicators)
        
        for indicator_name in self.indicators.keys():
            indicator_count += 1
            indicator_info = self.indicators[indicator_name]
            
            try:
                print(f"📈 [{indicator_count}/{total_indicators}] {indicator_info['name']} 수집 중...")
                print(f"   📋 통계표코드: {indicator_info['stat_code']}, 항목코드: {indicator_info['item_code']}")
                
                data = self.collect_indicator(indicator_name, start_date, end_date)
                all_data[indicator_name] = data
                
                if data:
                    latest_value = data[-1]['value'] if data else 0
                    print(f"   ✅ {len(data)}개 데이터 수집 완료 (최신값: {latest_value})")
                    
                    # 처음 몇 개 데이터 샘플 출력
                    if len(data) >= 2:
                        print(f"   📊 데이터 샘플: {data[-2]['date']} = {data[-2]['value']}, {data[-1]['date']} = {data[-1]['value']}")
                else:
                    print(f"   ⚠️ 데이터 없음")
                
                # API 요청 간격
                delay = float(os.environ.get("ECOS_REQUEST_DELAY", "0.5"))
                if indicator_count < total_indicators:
                    print(f"   ⏳ API 요청 간격 대기... ({delay}초)")
                    time.sleep(delay)
                    
            except Exception as e:
                print(f"   ❌ {indicator_name} 수집 실패: {str(e)[:100]}...")
                all_data[indicator_name] = []
        
        total_count = sum(len(data) for data in all_data.values())
        success_count = len([k for k, v in all_data.items() if v])
        
        print(f"\n🎉 경제지표 수집 완료!")
        print(f"📊 수집 결과: {success_count}/{total_indicators}개 지표 성공")
        print(f"📈 총 데이터 포인트: {total_count}개")
        
        if total_count > 0:
            print(f"📋 수집된 지표 목록:")
            for indicator_name, data in all_data.items():
                if data:
                    print(f"   ✅ {self.indicators[indicator_name]['name']}: {len(data)}개")
        
        return all_data

    def get_latest_indicators(self, months_back=12):
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months_back * 30)
        return self.collect_all_indicators(start_date, end_date)

    def analyze_trend(self, indicator_data):
        if len(indicator_data) < 2:
            return "데이터 부족"
        
        values = [item['value'] for item in indicator_data]
        latest = values[-1]
        previous = values[-2]
        
        change_rate = ((latest - previous) / previous) * 100
        
        if change_rate > 1:
            return f"상승 추세 (+{change_rate:.2f}%)"
        elif change_rate < -1:
            return f"하락 추세 ({change_rate:.2f}%)"
        else:
            return f"안정적 ({change_rate:.2f}%)"