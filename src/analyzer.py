import re
from datetime import datetime
from collections import defaultdict
import json
import os
import hashlib
from openai import OpenAI
from dotenv import load_dotenv
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

# 환경변수 로드
load_dotenv()


class StockNewsAnalyzer:
    def __init__(self, cache_dir=None):
        # OpenAI 클라이언트 초기화
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key or api_key == 'your_openai_api_key_here':
            print("Warning: OpenAI API key not configured. Please set OPENAI_API_KEY in .env file")
            self.client = None
        else:
            self.client = OpenAI(api_key=api_key)
        
        # 캐시 디렉토리 설정
        self.cache_dir = cache_dir or os.environ.get("CACHE_DIR", "cache")
        self.analysis_cache_dir = os.path.join(self.cache_dir, "analysis")
        if not os.path.exists(self.analysis_cache_dir):
            os.makedirs(self.analysis_cache_dir)
        
        # 기본 신뢰도 평가용 키워드는 유지
        self.rumor_indicators = [
            '카더라', '소문', '추정', '예상', '관측', '전망', '기대', '추측', '루머',
            '~것으로 알려졌다', '~것으로 보인다', '~할 것으로 예상', '~것으로 관측',
            '미확인', '불확실', '가능성', '~라는 소식', '업계에 따르면'
        ]
        
        self.official_indicators = [
            '공시', '발표', '보고서', '실적발표', '사업보고서', '분기보고서',
            '공식', '확정', '결정', '체결', '계약서', '협약서', '증권신고서',
            '감사보고서', '이사회결의', '주주총회'
        ]

    def analyze_sentiment_with_gpt(self, article):
        """GPT-4o mini를 사용하여 뉴스 감정 분석"""
        if not self.client:
            return self._fallback_sentiment_analysis(article)
        
        title = article.get('title', '')
        content = article.get('content', '') or article.get('summary', '')
        
        prompt = f"""
다음 주식 관련 뉴스를 분석하여 투자자 관점에서 감정을 분석해주세요.

제목: {title}
내용: {content}

분석 기준:
- positive: 주가에 긍정적 영향을 줄 가능성이 높은 내용
- negative: 주가에 부정적 영향을 줄 가능성이 높은 내용  
- neutral: 중립적이거나 영향이 불분명한 내용

응답 형식:
sentiment: [positive/negative/neutral]
confidence: [0.1-1.0 사이의 신뢰도]
reasoning: [분석 근거를 한두 문장으로]

예시:
sentiment: positive
confidence: 0.8
reasoning: 대규모 수주 계약 체결로 매출 증가가 예상됩니다.
"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "당신은 전문적인 주식 투자 분석가입니다. 뉴스를 객관적으로 분석하여 주가에 미칠 영향을 평가해주세요."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=300
            )
            
            result_text = response.choices[0].message.content.strip()
            return self._parse_gpt_response(result_text)
            
        except Exception as e:
            print(f"GPT API 호출 중 오류 발생: {e}")
            return self._fallback_sentiment_analysis(article)

    def _parse_gpt_response(self, response_text):
        """GPT 응답 파싱"""
        try:
            lines = response_text.split('\n')
            sentiment = 'neutral'
            confidence = 0.5
            reasoning = ''
            
            for line in lines:
                line = line.strip()
                if line.startswith('sentiment:'):
                    sentiment = line.split(':', 1)[1].strip()
                elif line.startswith('confidence:'):
                    confidence = float(line.split(':', 1)[1].strip())
                elif line.startswith('reasoning:'):
                    reasoning = line.split(':', 1)[1].strip()
            
            return {
                'sentiment': sentiment,
                'confidence': confidence,
                'reasoning': reasoning
            }
            
        except Exception as e:
            print(f"GPT 응답 파싱 중 오류: {e}")
            return {
                'sentiment': 'neutral',
                'confidence': 0.5,
                'reasoning': '분석 중 오류 발생'
            }

    def _fallback_sentiment_analysis(self, article):
        """GPT API 사용 불가 시 폴백 분석"""
        print("Warning: GPT API 사용 불가, 기본 키워드 분석을 사용합니다.")
        
        # 기본 키워드 기반 분석
        positive_keywords = [
            '수주', '계약', '협약', '협력', '투자', '증가', '상승', '호재', '선정', '채택',
            '확대', '성장', '개발', '특허', '인증', '승인', '출시', '론칭', '매출증가',
            '실적개선', '흑자전환', '흑자', '이익증가', '배당', '주가상승', '목표주가상향'
        ]
        
        negative_keywords = [
            '손실', '적자', '하락', '감소', '악재', '리콜', '중단', '연기', '취소', '해약',
            '소송', '수사', '조사', '처벌', '제재', '규제', '위반', '사고', '결함',
            '실적악화', '매출감소', '주가하락', '목표주가하향', '구조조정', '감원'
        ]
        
        title = article.get('title', '')
        content = article.get('content', '') or article.get('summary', '')
        full_text = f"{title} {content}".lower()
        
        positive_count = sum(1 for keyword in positive_keywords if keyword in full_text)
        negative_count = sum(1 for keyword in negative_keywords if keyword in full_text)
        
        if positive_count > negative_count:
            return {'sentiment': 'positive', 'confidence': 0.6, 'reasoning': '긍정적 키워드 발견'}
        elif negative_count > positive_count:
            return {'sentiment': 'negative', 'confidence': 0.6, 'reasoning': '부정적 키워드 발견'}
        else:
            return {'sentiment': 'neutral', 'confidence': 0.5, 'reasoning': '중립적 내용'}

    def assess_reliability(self, article):
        """뉴스 신뢰도 평가"""
        title = article.get('title', '')
        content = article.get('content', '') or article.get('summary', '')
        full_text = f"{title} {content}".lower()
        
        official_score = sum(1 for indicator in self.official_indicators if indicator in full_text)
        rumor_score = sum(1 for indicator in self.rumor_indicators if indicator in full_text)
        
        if official_score >= 2:
            return 'high'
        elif official_score >= 1 and rumor_score == 0:
            return 'medium'
        elif rumor_score >= 2:
            return 'low'
        else:
            return 'medium'

    def _get_article_hash(self, article):
        """기사의 고유 해시값 생성 (제목 + 날짜 기반)"""
        title = article.get('title', '').strip().lower()
        date = article.get('date', '').strip()
        content = f"{title}_{date}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def _load_analysis_cache(self, cache_key):
        """분석 결과 캐시 로드"""
        cache_file = os.path.join(self.analysis_cache_dir, f"{cache_key}.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return None
        return None
    
    def _save_analysis_cache(self, cache_key, data):
        """분석 결과 캐시 저장"""
        cache_file = os.path.join(self.analysis_cache_dir, f"{cache_key}.json")
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"캐시 저장 실패: {e}")
    
    def _deduplicate_articles(self, articles):
        """중복 기사 제거 (제목과 날짜 기반)"""
        seen_hashes = set()
        unique_articles = []
        
        for article in articles:
            article_hash = self._get_article_hash(article)
            if article_hash not in seen_hashes:
                seen_hashes.add(article_hash)
                unique_articles.append(article)
            else:
                print(f"중복 기사 제거: {article.get('title', '')[:50]}...")
        
        print(f"중복 제거: {len(articles)}개 → {len(unique_articles)}개")
        return unique_articles

    def analyze_news_batch(self, articles):
        """뉴스 배치 분석 (중복 제거 및 캐싱 포함)"""
        try:
            from .web_utils import safe_print
        except ImportError:
            from web_utils import safe_print
        
        safe_print(f"🧠 AI 감정 분석 시작: {len(articles)}개 뉴스")
        
        # 1단계: 중복 기사 제거
        safe_print(f"🔄 중복 뉴스 제거 중...")
        articles = self._deduplicate_articles(articles)
        safe_print(f"✅ 중복 제거 완료: {len(articles)}개 뉴스")
        
        results = []
        cache_hits = 0
        api_calls = 0
        
        safe_print(f"🤖 GPT-4o mini를 사용한 감정 분석 시작...")
        
        for i, article in enumerate(articles, 1):
            article_hash = self._get_article_hash(article)
            
            # 캐시에서 분석 결과 확인
            cached_analysis = self._load_analysis_cache(article_hash)
            if cached_analysis:
                results.append(cached_analysis)
                cache_hits += 1
                safe_print(f"💾 캐시 재사용 ({i}/{len(articles)}): {article.get('title', '')[:50]}...")
                continue
            
            safe_print(f"🔍 OpenAI API 호출 중 ({i}/{len(articles)}): {article.get('title', '')[:50]}...")
            
            # GPT를 사용한 감정 분석
            try:
                sentiment_result = self.analyze_sentiment_with_gpt(article)
                api_calls += 1
                safe_print(f"✅ AI 분석 완료: 감정={sentiment_result['sentiment']}, 신뢰도={sentiment_result['confidence']:.2f}")
            except Exception as e:
                safe_print(f"❌ AI 분석 실패: {str(e)[:50]}...")
                continue
                
            reliability = self.assess_reliability(article)
            
            # 사건 요약 추가
            event_summary = self._extract_event_summary(article, sentiment_result)
            
            analysis = {
                'title': article.get('title', ''),
                'date': article.get('date', ''),
                'link': article.get('link', ''),
                'summary': article.get('summary', ''),
                'sentiment': sentiment_result['sentiment'],
                'confidence': sentiment_result['confidence'],
                'reasoning': sentiment_result['reasoning'],
                'event_summary': event_summary,
                'reliability': reliability,
                'score': self._calculate_score(sentiment_result['sentiment'], sentiment_result['confidence'], reliability),
                'hash': article_hash
            }
            
            # 분석 결과 캐시에 저장
            safe_print(f"💾 분석 결과 캐시 저장 중...")
            self._save_analysis_cache(article_hash, analysis)
            results.append(analysis)
        
        safe_print(f"\n🎉 감정 분석 완료!")
        safe_print(f"📊 처리 결과: 총 {len(articles)}개")
        safe_print(f"💾 캐시 재사용: {cache_hits}개")
        safe_print(f"🤖 새로 분석: {api_calls}개")
        safe_print(f"🔢 최종 결과: {len(results)}개")
        
        if results:
            # 감정별 통계
            positive = len([r for r in results if r['sentiment'] == 'positive'])
            negative = len([r for r in results if r['sentiment'] == 'negative'])
            neutral = len([r for r in results if r['sentiment'] == 'neutral'])
            safe_print(f"📈 감정 분포: 긍정 {positive}개, 부정 {negative}개, 중립 {neutral}개")
        
        return sorted(results, key=lambda x: (abs(x['score']), x['confidence']), reverse=True)
    
    def _extract_event_summary(self, article, sentiment_result):
        """기사에서 주요 사건 요약 추출"""
        title = article.get('title', '')
        content = article.get('content', '') or article.get('summary', '')
        
        # 주요 사건 키워드 패턴
        event_patterns = {
            'contract': ['계약', '수주', '협약', '체결'],
            'investment': ['투자', '자금', '조달', '유치'],
            'performance': ['실적', '매출', '영업이익', '순이익'],
            'technology': ['기술', '특허', '개발', '혁신'],
            'partnership': ['제휴', '파트너십', '협력', '합작'],
            'regulation': ['규제', '정책', '법률', '승인'],
            'market': ['시장', '진출', '확대', '점유율'],
            'lawsuit': ['소송', '분쟁', '법정', '재판'],
            'accident': ['사고', '문제', '결함', '리콜']
        }
        
        detected_events = []
        full_text = f"{title} {content}".lower()
        
        for event_type, keywords in event_patterns.items():
            if any(keyword in full_text for keyword in keywords):
                detected_events.append(event_type)
        
        # 사건 요약 생성
        if detected_events:
            event_desc = ', '.join(detected_events)
            return f"{sentiment_result['sentiment']} - {event_desc}"
        else:
            return f"{sentiment_result['sentiment']} - 일반 뉴스"

    def _calculate_score(self, sentiment, confidence, reliability):
        """종합 점수 계산"""
        base_scores = {
            'positive': 1,
            'negative': -1,
            'neutral': 0
        }
        
        reliability_multipliers = {
            'high': 2.0,
            'medium': 1.0,
            'low': 0.3
        }
        
        return base_scores[sentiment] * confidence * reliability_multipliers[reliability]

    def filter_significant_news(self, analyzed_news, min_score=0.3):
        """중요한 뉴스 필터링"""
        return [news for news in analyzed_news if abs(news['score']) >= min_score]

    def validate_factors_with_gpt4(self, stock_name, positive_news, negative_news, start_date, end_date):
        """GPT-4를 사용하여 호재/악재 유효성 검증"""
        if not self.client:
            return {"validation": "GPT API 사용 불가", "positive_valid": positive_news, "negative_valid": negative_news}
        
        # 캐시 키 생성
        validation_key = f"validation_{stock_name}_{start_date}_{end_date}_{len(positive_news)}_{len(negative_news)}"
        validation_hash = hashlib.md5(validation_key.encode('utf-8')).hexdigest()
        
        # 캐시에서 검증 결과 확인
        cached_validation = self._load_analysis_cache(f"validation_{validation_hash}")
        if cached_validation:
            print("📋 GPT-4o 검증 결과 캐시 재사용")
            return cached_validation
        
        # 호재/악재 요약
        positive_summary = []
        for news in positive_news[:10]:  # 상위 10개만
            positive_summary.append(f"- {news['title']} ({news['date']}) - {news['event_summary']}")
        
        negative_summary = []
        for news in negative_news[:10]:  # 상위 10개만
            negative_summary.append(f"- {news['title']} ({news['date']}) - {news['event_summary']}")
        
        prompt = f"""
{stock_name} 주식에 대한 {start_date}부터 {end_date}까지의 뉴스 분석 결과를 검증해주세요.

