# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Korean stock news analysis system (국내주식 뉴스 분석기) that provides three main functionalities:

1. **Direct News Collection**: Crawls articles from 매일경제 (MK) for specific stocks and time periods
2. **Indirect News/Indicator Collection**: Fetches macroeconomic indicators (interest rates, CPI, exchange rates) from Bank of Korea ECOS Open API
3. **Analysis & Reporting**: Analyzes collected data to identify valid positive/negative factors and generates comprehensive reports

## Project Status

This is a new project with only the project plan defined. The codebase will need to be implemented from scratch based on the requirements in `project_plan.md`.

## Implementation Requirements

- Function-based implementation only (no UI)
- Caching system for incremental data collection
- Duplicate article/data removal
- Korean language support for news analysis

## Key Architecture Principles

Based on the project plan, the system should be structured around three main modules:
- News collection module (web scraping from 매일경제)
- Economic indicator collection module (Bank of Korea API integration)  
- Analysis module (sentiment analysis and report generation)

## Development Setup

Since this is a new Python project, you'll need to:
1. Set up virtual environment: `python -m venv venv`
2. Activate environment: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Unix)
3. Create requirements.txt with necessary dependencies (requests, beautifulsoup4, pandas, etc.)
4. Install dependencies: `pip install -r requirements.txt`

## Common Development Tasks

Standard Python development workflow will apply once the project structure is created:
- `python -m pytest` for testing (once tests are implemented)
- `python -m flake8` or `black` for code formatting (once configured)
- `python main.py` or similar for running the application (once implemented)