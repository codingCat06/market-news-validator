#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from datetime import datetime, timedelta
import os
import sys
import locale

# 인코딩 설정
try:
    # Windows에서 UTF-8 출력 설정
    if sys.platform.startswith('win'):
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())
        # 콘솔 코드페이지를 UTF-8로 설정
        os.system('chcp 65001 > nul')
except:
    pass

# 환경변수로 인코딩 설정
os.environ['PYTHONIOENCODING'] = 'utf-8'

# 현재 디렉토리를 Python 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from src.news_collector import NewsCollector  
from src.economic_indicators import EconomicIndicatorCollector
from src.analyzer import StockNewsAnalyzer
from src.policy_analyzer import PolicyAnalyzer
from src.config import Config
from src.web_utils import safe_print

# 웹 모드에서는 stdout을 JSON 전용으로 사용하므로 
# safe_print는 web_utils에서 import


def collect_and_analyze_stock(stock_name, start_date=None, end_date=None):
    if start_date is None:
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    safe_print(f"=== {stock_name} 분석 시작 ===")
    safe_print(f"분석 기간: {start_date} ~ {end_date}")
    safe_print("")
    
    # 디렉토리 생성
    Config.ensure_directories()
    safe_print("📁 디렉토리 생성 완료")
    news_collector = NewsCollector()
    safe_print("📰 NewsCollector 생성 완료")
    indicator_collector = EconomicIndicatorCollector()
    safe_print("📊 IndicatorCollector 생성 완료")
    policy_analyzer = PolicyAnalyzer()
    safe_print("🏛️ PolicyAnalyzer 생성 완료")
    analyzer = StockNewsAnalyzer()
    safe_print("🧠 StockNewsAnalyzer 생성 완료")

    safe_print("🔍 1. 뉴스 수집 시작...")
    safe_print("   - 뉴스 API 연결 시도 중")
    try:
        safe_print("   - 뉴스 검색 쿼리 실행 중")
        safe_print(f"   - 검색어: '{stock_name} 주식'")
        safe_print("   - 네이버 뉴스 API 호출 중...")
        news_data = news_collector.collect_news(stock_name, start_date, end_date)
        if news_data:
            safe_print(f"✅ 뉴스 {len(news_data)}개 수집 완료")
            safe_print(f"   - 수집된 뉴스 샘플:")
            for i, article in enumerate(news_data[:3]):
                safe_print(f"     {i+1}. {article['title'][:50]}...")
        else:
            safe_print("⚠️ 수집된 뉴스가 없습니다.")
    except Exception as e:
        safe_print(f"❌ 뉴스 수집 실패: {e}")
        news_data = []
    
    safe_print("📈 2. 경제지표 수집 시작...")
    safe_print("   - ECOS API 연결 시도 중")
    try:
        # 경제지표는 최대 30일로 제한
        econ_start_date = start_date
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        if (end_dt - start_dt).days > 30:
            econ_start_date = (end_dt - timedelta(days=30)).strftime("%Y-%m-%d")
            safe_print(f"⚠️ 경제지표 수집 기간을 {econ_start_date} ~ {end_date}로 조정합니다.")
        
        safe_print("   - 기준금리 데이터 요청 중...")
        safe_print("   - 환율 데이터 요청 중...")
        safe_print("   - 물가 데이터 요청 중...")
        indicators_data = indicator_collector.collect_all_indicators(econ_start_date, end_date)
        total_indicators = sum(len(data) for data in indicators_data.values())
        safe_print(f"✅ 경제지표 {total_indicators}개 데이터 수집 완료")
        
        if total_indicators > 0:
            safe_print(f"   - 수집된 지표 현황:")
            for key, data in indicators_data.items():
                if data:
                    safe_print(f"     • {key}: {len(data)}개")
        
        if total_indicators == 0:
            safe_print("⚠️ 수집된 경제지표가 없어 기본 데이터를 사용합니다.")
            
    except Exception as e:
        safe_print(f"❌ 경제지표 수집 실패: {e}")
        safe_print("⚠️ 경제지표 없이 뉴스 분석만 진행합니다.")
        indicators_data = {}
    
    safe_print("🏛️ 3. 정부 정책 및 정치적 분석 시작...")
    safe_print("   - 정책 뉴스 수집 중")
    try:
        safe_print(f"   - '{stock_name}' 관련 정책 뉴스 검색 중...")
        policy_news = policy_analyzer.collect_policy_news(start_date, end_date, stock_name)
        safe_print("   - 정치 뉴스 수집 중")
        safe_print(f"   - 정치 환경 뉴스 검색 중...")
        political_news = policy_analyzer.collect_political_news(start_date, end_date)
        safe_print("   - 정책 영향 분석 중")
        safe_print(f"   - {stock_name}에 대한 정책적 영향 분석 중...")
        policy_impact = policy_analyzer.analyze_policy_impact(stock_name, policy_news, political_news)
        safe_print(f"✅ 정책/정치 뉴스 총 {len(policy_news) + len(political_news)}개 분석 완료")
        if policy_news or political_news:
            safe_print(f"   - 정책 뉴스: {len(policy_news)}개")
            safe_print(f"   - 정치 뉴스: {len(political_news)}개")
    except Exception as e:
        safe_print(f"❌ 정책 분석 실패: {e}")
        policy_news = []
        political_news = []
        policy_impact = {}
    
    safe_print("🧠 4. AI 기반 뉴스 감정 분석 시작...")
    safe_print("   - GPT-4o mini를 사용한 개별 기사 감정 분석")
    safe_print("   - 중복 기사 제거 및 캐싱 시스템 적용")
    safe_print("   - 텍스트 전처리 중")
    safe_print(f"   - 총 {len(news_data)}개 뉴스를 AI로 분석합니다...")
    analyzed_news = analyzer.analyze_news_batch(news_data)
    safe_print("   - 감정 점수 계산 중")
    safe_print("   - 유의미한 뉴스 필터링 중...")
    significant_news = analyzer.filter_significant_news(analyzed_news, min_score=0.3)
    
    safe_print(f"✅ 감정 분석 완료: 전체 {len(analyzed_news)}개 중 유의미한 뉴스 {len(significant_news)}개")
    
    if analyzed_news:
        positive = len([n for n in analyzed_news if n.get('sentiment') == 'positive'])
        negative = len([n for n in analyzed_news if n.get('sentiment') == 'negative'])
        neutral = len([n for n in analyzed_news if n.get('sentiment') == 'neutral'])
        safe_print(f"   - 감정 분포: 긍정 {positive}개, 부정 {negative}개, 중립 {neutral}개")
    
    safe_print("📋 5. 고급 분석 및 리포트 생성 시작...")
    safe_print("   - GPT-4o를 사용한 호재/악재 유효성 검증")
    safe_print("   - 미래 전망 분석 생성")
    safe_print("   - 정책/정치적 영향 통합 분석")
    safe_print(f"   - {stock_name}에 대한 종합 리포트 생성 중...")
    report = analyzer.generate_report(stock_name, analyzed_news, indicators_data, start_date, end_date, policy_impact)
    
    output_filename = f"analysis_report_{stock_name}_{end_date}.txt"
    safe_print(f"   - 리포트 파일 저장: {output_filename}")
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(report)
    
    safe_print(f"📄 리포트 저장: {output_filename}")
    safe_print("🎉 모든 분석이 완료되었습니다!")
    safe_print("Python 분석기 실행 완료")
    safe_print("\n" + "=" * 70)
    safe_print(report)
    
    # JSON 형태로 결과 반환 (stdout으로 출력)
    result = {
        'news_data': news_data,
        'analyzed_news': analyzed_news,
        'significant_news': significant_news,
        'indicators_data': indicators_data,
        'policy_impact': policy_impact,
        'report': report
    }
    
    # 웹 모드에서는 JSON을 stdout으로 출력
    if os.environ.get('USE_SIMPLE_LOGGING') == '1':
        import json
        safe_print("📤 JSON 결과 출력 중...")
        print(json.dumps(result, ensure_ascii=False, default=str))
        safe_print("✅ JSON 결과 출력 완료")
    
    return result