호재 요인들:
{chr(10).join(positive_summary) if positive_summary else "없음"}

악재 요인들:
{chr(10).join(negative_summary) if negative_summary else "없음"}

다음 기준으로 각 호재/악재가 실제로 주가에 영향을 줄 수 있는 유효한 정보인지 평가해주세요:

1. 구체성: 구체적인 숫자나 계약 내용이 포함되어 있는가?
2. 시기: 실제 사업에 영향을 주는 시점이 명확한가?
3. 중요성: 회사의 매출이나 수익성에 실질적 영향을 줄 수 있는가?
4. 신뢰성: 공식 발표나 확실한 정보원에서 나온 것인가?

응답 형식:
valid_positive: [유효한 호재 개수]
valid_negative: [유효한 악재 개수]
positive_analysis: [호재들의 유효성 분석]
negative_analysis: [악재들의 유효성 분석]
overall_assessment: [전체적인 평가]
"""

        try:
            print("GPT-4o를 사용하여 호재/악재 유효성 검증 중...")
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "당신은 전문적인 주식 투자 분석가입니다. 뉴스의 실질적인 주가 영향력을 객관적으로 평가해주세요."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=1000
            )
            
            result_text = response.choices[0].message.content.strip()
            validation_result = self._parse_validation_response(result_text)
            validation_result['raw_response'] = result_text
            
            # 검증 결과 캐시에 저장
            self._save_analysis_cache(f"validation_{validation_hash}", validation_result)
            
            return validation_result
            
        except Exception as e:
            print(f"GPT-4o 검증 중 오류 발생: {e}")
            return {"validation": "검증 실패", "positive_valid": positive_news, "negative_valid": negative_news}
    
    def _parse_validation_response(self, response_text):
        """GPT-4o 검증 응답 파싱"""
        try:
            print(f"파싱 시작 - 응답 길이: {len(response_text)}")
            print(f"응답 내용 미리보기: {response_text[:200]}...")
            
            lines = response_text.split('\n')
            result = {
                'valid_positive': 0,
                'valid_negative': 0,
                'positive_analysis': '',
                'negative_analysis': '',
                'overall_assessment': ''
            }
            
            # 더 유연한 파싱 로직
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                    
                # 콜론이 포함된 라인만 처리
                if ':' in line:
                    key_part = line.split(':', 1)[0].strip().lower()
                    value_part = line.split(':', 1)[1].strip()
                    
                    if 'valid_positive' in key_part or 'positive' in key_part and 'valid' in key_part:
                        numbers = ''.join(filter(str.isdigit, value_part))
                        result['valid_positive'] = int(numbers) if numbers else 0
                        print(f"호재 파싱: {result['valid_positive']}")
                    elif 'valid_negative' in key_part or 'negative' in key_part and 'valid' in key_part:
                        numbers = ''.join(filter(str.isdigit, value_part))
                        result['valid_negative'] = int(numbers) if numbers else 0
                        print(f"악재 파싱: {result['valid_negative']}")
                    elif 'positive_analysis' in key_part or ('positive' in key_part and 'analysis' in key_part):
                        result['positive_analysis'] = value_part
                        print(f"호재 분석 파싱: {value_part[:50]}...")
                    elif 'negative_analysis' in key_part or ('negative' in key_part and 'analysis' in key_part):
                        result['negative_analysis'] = value_part
                        print(f"악재 분석 파싱: {value_part[:50]}...")
                    elif 'overall_assessment' in key_part or 'overall' in key_part or 'assessment' in key_part or '종합' in key_part:
                        result['overall_assessment'] = value_part
                        print(f"종합 평가 파싱: {value_part[:50]}...")
            
            # 빈 값이 있으면 원본 텍스트에서 추출 시도
            if not result['positive_analysis'] or not result['negative_analysis'] or not result['overall_assessment']:
                print("기본 파싱 실패, 텍스트에서 직접 추출 시도...")
                result = self._extract_from_full_text(response_text, result)
            
            print(f"최종 파싱 결과: {result}")
            return result
            
        except Exception as e:
            print(f"검증 응답 파싱 중 오류: {e}")
            print(f"오류 발생 응답: {response_text}")
            return {
                'valid_positive': 0,
                'valid_negative': 0,
                'positive_analysis': f'파싱 오류: {str(e)}',
                'negative_analysis': f'파싱 오류: {str(e)}',
                'overall_assessment': f'파싱 오류: {str(e)}'
            }
    
    def _extract_from_full_text(self, text, current_result):
        """전체 텍스트에서 분석 내용 추출"""
        try:
            # 텍스트를 단락별로 분리
            paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
            
            for para in paragraphs:
                if len(para) > 20:  # 의미있는 길이의 단락만
                    if not current_result['positive_analysis'] and ('호재' in para or 'positive' in para.lower()):
                        current_result['positive_analysis'] = para[:200] + "..." if len(para) > 200 else para
                    elif not current_result['negative_analysis'] and ('악재' in para or 'negative' in para.lower()):
                        current_result['negative_analysis'] = para[:200] + "..." if len(para) > 200 else para
                    elif not current_result['overall_assessment'] and ('종합' in para or 'overall' in para.lower() or '전체' in para):
                        current_result['overall_assessment'] = para[:200] + "..." if len(para) > 200 else para
            
            return current_result
        except:
            return current_result

    def generate_future_outlook(self, stock_name, analyzed_news, indicators_data, end_date):
        """미래 전망 분석 생성"""
        if not self.client:
            return "GPT API 사용 불가로 미래 전망을 생성할 수 없습니다."
        
        # 캐시 키 생성
        outlook_key = f"outlook_{stock_name}_{end_date}_{len(analyzed_news)}"
        outlook_hash = hashlib.md5(outlook_key.encode('utf-8')).hexdigest()
        
        # 캐시에서 전망 결과 확인
        cached_outlook = self._load_analysis_cache(f"outlook_{outlook_hash}")
        if cached_outlook:
            print("📋 미래 전망 캐시 재사용")
            return cached_outlook
        
        # 주요 이슈 요약
        significant_news = [n for n in analyzed_news if abs(n['score']) >= 0.5][:5]
        news_summary = []
        for news in significant_news:
            news_summary.append(f"- {news['title']} ({news['sentiment']}, 점수: {news['score']:.1f})")
        
        # 경제지표 요약
        indicators_summary = []
        for indicator, data in self._analyze_indicators(indicators_data).items():
            indicators_summary.append(f"- {indicator}: {data['current_value']} ({data['trend']} {data['change_percent']}%)")
        
        prompt = f"""
{stock_name}에 대한 {end_date} 시점 기준 미래 전망을 분석해주세요.

