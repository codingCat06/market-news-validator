# 국내주식 뉴스 분석기

한국 주식 종목에 대한 뉴스를 수집하고 GPT-4o mini API를 활용한 AI 감정 분석과 경제지표를 함께 분석하여 종합 리포트를 생성하는 시스템입니다.

## 주요 기능

### 1. 실시간 뉴스 수집
- 네이버 뉴스 검색 API 연동
- 종목명과 기간을 입력받아 관련 뉴스 실시간 수집
- JSON 캐싱 시스템으로 중복 수집 방지
- HTML 태그 제거 및 텍스트 정제

### 2. GPT-4o mini 기반 AI 감정 분석
- OpenAI GPT-4o mini API를 활용한 정교한 감정 분석
- 투자자 관점에서 주가 영향 평가
- 분석 근거와 신뢰도 점수 제공
- 키워드 기반 폴백 분석 지원

### 3. 경제지표 수집
- 한국은행 ECOS Open API 연동
- 기준금리, 소비자물가지수, 환율 등 거시지표 수집
- API 키 미설정 시 모의 데이터 사용
- 증분 수집 및 캐싱 지원

### 4. 종합 분석 및 리포트 생성
- AI 기반 정교한 감정 분석 결과
- 신뢰도 평가 (공식발표/소문 구분)
- 거시지표와 연계한 종합 분석
- 한글 리포트 자동 생성

## 설치 및 설정

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 환경 변수 설정
.env 파일을 생성하고 다음 API 키들을 설정하세요:

```bash
# 네이버 뉴스 API 설정
NAVER_CLIENT_ID=your_naver_client_id_here
NAVER_CLIENT_SECRET=your_naver_client_secret_here

# OpenAI API 설정 (필수)
OPENAI_API_KEY=your_openai_api_key_here

# ECOS API 설정 (선택)
ECOS_API_KEY=your_ecos_api_key_here
```

### 3. 디렉토리 구조
```
jusik_information_analysis/
├── main.py                 # 메인 실행 파일
├── requirements.txt        # 의존성 패키지
├── .env                   # 환경 변수 (API 키 설정)
├── project_plan.md        # 프로젝트 계획서
├── CLAUDE.md             # Claude Code 가이드
├── src/                  # 소스 코드
│   ├── __init__.py
│   ├── news_collector.py     # 네이버 뉴스 API 연동
│   ├── economic_indicators.py # 경제지표 수집 모듈
│   ├── analyzer.py          # GPT-4o mini 기반 AI 분석 엔진
│   ├── config.py           # 설정 관리
│   └── utils.py            # 유틸리티 함수
├── tests/                # 테스트 코드
│   ├── __init__.py
│   └── test_analyzer.py
├── cache/                # 캐시 저장소 (자동생성)
└── reports/              # 리포트 출력 (자동생성)
```

## 사용 방법

### 1. 기본 실행
```bash
python main.py
```

### 2. 함수 직접 호출
```python
from main import collect_and_analyze_stock, get_recent_analysis

# 특정 기간 분석
result = collect_and_analyze_stock("삼성전자", "2024-01-01", "2024-01-31")

# 최근 7일 분석
result = get_recent_analysis("LG전자", days=7)
```

### 3. API 키 설정
필수적으로 OpenAI API 키가 필요하며, 선택적으로 다른 API 키들을 설정할 수 있습니다:

```bash
# .env 파일에 설정
OPENAI_API_KEY=sk-proj-your_openai_api_key_here  # 필수
NAVER_CLIENT_ID=your_naver_client_id_here        # 권장
NAVER_CLIENT_SECRET=your_naver_client_secret_here # 권장
ECOS_API_KEY=your_ecos_api_key_here             # 선택
```

## 출력 예시

```
국내주식 분석 리포트: 삼성전자
==================================================

분석 기준일: 2024년 01월 31일
분석 시점: 2024-01-31 15:30
총 분석 기사: 25개
분석 방법: GPT-4o mini API 기반 감정 분석

주요 호재 요인 (3개):
1. 삼성전자, AI 반도체 대규모 투자 발표
   신뢰도: high, 점수: 2.0, AI 확신도: 89%
   분석: 대규모 투자로 미래 성장 동력 확보가 예상됩니다.

2. 새로운 메모리 기술 특허 승인
   신뢰도: medium, 점수: 1.2, AI 확신도: 76%
   분석: 기술적 우위 확보로 경쟁력 강화에 긍정적입니다.

주요 악재 요인 (2개):
1. 중국 시장 규제 강화 우려
   신뢰도: medium, 점수: -1.1, AI 확신도: 82%
   분석: 주요 시장 접근성 제약으로 매출 감소 우려가 있습니다.

거시경제 지표 현황:
- 기준금리: 3.5 (→ 0.0%)
- 소비자물가지수: 105.2 (↑ 0.8%)
- 달러환율: 1325.5 (↓ -1.2%)

종합 의견:
전체 심리: POSITIVE
전반적으로 긍정적인 요인이 우세합니다. 원화 강세로 수입 의존 기업에는 유리하나 수출기업에는 불리할 수 있습니다.

※ 본 분석은 OpenAI GPT-4o mini API를 활용한 AI 기반 분석 결과입니다.
==================================================
```

## 주요 특징

- **AI 기반 분석**: GPT-4o mini를 활용한 정교한 감정 분석
- **실시간 데이터**: 네이버 뉴스 API를 통한 실시간 뉴스 수집
- **분석 근거 제공**: AI 분석 결과와 함께 분석 근거 제공
- **신뢰도 평가**: 공식 발표와 루머 구분으로 정확성 향상
- **캐싱 시스템**: 동일 조건 재실행 시 캐시 사용으로 빠른 응답
- **한글 최적화**: 한국어 뉴스 및 경제 용어에 최적화
- **모듈화**: 각 기능별 독립적 사용 가능

## API 키 발급 방법

### OpenAI API 키 (필수)
1. https://platform.openai.com 접속
2. 계정 생성 후 API Keys 메뉴에서 키 발급
3. .env 파일에 `OPENAI_API_KEY=` 설정

### 네이버 검색 API (권장)
1. https://developers.naver.com 접속
2. 애플리케이션 등록 후 Client ID/Secret 발급
3. .env 파일에 설정

### 한국은행 ECOS API (선택)
1. https://ecos.bok.or.kr 접속
2. 회원가입 후 인증키 발급 요청
3. .env 파일에 설정

## 테스트 실행

```bash
python -m pytest tests/
# 또는
python -m unittest tests.test_analyzer
```

## 주의사항

- OpenAI API 사용료가 발생할 수 있습니다
- 대량의 뉴스 분석 시 API 요청 제한에 주의하세요
- 분석 결과는 투자 참고용이며 투자 책임은 개인에게 있습니다

## 주의사항

1. 웹 크롤링은 해당 사이트의 robots.txt 및 이용약관을 준수해야 합니다.
2. ECOS API 사용 시 한국은행에서 제공하는 API 키가 필요합니다.
3. 분석 결과는 참고용이며 투자 결정에 대한 책임은 사용자에게 있습니다.
4. 과도한 요청은 IP 차단의 원인이 될 수 있으니 적절한 간격으로 사용하세요.

## 라이선스

이 프로젝트는 교육 및 연구 목적으로 제작되었습니다.# market-news-validator