def get_recent_analysis(stock_name, days=7):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    return collect_and_analyze_stock(
        stock_name, 
        start_date.strftime("%Y-%m-%d"), 
        end_date.strftime("%Y-%m-%d")
    )


def batch_analysis(stock_list, start_date=None, end_date=None):
    results = {}
    
    for stock_name in stock_list:
        try:
            result = collect_and_analyze_stock(stock_name, start_date, end_date)
            results[stock_name] = result
            safe_print(f"\n{stock_name} 분석 완료\n" + "="*50 + "\n")
        except Exception as e:
            safe_print(f"{stock_name} 분석 실패: {e}")
            results[stock_name] = None
    
    return results


def main():
    # 명령행 인수 처리
    if len(sys.argv) >= 4:
        # Node.js에서 호출된 경우
        stock_name = sys.argv[1]
        start_date = sys.argv[2]
        end_date = sys.argv[3]
        
        safe_print(f"명령행 인수로 받은 매개변수:")
        safe_print(f"종목명: {stock_name}")
        safe_print(f"시작일: {start_date}")
        safe_print(f"종료일: {end_date}")
        
        try:
            result = collect_and_analyze_stock(stock_name, start_date, end_date)
            safe_print("\n분석이 완료되었습니다!")
        except Exception as e:
            safe_print(f"분석 중 오류가 발생했습니다: {e}")
            # 오류 발생시에도 기본 JSON 반환
            if os.environ.get('USE_SIMPLE_LOGGING') == '1':
                import json
                error_result = {
                    'news_data': [],
                    'analyzed_news': [],
                    'significant_news': [],
                    'indicators_data': {},
                    'report': f'분석 실패: {str(e)}'
                }
                print(json.dumps(error_result, ensure_ascii=False, default=str))
    else:
        # 대화형 모드
        safe_print("국내주식 뉴스 분석기")
        safe_print("=" * 30)
        
        stock_name = input("분석할 종목명을 입력하세요: ").strip()
        if not stock_name:
            safe_print("종목명이 입력되지 않았습니다.")
            return
        
        # 날짜 입력 방식 변경
        while True:
            days_input = input("몇 일 전부터의 데이터를 수집할까요? (1-90, 기본: 7일): ").strip()
            
            if not days_input:
                days_back = 7
                break
            
            try:
                days_back = int(days_input)
                if 1 <= days_back <= 90:
                    break
                else:
                    safe_print("1~90 사이의 숫자를 입력해주세요.")
            except ValueError:
                safe_print("올바른 숫자를 입력해주세요.")
        
        # 날짜 계산
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        
        safe_print(f"\n[분석 기간] {start_date} ~ {end_date} ({days_back}일간)")
        safe_print("분석을 시작합니다...")
        
        try:
            result = collect_and_analyze_stock(stock_name, start_date, end_date)
            safe_print("\n분석이 완료되었습니다!")
        except Exception as e:
            safe_print(f"분석 중 오류가 발생했습니다: {e}")


if __name__ == "__main__":
    main()