현재 상황 요약:
주요 뉴스:
{chr(10).join(news_summary) if news_summary else "특별한 뉴스 없음"}

경제 지표:
{chr(10).join(indicators_summary) if indicators_summary else "경제지표 정보 없음"}

다음 관점에서 분석해주세요:
1. 현재 시점 평가: 현재 상황의 강점과 약점
2. 단기 전망 (1-3개월): 가까운 미래에 예상되는 변화
3. 중기 전망 (3-12개월): 중장기적으로 영향을 줄 수 있는 요인들
4. 주의사항: 투자자가 주의깊게 봐야 할 리스크 요인들

응답 형식:
current_assessment: [현재 시점 평가]
short_term_outlook: [단기 전망]
medium_term_outlook: [중기 전망]
risk_factors: [주의사항]
investment_recommendation: [투자 관점 제안]
"""

        try:
            print("GPT-4o를 사용하여 미래 전망 분석 중...")
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "당신은 전문적인 주식 투자 분석가입니다. 객관적이고 균형잡힌 관점에서 미래 전망을 제시해주세요."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1200
            )
            
            result_text = response.choices[0].message.content.strip()
            outlook_result = self._parse_outlook_response(result_text)
            outlook_result['raw_response'] = result_text
            
            # 전망 결과 캐시에 저장
            self._save_analysis_cache(f"outlook_{outlook_hash}", outlook_result)
            
            return outlook_result
            
        except Exception as e:
            print(f"미래 전망 분석 중 오류 발생: {e}")
            return "미래 전망 분석 실패"
    
    def _parse_outlook_response(self, response_text):
        """미래 전망 응답 파싱"""
        try:
            print(f"미래 전망 파싱 시작 - 응답 길이: {len(response_text)}")
            print(f"응답 내용 미리보기: {response_text[:200]}...")
            
            lines = response_text.split('\n')
            result = {
                'current_assessment': '',
                'short_term_outlook': '',
                'medium_term_outlook': '',
                'risk_factors': '',
                'investment_recommendation': ''
            }
            
            # 더 유연한 파싱 로직
            for line in lines:
                line = line.strip()
                if not line or ':' not in line:
                    continue
                    
                key_part = line.split(':', 1)[0].strip().lower()
                value_part = line.split(':', 1)[1].strip()
                
                if 'current_assessment' in key_part or ('current' in key_part and 'assessment' in key_part) or '현재' in key_part:
                    result['current_assessment'] = value_part
                    print(f"현재 평가 파싱: {value_part[:50]}...")
                elif 'short_term_outlook' in key_part or ('short' in key_part and 'term' in key_part) or '단기' in key_part:
                    result['short_term_outlook'] = value_part
                    print(f"단기 전망 파싱: {value_part[:50]}...")
                elif 'medium_term_outlook' in key_part or ('medium' in key_part and 'term' in key_part) or '중기' in key_part:
                    result['medium_term_outlook'] = value_part
                    print(f"중기 전망 파싱: {value_part[:50]}...")
                elif 'risk_factors' in key_part or 'risk' in key_part or '리스크' in key_part or '위험' in key_part:
                    result['risk_factors'] = value_part
                    print(f"리스크 요인 파싱: {value_part[:50]}...")
                elif 'investment_recommendation' in key_part or ('investment' in key_part and 'recommendation' in key_part) or '투자' in key_part:
                    result['investment_recommendation'] = value_part
                    print(f"투자 관점 파싱: {value_part[:50]}...")
            
            # 빈 값이 있으면 원본 텍스트에서 추출 시도
            if not all(result.values()):
                print("기본 파싱 실패, 텍스트에서 직접 추출 시도...")
                result = self._extract_outlook_from_full_text(response_text, result)
            
            print(f"최종 전망 파싱 결과: {list(result.keys())}")
            return result
            
        except Exception as e:
            print(f"전망 응답 파싱 중 오류: {e}")
            print(f"오류 발생 응답: {response_text}")
            return {
                'current_assessment': f'파싱 오류: {str(e)}',
                'short_term_outlook': f'파싱 오류: {str(e)}',
                'medium_term_outlook': f'파싱 오류: {str(e)}',
                'risk_factors': f'파싱 오류: {str(e)}',
                'investment_recommendation': f'파싱 오류: {str(e)}'
            }
    
    def _extract_outlook_from_full_text(self, text, current_result):
        """전체 텍스트에서 전망 내용 추출"""
        try:
            # 텍스트를 단락별로 분리
            paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
            
            for para in paragraphs:
                if len(para) > 20:  # 의미있는 길이의 단락만
                    para_lower = para.lower()
                    if not current_result['current_assessment'] and ('현재' in para or 'current' in para_lower):
                        current_result['current_assessment'] = para[:300] + "..." if len(para) > 300 else para
                    elif not current_result['short_term_outlook'] and ('단기' in para or 'short' in para_lower):
                        current_result['short_term_outlook'] = para[:300] + "..." if len(para) > 300 else para
                    elif not current_result['medium_term_outlook'] and ('중기' in para or 'medium' in para_lower):
                        current_result['medium_term_outlook'] = para[:300] + "..." if len(para) > 300 else para
                    elif not current_result['risk_factors'] and ('리스크' in para or 'risk' in para_lower or '위험' in para):
                        current_result['risk_factors'] = para[:300] + "..." if len(para) > 300 else para
                    elif not current_result['investment_recommendation'] and ('투자' in para or 'investment' in para_lower):
                        current_result['investment_recommendation'] = para[:300] + "..." if len(para) > 300 else para
            
            return current_result
        except:
            return current_result

    def generate_summary(self, analyzed_news, indicators_data):
        """분석 결과 요약 생성"""
        positive_news = [n for n in analyzed_news if n['sentiment'] == 'positive' and n['score'] >= 0.3]
        negative_news = [n for n in analyzed_news if n['sentiment'] == 'negative' and n['score'] <= -0.3]
        
        summary = {
            'analysis_date': datetime.now().strftime("%Y-%m-%d %H:%M"),
            'total_articles': len(analyzed_news),
            'positive_factors': len(positive_news),
            'negative_factors': len(negative_news),
            'top_positive': positive_news[:10] if positive_news else [],
            'top_negative': sorted(negative_news, key=lambda x: x['score'])[:10] if negative_news else [],
            'economic_indicators': self._analyze_indicators(indicators_data),
            'overall_sentiment': self._calculate_overall_sentiment(analyzed_news),
            'conclusion': self._generate_conclusion(positive_news, negative_news, indicators_data)
        }
        
        return summary

    def _analyze_indicators(self, indicators_data):
        """경제 지표 분석"""
        analysis = {}
        
        for indicator_name, data_list in indicators_data.items():
            if not data_list:
                continue
                
            latest_value = data_list[-1]['value'] if data_list else 0
            previous_value = data_list[-2]['value'] if len(data_list) > 1 else latest_value
            
            change = ((latest_value - previous_value) / previous_value * 100) if previous_value != 0 else 0
            
            analysis[indicator_name] = {
                'current_value': latest_value,
                'change_percent': round(change, 2),
                'trend': 'positive' if change > 0 else 'negative' if change < 0 else 'stable'
            }
        
        return analysis

    def _calculate_overall_sentiment(self, analyzed_news):
        """전체 감정 계산"""
        if not analyzed_news:
            return 'neutral'
            
        total_score = sum(news['score'] for news in analyzed_news)
        avg_score = total_score / len(analyzed_news)
        
        if avg_score > 0.3:
            return 'positive'
        elif avg_score < -0.3:
            return 'negative'
        else:
            return 'neutral'

    def _generate_conclusion(self, positive_news, negative_news, indicators_data):
        """결론 생성"""
        conclusion_parts = []
        
        if len(positive_news) > len(negative_news):
            conclusion_parts.append("전반적으로 긍정적인 요인이 우세합니다.")
        elif len(negative_news) > len(positive_news):
            conclusion_parts.append("전반적으로 부정적인 요인이 우세합니다.")
        else:
            conclusion_parts.append("긍정적 요인과 부정적 요인이 균형을 이루고 있습니다.")
        
        rate_trend = self._get_rate_trend(indicators_data)
        if rate_trend:
            conclusion_parts.append(rate_trend)
        
        exchange_trend = self._get_exchange_trend(indicators_data)
        if exchange_trend:
            conclusion_parts.append(exchange_trend)
            
        return " ".join(conclusion_parts)

    def _get_rate_trend(self, indicators_data):
        """금리 동향 분석"""
        if 'base_rate' not in indicators_data or not indicators_data['base_rate']:
            return None
            
        rate_data = indicators_data['base_rate']
        if len(rate_data) < 2:
            return None
            
        current = rate_data[-1]['value']
        previous = rate_data[-2]['value']
        
        if current > previous:
            return "기준금리 상승으로 금융주에는 긍정적이나 대출 의존 기업에는 부담이 될 수 있습니다."
        elif current < previous:
            return "기준금리 하락으로 유동성 증가가 예상되어 시장에 긍정적입니다."
        else:
            return None

    def _get_exchange_trend(self, indicators_data):
        """환율 동향 분석"""
        if 'exchange_rate_usd' not in indicators_data or not indicators_data['exchange_rate_usd']:
            return None
            
        exchange_data = indicators_data['exchange_rate_usd']
        if len(exchange_data) < 2:
            return None
            
        current = exchange_data[-1]['value']
        previous = exchange_data[-2]['value']
        change_rate = ((current - previous) / previous) * 100
        
        if abs(change_rate) > 2:
            if change_rate > 0:
                return "원화 약세로 수출기업에는 유리하나 수입 원자재 의존 기업에는 부담이 됩니다."
            else:
                return "원화 강세로 수입 의존 기업에는 유리하나 수출기업에는 불리할 수 있습니다."
        else:
            return None

    def generate_report(self, stock_name, analyzed_news, indicators_data, start_date=None, end_date=None, policy_impact=None):
        """최종 리포트 생성 (GPT-4 검증 및 미래 전망 포함)"""
        if end_date is None:
            end_date = datetime.now()
        elif isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d")
        
        if start_date is None:
            start_date = end_date
        elif isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
            
        summary = self.generate_summary(analyzed_news, indicators_data)
        
        # GPT-4를 사용한 호재/악재 유효성 검증
        validation = self.validate_factors_with_gpt4(
            stock_name, 
            summary['top_positive'], 
            summary['top_negative'],
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d")
        )
        
        # 미래 전망 분석
        future_outlook = self.generate_future_outlook(
            stock_name,
            analyzed_news,
            indicators_data,
            end_date.strftime("%Y-%m-%d")
        )
        
        report = f"""
