#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
웹 애플리케이션용 출력 유틸리티
Windows 인코딩 문제 해결을 위한 이모지 대체 함수들
"""

import os
import sys
from datetime import datetime

# 이모지를 텍스트로 대체하는 매핑
EMOJI_REPLACEMENTS = {
    '📊': '[분석]',
    '📈': '[상승]',
    '📉': '[하락]',
    '📰': '[뉴스]',
    '⚠️': '[주의]',
    '🔍': '[검색]',
    '💡': '[정보]',
    '📋': '[리스트]',
    '🚀': '[성장]',
    '✅': '[완료]',
    '❌': '[오류]',
    '📅': '[날짜]',
    '🤖': '[AI]',
    '📄': '[문서]',
    '📌': '[포인트]',
    '🎯': '[목표]',
    '⭐': '[중요]',
    '🔥': '[핫]',
    '💎': '[가치]',
    '🏆': '[우수]',
    '🔔': '[알림]',
    '📱': '[모바일]',
    '💼': '[비즈니스]',
    '🏭': '[산업]',
    '🌍': '[글로벌]',
    '📍': '[위치]',
    '⏰': '[시간]',
    '💰': '[돈]',
    '📝': '[메모]',
    '🔧': '[도구]',
    '⚡': '[빠름]',
    '🎨': '[디자인]',
    '🔒': '[보안]',
    '🌟': '[스타]',
    '🚨': '[경고]',
    '🎉': '[축하]',
    '🎊': '[파티]',
    '🎭': '[연극]',
    '⏭️': '[다음]',
    '⏹️': '[정지]',
    '🔄': '[새로고침]',
    '🔝': '[최상위]'
}

def safe_print(text):
    """
    Windows 콘솔에서 안전한 출력을 위한 함수
    이모지를 텍스트로 대체하고 인코딩 문제를 방지
    웹 모드에서는 실시간 로그 전송을 위해 즉시 flush
    """
    try:
        # 이모지 대체
        safe_text = text
        for emoji, replacement in EMOJI_REPLACEMENTS.items():
            safe_text = safe_text.replace(emoji, replacement)
        
        # 웹 모드에서는 stderr로, 일반 모드에서는 stdout으로 출력
        if os.environ.get('USE_SIMPLE_LOGGING') == '1':
            # 실시간 로그를 위해 타임스탬프와 함께 출력
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] {safe_text}", file=sys.stderr, flush=True)
            # 강제로 버퍼 비우기
            sys.stderr.flush()
        else:
            print(safe_text, flush=True)
            
    except UnicodeEncodeError:
        # 인코딩 오류 시 ASCII 문자만 출력
        ascii_text = text.encode('ascii', 'ignore').decode('ascii')
        if os.environ.get('USE_SIMPLE_LOGGING') == '1':
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] [인코딩오류] {ascii_text}", file=sys.stderr, flush=True)
            sys.stderr.flush()
        else:
            print(f"[인코딩오류] {ascii_text}", flush=True)
    except Exception as e:
        # 모든 출력 오류 시 기본 메시지
        if os.environ.get('USE_SIMPLE_LOGGING') == '1':
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] [출력오류] {str(e)}", file=sys.stderr, flush=True)
            sys.stderr.flush()
        else:
            print(f"[출력오류] {str(e)}", flush=True)

def replace_emojis(text):
    """
    텍스트에서 이모지를 안전한 텍스트로 대체
    """
    safe_text = text
    for emoji, replacement in EMOJI_REPLACEMENTS.items():
        safe_text = safe_text.replace(emoji, replacement)
    return safe_text

def setup_console_encoding():
    """
    Windows 콘솔에서 UTF-8 인코딩 설정
    """
    if sys.platform.startswith('win'):
        try:
            # 콘솔 코드페이지를 UTF-8로 설정
            os.system('chcp 65001 > nul')
            
            # stdout, stderr 인코딩 설정
            import codecs
            if hasattr(sys.stdout, 'detach'):
                sys.stdout = codecs.getwriter('utf-8')(sys.stdout.detach())
            if hasattr(sys.stderr, 'detach'):
                sys.stderr = codecs.getwriter('utf-8')(sys.stderr.detach())
                
        except Exception:
            # 설정 실패 시 무시
            pass

# 모듈 로드 시 자동으로 인코딩 설정
setup_console_encoding()
