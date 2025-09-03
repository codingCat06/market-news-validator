import requests
from bs4 import BeautifulSoup
import pandas as pd
from datetime import datetime, timedelta
import json
import os
from urllib.parse import urljoin, quote
import time
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

try:
    from .config import Config, UserAgent
    from .web_utils import safe_print
except ImportError:
    import sys
    import os
    # src 디렉토리를 path에 추가
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    from config import Config, UserAgent
    from web_utils import safe_print


class NewsCollector:
    def __init__(self, cache_dir=None):
        self.cache_dir = cache_dir or os.environ.get("CACHE_DIR", "cache")
        
        # 네이버 뉴스 API 설정
        self.naver_client_id = os.environ.get("NAVER_CLIENT_ID")
        self.naver_client_secret = os.environ.get("NAVER_CLIENT_SECRET")
        self.naver_search_url = "https://openapi.naver.com/v1/search/news.json"
        
        self.session = requests.Session()
        
        # 네이버 API 헤더 설정
        if self.naver_client_id and self.naver_client_secret:
            self.session.headers.update({
                'X-Naver-Client-Id': self.naver_client_id,
                'X-Naver-Client-Secret': self.naver_client_secret,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
        else:
            print("네이버 API 키가 설정되지 않았습니다. .env 파일에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 설정해주세요.")
        
        if not os.path.exists(self.cache_dir):
            os.makedirs(self.cache_dir)

    def _get_cache_filename(self, stock_name, start_date, end_date):
        return f"{self.cache_dir}/news_{stock_name}_{start_date}_{end_date}.json"

    def _load_cached_data(self, stock_name, start_date, end_date):
        cache_file = self._get_cache_filename(stock_name, start_date, end_date)
        if os.path.exists(cache_file):
            with open(cache_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def _save_to_cache(self, stock_name, start_date, end_date, data):
        cache_file = self._get_cache_filename(stock_name, start_date, end_date)
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _parse_article_date(self, date_str):
        """네이버 API 날짜 형식 파싱"""
        try:
            # 네이버 API 날짜 형식: "Mon, 01 Jan 2025 12:00:00 +0900"
            if "," in date_str and "+" in date_str:
                # RFC 2822 형식
                from email.utils import parsedate_to_datetime
                parsed_date = parsedate_to_datetime(date_str)
                # timezone-naive로 변환
                return parsed_date.replace(tzinfo=None)
            else:
                # 기본 형식들
                for fmt in ["%Y%m%d", "%Y-%m-%d", "%Y.%m.%d"]:
                    try:
                        return datetime.strptime(date_str, fmt)
                    except:
                        continue
                return datetime.now()
        except Exception as e:
            print(f"날짜 파싱 오류: {e}")
            return datetime.now()

    def _extract_article_summary(self, content):
        if len(content) <= 150:
            return content
        
        sentences = content.split('.')
        summary = ""
        for sentence in sentences:
            if len(summary + sentence) <= 150:
                summary += sentence + "."
            else:
                break
        return summary.strip()

    def collect_news(self, stock_name, start_date, end_date):
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d")

        print(f"🔍 {stock_name} 뉴스 수집 시작 ({start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')})")
        safe_print(f"🔍 {stock_name} 뉴스 수집 시작 ({start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')})")
        
        cached_data = self._load_cached_data(stock_name, start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
        if cached_data:
            safe_print(f"📦 캐시된 데이터 발견: {len(cached_data)}개 뉴스 재사용")
            safe_print(f"✅ 캐시 데이터 로드 완료 - API 호출 생략")
            return cached_data

        if not self.naver_client_id or not self.naver_client_secret:
            safe_print("❌ 네이버 API 키가 설정되지 않았습니다. .env 파일에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 설정해주세요.")
            safe_print("🔗 네이버 개발자 센터에서 API 키를 발급받으세요: https://developers.naver.com/")
            return []

        safe_print("🌐 네이버 뉴스 API 연결 시작")
        articles = []
        
        try:
            # 단일 검색어로 뉴스 수집 (이전 방식으로 복원)
            max_pages = int(os.environ.get('NEWS_MAX_PAGES', '3'))
            display_per_page = 100
            max_articles = 50  # 최대 수집 개수 제한
            
            safe_print(f"📊 수집 설정: 최대 {max_pages}페이지, 페이지당 {display_per_page}개, 최대 {max_articles}개")
            
            for page in range(max_pages):
                if len(articles) >= max_articles:
                    print(f"🛑 최대 수집 개수({max_articles}개)에 도달하여 수집을 중단합니다.")
                    break
                    
                start_index = page * display_per_page + 1
                
                # 네이버 뉴스 검색 API 파라미터 (기본 검색어로 복원)
                search_params = {
                    'query': f'{stock_name} 주식',
                    'display': display_per_page,
                    'start': start_index,
                    'sort': 'date'  # 날짜순 정렬
                }
                
                print(f"� 페이지 {page + 1}/{max_pages} 요청 중... (검색어: '{stock_name} 주식', 시작 인덱스: {start_index})")
                
                try:
                    response = self.session.get(self.naver_search_url, params=search_params, timeout=10)
                    print(f"📡 API 응답 수신: HTTP {response.status_code}")
                except requests.exceptions.Timeout:
                    print(f"⏰ 페이지 {page + 1} API 요청 타임아웃 (10초)")
                    continue
                except Exception as e:
                    print(f"❌ 페이지 {page + 1} API 요청 실패: {str(e)}")
                    continue
                
                if response.status_code != 200:
                    print(f"⚠️ API 오류: HTTP {response.status_code} - 페이지 {page + 1} 건너뛰기")
                    continue
                
                try:
                    data = response.json()
                    print(f"📋 JSON 데이터 파싱 완료")
                except json.JSONDecodeError:
                    print(f"❌ 페이지 {page + 1} JSON 파싱 실패")
                    continue
                
                if 'items' not in data or not data['items']:
                    print(f"📭 페이지 {page + 1}에 더 이상 뉴스가 없습니다.")
                    break
                
                page_items = data['items']
                print(f"📄 페이지 {page + 1}에서 {len(page_items)}개 뉴스 발견")
                
                date_filtered_out = 0
                parsing_errors = 0
                page_articles_count = 0
                
                print(f"🔍 페이지 {page + 1} 뉴스 분석 시작...")
                
                for i, item in enumerate(page_items):
                    if len(articles) >= max_articles:
                        print(f"🛑 최대 수집량 도달 (현재: {len(articles)}개)")
                        break
                        
                    try:
                        # HTML 태그 제거
                        title = self._remove_html_tags(item['title'])
                        description = self._remove_html_tags(item['description'])
                        
                        # 날짜 파싱
                        pub_date = self._parse_article_date(item['pubDate'])
                        
                        # 사용자가 지정한 날짜 범위 내의 기사만 수집
                        if start_date <= pub_date <= end_date + timedelta(days=1):
                            article = {
                                'title': title,
                                'summary': description[:150] + "..." if len(description) > 150 else description,
                                'date': pub_date.strftime("%Y-%m-%d %H:%M"),
                                'link': item['link'],
                                'content': description
                            }
                            articles.append(article)
                            page_articles_count += 1
                            
                            # 처음 몇 개는 상세히 로그 출력
                            if page_articles_count <= 3:
                                print(f"✅ 뉴스 {len(articles)}번째 수집: {title[:50]}...")
                                print(f"   📅 발행일: {pub_date.strftime('%Y-%m-%d %H:%M')}")
                        else:
                            date_filtered_out += 1
                            if date_filtered_out <= 3:  # 처음 몇 개만 로그
                                print(f"📅 날짜 범위 외: {title[:40]}... ({pub_date.strftime('%Y-%m-%d')})")
                    
                    except Exception as e:
                        parsing_errors += 1
                        if parsing_errors <= 3:  # 처음 몇 개 오류만 로그
                            print(f"❌ 파싱 오류: {str(e)[:50]}...")
                        continue
                
                print(f"📊 페이지 {page + 1} 완료: 수집 {page_articles_count}개, 날짜 필터 {date_filtered_out}개, 오류 {parsing_errors}개")
                print(f"📈 현재 총 수집량: {len(articles)}개")
                
                # 조기 종료 조건
                if page_articles_count == 0 and page > 0:
                    print(f"⏹️ 페이지 {page + 1}에서 유효한 뉴스가 없어 수집을 중단합니다.")
                    break
                    
                # API 요청 간격 조절
                if page < max_pages - 1:
                    delay = float(os.environ.get('NEWS_REQUEST_DELAY', '1.0'))
                    print(f"⏳ API 요청 간격 대기 중... ({delay}초)")
                    time.sleep(delay)
            
        except Exception as e:
            print(f"❌ 네이버 API 요청 실패: {e}")
            return []

        print(f"🔄 중복 제거 시작... (현재: {len(articles)}개)")
        articles = self._remove_duplicates(articles)
        print(f"✅ 중복 제거 완료 (남은 뉴스: {len(articles)}개)")
        
        # 중요도 순으로 정렬 및 상위 50개 선택 (이미 수집 시 제한했지만 추가 보장)
        print(f"📊 뉴스 우선순위 정렬 및 최종 선별 중...")
        articles = self._prioritize_and_limit_articles(articles, max_articles=50)
        print(f"🎯 최종 선별 완료: {len(articles)}개")
        
        print(f"💾 캐시 저장 중...")
        self._save_to_cache(stock_name, start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"), articles)
        print(f"✅ 캐시 저장 완료")
        
        print(f"\n🎉 {stock_name} 뉴스 수집 완료!")
        print(f"📊 최종 수집량: {len(articles)}개")
        print(f"📅 수집 기간: {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}")
        
        if articles:
            print(f"📰 수집된 뉴스 샘플:")
            for i, article in enumerate(articles[:3]):
                print(f"   {i+1}. {article['title'][:60]}...")
        
        return articles

    def _remove_html_tags(self, text):
        """HTML 태그 제거"""
        import re
        # HTML 태그 제거
        clean_text = re.sub('<.*?>', '', text)
        # HTML 엔티티 디코딩
        clean_text = clean_text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
        clean_text = clean_text.replace('&quot;', '"').replace('&#39;', "'")
        return clean_text.strip()

    def _remove_duplicates(self, articles):
        """더 정교한 중복 제거 (완전히 같은 제목과 매우 유사한 제목 모두 처리)"""
        import re
        
        unique_articles = []
        seen_titles = set()
        
        for article in articles:
            title = article['title'].strip()
            title_normalized = re.sub(r'[^\w\s]', '', title.lower())  # 특수문자 제거 후 소문자 변환
            title_words = set(title_normalized.split())
            
            # 기존 제목들과 유사도 체크
            is_duplicate = False
            for seen_title in seen_titles:
                seen_words = set(seen_title.split())
                
                # 두 제목이 80% 이상 겹치면 중복으로 간주
                if len(title_words) > 0 and len(seen_words) > 0:
                    intersection = title_words.intersection(seen_words)
                    similarity = len(intersection) / max(len(title_words), len(seen_words))
                    
                    if similarity > 0.8:  # 80% 이상 유사하면 중복
                        is_duplicate = True
                        break
            
            if not is_duplicate:
                seen_titles.add(title_normalized)
                unique_articles.append(article)
            else:
                print(f"🔄 유사 중복 제거: {title[:40]}...")
        
        print(f"📝 중복 제거 결과: {len(articles)}개 → {len(unique_articles)}개")
        return sorted(unique_articles, key=lambda x: x['date'], reverse=True)

    def _prioritize_and_limit_articles(self, articles, max_articles=50):
        """뉴스를 중요도 순으로 정렬하고 상위 N개만 선택"""
        
        # 중요도 점수 계산
        for article in articles:
            score = self._calculate_importance_score(article)
            article['importance_score'] = score
        
        # 중요도 순으로 정렬 (높은 순)
        sorted_articles = sorted(articles, key=lambda x: x['importance_score'], reverse=True)
        
        # 상위 max_articles개만 선택
        limited_articles = sorted_articles[:max_articles]
        
        # importance_score 필드 제거 (저장 시 불필요)
        for article in limited_articles:
            article.pop('importance_score', None)
        
        if len(articles) > max_articles:
            print(f"🔝 중요도 순 정렬: {len(articles)}개 → 상위 {max_articles}개 선택")
        
        return limited_articles
    
    def _calculate_importance_score(self, article):
        """뉴스 중요도 점수 계산"""
        title = article.get('title', '').lower()
        content = article.get('content', '').lower()
        
        score = 0
        
        # 1. 중요 키워드 가중치
        important_keywords = {
            '실적': 10, '매출': 8, '영업이익': 8, '순이익': 8,
            '수주': 9, '계약': 8, '협약': 7, '투자': 8,
            '합병': 10, '인수': 9, 'M&A': 10,
            '신제품': 7, '출시': 6, '개발': 6,
            '공시': 9, '발표': 6, '보고서': 5,
            '증자': 8, '배당': 7, '분할': 8,
            '소송': 7, '분쟁': 6, '규제': 6,
            '특허': 6, '인증': 5, '승인': 6
        }
        
        for keyword, weight in important_keywords.items():
            if keyword in title:
                score += weight * 2  # 제목에 있으면 2배 가중치
            elif keyword in content:
                score += weight
        
        # 2. 날짜 점수 (최신 뉴스 우대)
        try:
            article_date = datetime.strptime(article['date'], "%Y-%m-%d %H:%M")
            days_ago = (datetime.now() - article_date).days
            date_score = max(0, 10 - days_ago)  # 최근일수록 높은 점수
            score += date_score
        except:
            pass
        
        # 3. 제목 길이 점수 (너무 짧거나 길지 않은 적절한 길이)
        title_length = len(article.get('title', ''))
        if 20 <= title_length <= 60:
            score += 3
        elif 10 <= title_length <= 80:
            score += 1
        
        # 4. 검색어 매치도 (특정 검색어로 찾은 경우 가중치)
        search_query = article.get('search_query', '')
        if '주식' in search_query:
            score += 2
        elif '투자' in search_query:
            score += 3
        
        return score

    def get_recent_news(self, stock_name, days=7):
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        return self.collect_news(stock_name, start_date, end_date)