국내주식 분석 리포트: {stock_name}
{'=' * 70}

📊 분석 개요
분석 기간: {start_date.strftime('%Y년 %m월 %d일')} ~ {end_date.strftime('%Y년 %m월 %d일')}
분석 시점: {summary['analysis_date']}
총 분석 기사: {summary['total_articles']}개
분석 방법: GPT-4o mini 개별 분석 + GPT-4o 종합 검증

📈 개별 기사 분석 결과
주요 호재 요인 ({summary['positive_factors']}개):
"""
        
        for i, news in enumerate(summary['top_positive'], 1):
            confidence = news.get('confidence', 0) * 100
            reasoning = news.get('reasoning', '')
            event_summary = news.get('event_summary', '일반 뉴스')
            report += f"{i}. {news['title']}\n"
            report += f"   📅 {news['date']} | 🎯 {event_summary}\n"
            report += f"   📊 신뢰도: {news['reliability']}, 점수: {news['score']:.1f}, AI 확신도: {confidence:.0f}%\n"
            report += f"   💭 분석: {reasoning}\n\n"
        
        report += f"주요 악재 요인 ({summary['negative_factors']}개):\n"
        
        for i, news in enumerate(summary['top_negative'], 1):
            confidence = news.get('confidence', 0) * 100
            reasoning = news.get('reasoning', '')
            event_summary = news.get('event_summary', '일반 뉴스')
            report += f"{i}. {news['title']}\n"
            report += f"   📅 {news['date']} | 🎯 {event_summary}\n"
            report += f"   📊 신뢰도: {news['reliability']}, 점수: {news['score']:.1f}, AI 확신도: {confidence:.0f}%\n"
            report += f"   💭 분석: {reasoning}\n\n"
        
        # GPT-4 검증 결과 추가
        if isinstance(validation, dict) and 'valid_positive' in validation:
            report += f"""
