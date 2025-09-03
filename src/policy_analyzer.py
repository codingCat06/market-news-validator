import requests
from datetime import datetime, timedelta
import json
import os
import time
import hashlib
from dotenv import load_dotenv

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


class PolicyAnalyzer:
    def __init__(self, cache_dir=None):
        self.cache_dir = cache_dir or os.getenv("CACHE_DIR", "cache")
        self.policy_cache_dir = os.path.join(self.cache_dir, "policy")
        
        # 네이버 뉴스 API 설정
        self.naver_client_id = os.getenv("NAVER_CLIENT_ID")
        self.naver_client_secret = os.getenv("NAVER_CLIENT_SECRET")
        self.naver_search_url = "https://openapi.naver.com/v1/search/news.json"
        
        self.session = requests.Session()
        
        # 네이버 API 헤더 설정
        if self.naver_client_id and self.naver_client_secret:
            self.session.headers.update({
                'X-Naver-Client-Id': self.naver_client_id,
                'X-Naver-Client-Secret': self.naver_client_secret,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
        
        if not os.path.exists(self.policy_cache_dir):
            os.makedirs(self.policy_cache_dir)
        
        # 동적 정책 검색어 생성을 위한 기본 카테고리
        self.policy_categories = {
            "monetary": ["금리", "통화정책", "기준금리", "양적완화"],
            "fiscal": ["재정정책", "국가예산", "추경", "세제개편", "법인세", "소득세"],
            "financial": ["금융정책", "금융규제", "자본시장", "증권거래세", "금융투자업"],
            "real_estate": ["부동산정책", "주택공급", "재건축", "재개발", "분양가상한제"],
            "industrial": ["산업정책", "신성장동력", "그린뉴딜", "디지털뉴딜", "K-뉴딜"],
            "energy": ["에너지정책", "신재생에너지", "원전정책", "탄소중립", "그린텍"],
            "trade": ["통상정책", "FTA", "수출지원", "관세정책", "무역협정"],
            "tech": ["과학기술정책", "R&D투자", "반도체", "AI정책", "데이터정책"],
            "healthcare": ["보건의료정책", "의료기기", "바이오", "제약정책", "원격의료"],
            "construction": ["건설정책", "SOC투자", "도시재생", "스마트시티", "인프라"],
            "automotive": ["자동차정책", "전기차", "수소차", "자율주행", "모빌리티"],
            "finance_sector": ["은행정책", "보험정책", "증권정책", "핀테크", "디지털금융"]
        }
        
        # 정치적 이슈 카테고리
        self.political_categories = {
            "governance": ["국정감사", "정부정책", "대통령", "국무총리"],
            "legislation": ["국회", "법안", "개정안", "국정감사"],
            "election": ["선거", "정치", "여당", "야당", "정치적"],
            "international": ["외교", "통상", "국제관계", "한미", "한중", "한일"]
        }

    def _get_cache_key(self, start_date, end_date, category):
        """캐시 키 생성"""
        content = f"{category}_{start_date}_{end_date}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def _load_cache(self, cache_key):
        """캐시 데이터 로드"""
        cache_file = os.path.join(self.policy_cache_dir, f"{cache_key}.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # 캐시가 24시간 이내인지 확인
                    cache_time = datetime.fromisoformat(data.get('cache_time', '2020-01-01T00:00:00'))
                    if datetime.now() - cache_time < timedelta(hours=24):
                        return data
            except:
                pass
        return None

    def _save_cache(self, cache_key, data):
        """캐시 데이터 저장"""
        cache_file = os.path.join(self.policy_cache_dir, f"{cache_key}.json")
        data['cache_time'] = datetime.now().isoformat()
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"정책 캐시 저장 실패: {e}")

    def _parse_article_date(self, date_str):
        """네이버 API 날짜 형식 파싱"""
        try:
            if "," in date_str and "+" in date_str:
                from email.utils import parsedate_to_datetime
                parsed_date = parsedate_to_datetime(date_str)
                return parsed_date.replace(tzinfo=None)
            else:
                for fmt in ["%Y%m%d", "%Y-%m-%d", "%Y.%m.%d"]:
                    try:
                        return datetime.strptime(date_str, fmt)
                    except:
                        continue
                return datetime.now()
        except Exception as e:
            return datetime.now()

    def _remove_html_tags(self, text):
        """HTML 태그 제거"""
        import re
        clean_text = re.sub('<.*?>', '', text)
        clean_text = clean_text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
        clean_text = clean_text.replace('&quot;', '"').replace('&#39;', "'")
        return clean_text.strip()

    def collect_policy_news(self, start_date, end_date, stock_name=None):
        """정부 정책 관련 뉴스 수집 (주식별 맞춤형)"""
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d")

        # 주식명을 포함한 캐시 키 생성
        cache_suffix = f"_{stock_name}" if stock_name else ""
        cache_key = self._get_cache_key(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"), f"policy{cache_suffix}")
        
        # 캐시 확인
        cached_data = self._load_cache(cache_key)
        if cached_data:
            print(f"📋 정책 뉴스 캐시 데이터 사용 ({stock_name or '일반'})")
            return cached_data.get('articles', [])

        if not self.naver_client_id or not self.naver_client_secret:
            print("⚠️  네이버 API 키가 설정되지 않아 정책 분석을 생략합니다.")
            return []

        # 동적 키워드 생성
        if stock_name:
            keywords = self._generate_dynamic_keywords(stock_name)
            print(f"🏛️ {stock_name} 맞춤형 정책 뉴스 수집 중...")
            print(f"   검색 키워드: {', '.join(keywords[:5])}...")
        else:
            # 기본 정책 키워드 사용
            keywords = []
            for category in ["monetary", "fiscal", "financial"]:
                keywords.extend(self.policy_categories[category][:2])
            print("🏛️ 일반 정책 뉴스 수집 중...")
        
        all_articles = []

        for keyword in keywords[:8]:  # 최대 8개 키워드만 사용
            try:
                search_params = {
                    'query': keyword,
                    'display': 20,  # 키워드당 20개
                    'start': 1,
                    'sort': 'date'
                }

                response = self.session.get(self.naver_search_url, params=search_params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'items' in data:
                        for item in data['items']:
                            try:
                                title = self._remove_html_tags(item['title'])
                                description = self._remove_html_tags(item['description'])
                                pub_date = self._parse_article_date(item['pubDate'])
                                
                                if start_date <= pub_date <= end_date + timedelta(days=1):
                                    article = {
                                        'title': title,
                                        'summary': description[:200] + "..." if len(description) > 200 else description,
                                        'date': pub_date.strftime("%Y-%m-%d %H:%M"),
                                        'link': item['link'],
                                        'keyword': keyword,
                                        'category': 'policy'
                                    }
                                    all_articles.append(article)
                            except:
                                continue
                
                time.sleep(0.5)  # API 요청 간격
                
            except Exception as e:
                print(f"정책 뉴스 수집 오류 ({keyword}): {e}")
                continue

        # 중복 제거
        unique_articles = self._remove_duplicates(all_articles)
        
        # 캐시 저장
        cache_data = {'articles': unique_articles}
        self._save_cache(cache_key, cache_data)
        
        print(f"🏛️ 정책 뉴스 {len(unique_articles)}개 수집 완료")
        return unique_articles

    def collect_political_news(self, start_date, end_date):
        """정치적 이슈 관련 뉴스 수집"""
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d")

        cache_key = self._get_cache_key(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"), "political")
        
        # 캐시 확인
        cached_data = self._load_cache(cache_key)
        if cached_data:
            print("📋 정치 뉴스 캐시 데이터 사용")
            return cached_data.get('articles', [])

        if not self.naver_client_id or not self.naver_client_secret:
            print("⚠️  네이버 API 키가 설정되지 않아 정치 분석을 생략합니다.")
            return []

        # 동적 정치 키워드 생성
        keywords = self._generate_political_keywords()
        print("🗳️ 정치적 이슈 관련 뉴스 수집 중...")
        print(f"   검색 키워드: {', '.join(keywords[:4])}...")
        
        all_articles = []

        for keyword in keywords[:6]:  # 최대 6개 키워드만 사용
            try:
                search_params = {
                    'query': keyword,
                    'display': 15,  # 키워드당 15개
                    'start': 1,
                    'sort': 'date'
                }

                response = self.session.get(self.naver_search_url, params=search_params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'items' in data:
                        for item in data['items']:
                            try:
                                title = self._remove_html_tags(item['title'])
                                description = self._remove_html_tags(item['description'])
                                pub_date = self._parse_article_date(item['pubDate'])
                                
                                if start_date <= pub_date <= end_date + timedelta(days=1):
                                    article = {
                                        'title': title,
                                        'summary': description[:200] + "..." if len(description) > 200 else description,
                                        'date': pub_date.strftime("%Y-%m-%d %H:%M"),
                                        'link': item['link'],
                                        'keyword': keyword,
                                        'category': 'political'
                                    }
                                    all_articles.append(article)
                            except:
                                continue
                
                time.sleep(0.5)  # API 요청 간격
                
            except Exception as e:
                print(f"정치 뉴스 수집 오류 ({keyword}): {e}")
                continue

        # 중복 제거
        unique_articles = self._remove_duplicates(all_articles)
        
        # 캐시 저장
        cache_data = {'articles': unique_articles}
        self._save_cache(cache_key, cache_data)
        
        print(f"🏛️ 정치 뉴스 {len(unique_articles)}개 수집 완료")
        return unique_articles

    def _remove_duplicates(self, articles):
        """중복 제거"""
        seen_titles = set()
        unique_articles = []
        
        for article in articles:
            title_key = article['title'].strip().lower()
            if title_key not in seen_titles:
                seen_titles.add(title_key)
                unique_articles.append(article)
        
        return sorted(unique_articles, key=lambda x: x['date'], reverse=True)

    def analyze_policy_impact(self, stock_name, policy_news, political_news):
        """정책 및 정치적 영향 분석"""
        impact_analysis = {
            'policy_summary': self._summarize_policy_news(policy_news),
            'political_summary': self._summarize_political_news(political_news),
            'market_impact': self._assess_market_impact(policy_news + political_news),
            'sector_relevance': self._assess_sector_relevance(stock_name, policy_news + political_news)
        }
        
        return impact_analysis

    def _summarize_policy_news(self, policy_news):
        """정책 뉴스 요약"""
        if not policy_news:
            return "분석 기간 내 주요 정책 뉴스가 없습니다."
        
        # 키워드별 분류
        keyword_count = {}
        for news in policy_news:
            keyword = news.get('keyword', '기타')
            keyword_count[keyword] = keyword_count.get(keyword, 0) + 1
        
        # 주요 정책 이슈 추출
        top_keywords = sorted(keyword_count.items(), key=lambda x: x[1], reverse=True)[:3]
        
        summary = f"주요 정책 이슈: "
        summary += ", ".join([f"{kw}({cnt}건)" for kw, cnt in top_keywords])
        
        return summary

    def _summarize_political_news(self, political_news):
        """정치 뉴스 요약"""
        if not political_news:
            return "분석 기간 내 주요 정치 이슈가 없습니다."
        
        # 키워드별 분류
        keyword_count = {}
        for news in political_news:
            keyword = news.get('keyword', '기타')
            keyword_count[keyword] = keyword_count.get(keyword, 0) + 1
        
        # 주요 정치 이슈 추출
        top_keywords = sorted(keyword_count.items(), key=lambda x: x[1], reverse=True)[:3]
        
        summary = f"주요 정치 이슈: "
        summary += ", ".join([f"{kw}({cnt}건)" for kw, cnt in top_keywords])
        
        return summary

    def _assess_market_impact(self, all_news):
        """시장 영향도 평가"""
        if not all_news:
            return "중립"
        
        # 간단한 키워드 기반 영향도 평가
        positive_keywords = ['완화', '지원', '혜택', '확대', '투자', '성장', '개선']
        negative_keywords = ['규제', '강화', '제재', '축소', '삭감', '부담', '우려']
        
        positive_score = 0
        negative_score = 0
        
        for news in all_news:
            title_content = (news.get('title', '') + ' ' + news.get('summary', '')).lower()
            
            for keyword in positive_keywords:
                if keyword in title_content:
                    positive_score += 1
            
            for keyword in negative_keywords:
                if keyword in title_content:
                    negative_score += 1
        
        if positive_score > negative_score:
            return "긍정적"
        elif negative_score > positive_score:
            return "부정적"
        else:
            return "중립적"

    def _assess_sector_relevance(self, stock_name, all_news):
        """섹터별 연관성 평가"""
        # 간단한 섹터 키워드 매핑
        sector_keywords = {
            '금융': ['은행', '증권', '보험', '카드', '금융', '대출', '신용'],
            '부동산': ['부동산', '건설', '아파트', '주택', '토지'],
            '기술': ['IT', '소프트웨어', '인공지능', 'AI', '반도체', '전자'],
            '제조': ['제조', '생산', '공장', '자동차', '화학', '철강'],
            '에너지': ['전력', '가스', '석유', '원자력', '신재생'],
            '유통': ['유통', '백화점', '마트', '쇼핑', '소매']
        }
        
        relevance_scores = {}
        
        for sector, keywords in sector_keywords.items():
            score = 0
            for news in all_news:
                title_content = (news.get('title', '') + ' ' + news.get('summary', '')).lower()
                for keyword in keywords:
                    if keyword in title_content:
                        score += 1
            relevance_scores[sector] = score
        
        # 가장 연관성이 높은 섹터
        if relevance_scores:
            top_sector = max(relevance_scores.items(), key=lambda x: x[1])
            if top_sector[1] > 0:
                return f"{top_sector[0]} 섹터와 연관성 높음 ({top_sector[1]}건)"
        
        return "특정 섹터와의 연관성 낮음"
    
    def _generate_dynamic_keywords(self, stock_name):
        """주식별 맞춤형 정책 검색어 동적 생성"""
        base_keywords = []
        
        # 주식명으로 업종 추정 및 관련 정책 키워드 선택
        stock_lower = stock_name.lower()
        
        # 금융업
        if any(keyword in stock_lower for keyword in ['은행', '금융', '보험', '증권', '카드', '캐피탈']):
            base_keywords.extend(self.policy_categories["financial"])
            base_keywords.extend(self.policy_categories["finance_sector"])
            
        # 건설업
        elif any(keyword in stock_lower for keyword in ['건설', '건축', '토목', '주택', '아파트']):
            base_keywords.extend(self.policy_categories["construction"])
            base_keywords.extend(self.policy_categories["real_estate"])
            
        # 전력/에너지
        elif any(keyword in stock_lower for keyword in ['전력', '전기', '에너지', '발전', '원전', '가스']):
            base_keywords.extend(self.policy_categories["energy"])
            
        # 자동차
        elif any(keyword in stock_lower for keyword in ['자동차', '모터', '타이어', '부품']):
            base_keywords.extend(self.policy_categories["automotive"])
            
        # IT/기술
        elif any(keyword in stock_lower for keyword in ['전자', '반도체', '소프트웨어', 'it', '통신', '인터넷']):
            base_keywords.extend(self.policy_categories["tech"])
            
        # 바이오/제약
        elif any(keyword in stock_lower for keyword in ['바이오', '제약', '의료', '병원']):
            base_keywords.extend(self.policy_categories["healthcare"])
            
        # 기본 정책 키워드 추가 (모든 주식에 공통 적용)
        base_keywords.extend(self.policy_categories["monetary"][:2])  # 금리, 통화정책
        base_keywords.extend(self.policy_categories["fiscal"][:2])    # 재정정책, 국가예산
        
        # 중복 제거 및 최대 12개 키워드로 제한
        unique_keywords = list(set(base_keywords))
        return unique_keywords[:12]
    
    def _generate_political_keywords(self):
        """정치적 이슈 검색어 생성"""
        political_keywords = []
        
        # 각 카테고리에서 상위 키워드만 선택
        for category, keywords in self.political_categories.items():
            political_keywords.extend(keywords[:2])  # 카테고리별 상위 2개
            
        return political_keywords[:8]  # 최대 8개로 제한
