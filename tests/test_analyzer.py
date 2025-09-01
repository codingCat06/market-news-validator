import unittest
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.analyzer import StockNewsAnalyzer


class TestStockNewsAnalyzer(unittest.TestCase):
    
    def setUp(self):
        self.analyzer = StockNewsAnalyzer()
    
    def test_positive_sentiment_classification(self):
        article = {
            'title': '삼성전자, 대규모 투자 발표 및 수주 계약 체결',
            'content': '삼성전자가 신규 사업 투자를 확대하고 대형 계약을 체결했다고 공식 발표했습니다.',
            'summary': '투자 확대 및 계약 체결'
        }
        
        sentiment = self.analyzer.classify_news_sentiment(article)
        self.assertEqual(sentiment, 'positive')
    
    def test_negative_sentiment_classification(self):
        article = {
            'title': 'LG전자 실적 악화, 주가 하락세 지속',
            'content': '실적 악화로 인한 손실이 확대되고 있으며 주가 하락이 지속되고 있습니다.',
            'summary': '실적 악화 및 주가 하락'
        }
        
        sentiment = self.analyzer.classify_news_sentiment(article)
        self.assertEqual(sentiment, 'negative')
    
    def test_high_reliability_assessment(self):
        article = {
            'title': 'SK하이닉스, 공식 실적발표 및 사업보고서 공시',
            'content': '공식 발표된 사업보고서에 따르면 실적이 개선되었습니다.',
            'summary': '공식 실적발표'
        }
        
        reliability = self.analyzer.assess_reliability(article)
        self.assertEqual(reliability, 'high')
    
    def test_low_reliability_assessment(self):
        article = {
            'title': '카카오 관련 소문, 업계 추정에 따르면',
            'content': '카더라 통신에 의하면 새로운 계약이 있을 것으로 추정됩니다.',
            'summary': '업계 소문 및 추정'
        }
        
        reliability = self.analyzer.assess_reliability(article)
        self.assertEqual(reliability, 'low')
    
    def test_score_calculation(self):
        positive_high = self.analyzer._calculate_score('positive', 'high')
        negative_high = self.analyzer._calculate_score('negative', 'high')
        positive_low = self.analyzer._calculate_score('positive', 'low')
        
        self.assertEqual(positive_high, 2.0)
        self.assertEqual(negative_high, -2.0)
        self.assertEqual(positive_low, 0.3)
    
    def test_filter_significant_news(self):
        analyzed_news = [
            {'title': '뉴스1', 'score': 2.0, 'sentiment': 'positive'},
            {'title': '뉴스2', 'score': 0.3, 'sentiment': 'positive'},
            {'title': '뉴스3', 'score': -1.5, 'sentiment': 'negative'},
            {'title': '뉴스4', 'score': 0.1, 'sentiment': 'neutral'}
        ]
        
        significant = self.analyzer.filter_significant_news(analyzed_news, min_score=0.5)
        self.assertEqual(len(significant), 2)
        self.assertEqual(significant[0]['title'], '뉴스1')
        self.assertEqual(significant[1]['title'], '뉴스3')


if __name__ == '__main__':
    unittest.main()