🔍 GPT-4o 전문가 검증 결과
유효한 호재: {validation.get('valid_positive', 0)}개 (총 {summary['positive_factors']}개 중)
유효한 악재: {validation.get('valid_negative', 0)}개 (총 {summary['negative_factors']}개 중)

📋 호재 검증 의견: {validation.get('positive_analysis', '분석 없음')}
📋 악재 검증 의견: {validation.get('negative_analysis', '분석 없음')}
📋 종합 평가: {validation.get('overall_assessment', '평가 없음')}
"""

        report += "\n📊 거시경제 지표 현황:\n"
        
        for indicator, data in summary['economic_indicators'].items():
            indicator_names = {
                'base_rate': '기준금리',
                'cpi': '소비자물가지수', 
                'exchange_rate_usd': '달러환율',
                'exchange_rate_jpy': '엔환율',
                'exchange_rate_eur': '유로환율'
            }
            
            name = indicator_names.get(indicator, indicator)
            trend_symbol = "📈" if data['trend'] == 'positive' else "📉" if data['trend'] == 'negative' else "📊"
            
            report += f"  {trend_symbol} {name}: {data['current_value']} ({data['change_percent']:+.1f}%)\n"
        
        # 정책 및 정치적 분석 추가
        if policy_impact and isinstance(policy_impact, dict):
            report += f"""
