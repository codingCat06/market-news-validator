#!/usr/bin/env python3
from datetime import datetime, timedelta
import os
import sys

# 현재 디렉토리를 Python 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from src.news_collector import NewsCollector
from src.economic_indicators import EconomicIndicatorCollector
from src.analyzer import StockNewsAnalyzer
from src.policy_analyzer import PolicyAnalyzer
from src.config import Config


def collect_and_analyze_stock(stock_name, start_date=None, end_date=None):
    if start_date is None:
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    print(f"=== {stock_name} 분석 시작 ===")
    print(f"분석 기간: {start_date} ~ {end_date}")
    print()
    
    # 디렉토리 생성
    Config.ensure_directories()
    print('디렉토리 생성')
    news_collector = NewsCollector()
    print('newscollector 생성')
    indicator_collector = EconomicIndicatorCollector()
    print('indicatorcollector 생성')
    policy_analyzer = PolicyAnalyzer()
    print('policy_analyzer 생성')
    analyzer = StockNewsAnalyzer()
    print('analyzer 생성')

    print("1. 뉴스 수집 중...")
    try:
        news_data = news_collector.collect_news(stock_name, start_date, end_date)
        print(f"뉴스 {len(news_data)}개 수집 완료")
    except Exception as e:
        print(f"뉴스 수집 실패: {e}")
        news_data = []
    
    print("\n2. 경제지표 수집 중...")
    try:
        indicators_data = indicator_collector.collect_all_indicators(start_date, end_date)
        total_indicators = sum(len(data) for data in indicators_data.values())
        print(f"경제지표 {total_indicators}개 데이터 수집 완료")
    except Exception as e:
        print(f"경제지표 수집 실패: {e}")
        indicators_data = {}
    
    print("\n3. 정부 정책 및 정치적 분석...")
    try:
        policy_news = policy_analyzer.collect_policy_news(start_date, end_date, stock_name)
        political_news = policy_analyzer.collect_political_news(start_date, end_date)
        policy_impact = policy_analyzer.analyze_policy_impact(stock_name, policy_news, political_news)
        print(f"정책/정치 뉴스 총 {len(policy_news) + len(political_news)}개 분석 완료")
    except Exception as e:
        print(f"정책 분석 실패: {e}")
        policy_news = []
        political_news = []
        policy_impact = {}
    
    print("\n4. AI 기반 뉴스 분석 중...")
    print("   - GPT-4o mini를 사용한 개별 기사 감정 분석")
    print("   - 중복 기사 제거 및 캐싱 시스템 적용")
    analyzed_news = analyzer.analyze_news_batch(news_data)
    significant_news = analyzer.filter_significant_news(analyzed_news, min_score=0.3)
    
    print(f"분석 완료: 전체 {len(analyzed_news)}개 중 유의미한 뉴스 {len(significant_news)}개")
    
    print("\n5. 고급 분석 및 리포트 생성 중...")
    print("   - GPT-4o를 사용한 호재/악재 유효성 검증")
    print("   - 미래 전망 분석 생성")
    print("   - 정책/정치적 영향 통합 분석")
    report = analyzer.generate_report(stock_name, analyzed_news, indicators_data, start_date, end_date, policy_impact)
    
    output_filename = f"analysis_report_{stock_name}_{end_date}.txt"
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"리포트 저장: {output_filename}")
    print("\n" + "=" * 70)
    print(report)
    
    return {
        'news_data': news_data,
        'analyzed_news': analyzed_news,
        'significant_news': significant_news,
        'indicators_data': indicators_data,
        'report': report
    }


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
            print(f"\n{stock_name} 분석 완료\n" + "="*50 + "\n")
        except Exception as e:
            print(f"{stock_name} 분석 실패: {e}")
            results[stock_name] = None
    
    return results


def main():
    print("국내주식 뉴스 분석기")
    print("=" * 30)
    
    stock_name = input("분석할 종목명을 입력하세요: ").strip()
    if not stock_name:
        print("종목명이 입력되지 않았습니다.")
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
                print("1~90 사이의 숫자를 입력해주세요.")
        except ValueError:
            print("올바른 숫자를 입력해주세요.")
    
    # 날짜 계산
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    
    print(f"\n📅 분석 기간: {start_date} ~ {end_date} ({days_back}일간)")
    print("분석을 시작합니다...")
    
    try:
        result = collect_and_analyze_stock(stock_name, start_date, end_date)
        print("\n분석이 완료되었습니다!")
    except Exception as e:
        print(f"분석 중 오류가 발생했습니다: {e}")


if __name__ == "__main__":
    main()