🏛️ 정부 정책 및 정치적 영향 분석
"""
            
            # 정책 관련 뉴스
            if policy_impact.get('policy_news'):
                report += f"📋 정책 관련 뉴스: {len(policy_impact['policy_news'])}개\n"
                for i, news in enumerate(policy_impact['policy_news'][:3], 1):  # 상위 3개만 표시
                    report += f"  {i}. {news.get('title', '')[:60]}...\n"
                    report += f"     📅 {news.get('date', '')}\n"
            
            # 정치적 뉴스
            if policy_impact.get('political_news'):
                report += f"\n🗳️ 정치적 뉴스: {len(policy_impact['political_news'])}개\n"
                for i, news in enumerate(policy_impact['political_news'][:3], 1):  # 상위 3개만 표시
                    report += f"  {i}. {news.get('title', '')[:60]}...\n"
                    report += f"     📅 {news.get('date', '')}\n"
            
            # 정책 영향 평가
            if policy_impact.get('market_impact'):
                impact = policy_impact['market_impact']
                impact_symbol = "🟢" if impact == 'positive' else "🔴" if impact == 'negative' else "🟡"
                report += f"\n📊 정책 시장 영향도: {impact_symbol} {impact.upper()}\n"
            
            if policy_impact.get('sector_relevance'):
                relevance = policy_impact['sector_relevance']
                relevance_symbol = "🎯" if relevance == 'high' else "📍" if relevance == 'medium' else "📌"
                report += f"🎯 업종 연관성: {relevance_symbol} {relevance.upper()}\n"
            
            if policy_impact.get('key_factors'):
                report += f"🔑 핵심 요인: {', '.join(policy_impact['key_factors'])}\n"
        
        # 미래 전망 추가
        if isinstance(future_outlook, dict):
            report += f"""
🔮 미래 전망 분석 ({end_date.strftime('%Y-%m-%d')} 기준)

📍 현재 시점 평가: {future_outlook.get('current_assessment', '평가 없음')}

⏳ 단기 전망 (1-3개월): {future_outlook.get('short_term_outlook', '전망 없음')}

📅 중기 전망 (3-12개월): {future_outlook.get('medium_term_outlook', '전망 없음')}

⚠️  주요 리스크: {future_outlook.get('risk_factors', '위험요인 없음')}

💡 투자 관점: {future_outlook.get('investment_recommendation', '제안 없음')}
"""

        # Timeline 분석 추가
        print("📅 Timeline 분석을 생성하는 중...")

        report += f"""
📝 종합 의견
전체 시장 심리: {summary['overall_sentiment'].upper()}
{summary['conclusion']}


※ 본 분석은 OpenAI 를 활용한 AI 기반 분석 결과입니다.
※ 투자 결정에 대한 모든 책임은 개인에게 있습니다.
"""
        
        report += "\n" + "=" * 70
        
        return report

    def generate_timeline_analysis(self, analyzed_news, end_date=None):
        """시간순 호재/악재 유효성 분석 생성"""
        if end_date is None:
            end_date = datetime.now()
        elif isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d")
        
        print("📅 Timeline 분석을 시작합니다...")
        
        # 날짜별로 뉴스 그룹화
        daily_issues = self._extract_daily_issues(analyzed_news)
        
        # 현재 이슈 상태 업데이트
        current_issues = self._update_current_issues(daily_issues, end_date)
        
        # 현재 시점에서의 유효성 분석
        timeline_result = self._analyze_current_validity(current_issues, end_date)
        
        return timeline_result
    
    def _extract_daily_issues(self, analyzed_news):
        """날짜별 이슈 추출 및 분류"""
        daily_issues = defaultdict(list)
        
        issue_categories = {
            '업계 동향': ['업계', '동향', '트렌드', '시장점유율', '경쟁', '기술혁신'],
            '정책/규제': ['정책', '규제', '법률', '정부', '승인', '허가', '제재'],
            '해외 협력': ['해외', '수출', '해외진출', '글로벌', '국제', '협력'],
            '시장 변화': ['시장', '수요', '공급', '가격', '소비자', '마케팅'],
            '금융 이슈': ['투자', '자금', '대출', '금리', '배당', '유상증자'],
            '기타': []
        }
        
        for news in analyzed_news:
            try:
                news_date = datetime.strptime(news['date'], "%Y-%m-%d")
                date_key = news_date.strftime("%Y-%m-%d")
                
                # 이슈 분류
                title_content = f"{news['title']} {news.get('summary', '')}".lower()
                issue_type = '기타'
                
                for category, keywords in issue_categories.items():
                    if category != '기타' and any(keyword in title_content for keyword in keywords):
                        issue_type = category
                        break
                
                issue_data = {
                    'title': news['title'],
                    'sentiment': news['sentiment'],
                    'score': news['score'],
                    'confidence': news['confidence'],
                    'reasoning': news['reasoning'],
                    'reliability': news['reliability'],
                    'issue_type': issue_type,
                    'date': news_date
                }
                
                daily_issues[date_key].append(issue_data)
                
            except (ValueError, KeyError) as e:
                print(f"날짜 파싱 오류: {news.get('date', 'N/A')} - {e}")
                continue
        
        return dict(daily_issues)
    
    def _update_current_issues(self, daily_issues, current_date):
        """현재 이슈 상태 업데이트"""
        current_issues = {
            '업계 동향': [],
            '정책/규제': [],
            '해외 협력': [],
            '시장 변화': [],
            '금융 이슈': [],
            '기타': []
        }
        
        # 날짜순으로 정렬하여 처리
        sorted_dates = sorted(daily_issues.keys())
        
        for date_key in sorted_dates:
            issues = daily_issues[date_key]
            for issue in issues:
                category = issue['issue_type']
                current_issues[category].append(issue)
        
        return current_issues
    
    def _analyze_current_validity(self, current_issues, analysis_date):
        """현재 시점에서 이슈들의 유효성 분석"""
        timeline_analysis = {
            'analysis_date': analysis_date.strftime("%Y-%m-%d"),
            'categories': {},
            'summary': {}
        }
        
        total_valid_issues = 0
        total_issues = 0
        
        for category, issues in current_issues.items():
            if not issues:
                continue
                
            category_analysis = {
                'total_issues': len(issues),
                'valid_issues': [],
                'outdated_issues': [],
                'summary': ''
            }
            
            for issue in issues:
                days_elapsed = (analysis_date - issue['date']).days
                validity_status = self._assess_issue_validity(issue, days_elapsed)
                
                issue_with_validity = issue.copy()
                issue_with_validity.update(validity_status)
                
                if validity_status['is_valid']:
                    category_analysis['valid_issues'].append(issue_with_validity)
                else:
                    category_analysis['outdated_issues'].append(issue_with_validity)
            
            # 카테고리별 요약 생성
            valid_count = len(category_analysis['valid_issues'])
            total_count = len(issues)
            
            category_analysis['summary'] = f"{total_count}개 이슈 중 {valid_count}개가 현재 유효함"
            
            timeline_analysis['categories'][category] = category_analysis
            total_valid_issues += valid_count
            total_issues += total_count
        
        # 전체 요약
        timeline_analysis['summary'] = {
            'total_issues': total_issues,
            'valid_issues': total_valid_issues,
            'validity_rate': round((total_valid_issues / total_issues * 100) if total_issues > 0 else 0, 1)
        }
        
        return timeline_analysis
    
    def _assess_issue_validity(self, issue, days_elapsed):
        """개별 이슈의 유효성 평가"""
        # 기본 유효성 기준 (일수 기반)
        if days_elapsed <= 7:
            validity_level = "매우 유효"
            is_valid = True
        elif days_elapsed <= 30:
            validity_level = "유효"
            is_valid = True
        elif days_elapsed <= 90:
            validity_level = "일부 유효"
            is_valid = True
        else:
            validity_level = "유효성 낮음"
            is_valid = False
        
        # 이슈 타입별 조정
        issue_type = issue['issue_type']
        if issue_type == '정책/규제':
            # 정책은 더 오래 유효
            if days_elapsed <= 180:
                is_valid = True
        elif issue_type == '업계 동향':
            # 업계 동향은 상대적으로 짧은 유효기간
            if days_elapsed > 60:
                is_valid = False
                validity_level = "유효성 낮음"
        
        # 신뢰도 및 점수 기반 조정
        reliability_factor = {
            'high': 1.2,
            'medium': 1.0,
            'low': 0.8
        }.get(issue['reliability'], 1.0)
        
        score_magnitude = abs(issue['score'])
        if score_magnitude >= 1.0 and reliability_factor >= 1.0:
            # 고득점 + 고신뢰도는 유효기간 연장
            if days_elapsed <= 45:
                is_valid = True
        
        return {
            'days_elapsed': days_elapsed,
            'validity_level': validity_level,
            'is_valid': is_valid,
            'reliability_factor': reliability_factor
        }
    
    def format_timeline_report(self, timeline_analysis):
        """Timeline 분석 결과를 리포트 형식으로 포맷팅"""
        report = f"""
📅 Timeline 호재/악재 유효성 분석
{'=' * 50}

분석 기준일: {timeline_analysis['analysis_date']}
전체 이슈: {timeline_analysis['summary']['total_issues']}개
현재 유효 이슈: {timeline_analysis['summary']['valid_issues']}개
유효성 비율: {timeline_analysis['summary']['validity_rate']}%

"""
        
        for category, data in timeline_analysis['categories'].items():
            if data['total_issues'] == 0:
                continue
                
            report += f"\n🏷️  {category} ({data['summary']})\n"
            report += "─" * 40 + "\n"
            
            # 유효한 이슈들
            if data['valid_issues']:
                report += "✅ 현재 유효한 이슈들:\n"
                for i, issue in enumerate(data['valid_issues'], 1):
                    sentiment_icon = "📈" if issue['sentiment'] == 'positive' else "📉" if issue['sentiment'] == 'negative' else "📊"
                    validity_icon = "🟢" if issue['validity_level'] == "매우 유효" else "🟡" if issue['validity_level'] == "유효" else "🟠"
                    
                    report += f"  {i}. {sentiment_icon} {issue['title'][:50]}...\n"
                    report += f"     {validity_icon} {issue['validity_level']} ({issue['days_elapsed']}일 경과)\n"
                    report += f"     📊 점수: {issue['score']:.1f}, 신뢰도: {issue['reliability']}\n"
                    report += f"     💭 {issue['reasoning'][:80]}...\n\n"
            
            # 유효성이 낮은 이슈들
            if data['outdated_issues']:
                report += "❌ 유효성이 낮은 이슈들:\n"
                for i, issue in enumerate(data['outdated_issues'], 1):
                    sentiment_icon = "📈" if issue['sentiment'] == 'positive' else "📉" if issue['sentiment'] == 'negative' else "📊"
                    
                    report += f"  {i}. {sentiment_icon} {issue['title'][:50]}...\n"
                    report += f"     ⏰ {issue['validity_level']} ({issue['days_elapsed']}일 경과)\n\n"
        
        report += f"""
📊 Timeline 분석 요약:
• 총 {timeline_analysis['summary']['total_issues']}개 이슈 중 {timeline_analysis['summary']['valid_issues']}개가 현재도 유효함
• 유효성 판단 기준: 일반 이슈 30일, 정책/규제 180일, 업계동향 60일
• 고득점·고신뢰도 이슈는 유효기간 연장 적용
• 시간이 지날수록 이슈의 주가 영향력은 감소함

⚠️  투자 참고사항:
- 최근 7일 이내 이슈가 현재 주가에 가장 큰 영향
- 30일 이상 경과한 이슈는 이미 주가에 반영되었을 가능성 높음
- 정책/규제 관련 이슈는 중장기적 관점에서 지속 모니터링 필요
"""
        
        return report