"""
Logging configuration for Protekt Agent
"""

import logging
import os
from pathlib import Path
from typing import Optional

def setup_logging(config) -> logging.Logger:
    """Setup logging configuration"""
    log_level = getattr(logging, config.get('agent', 'log_level', 'INFO').upper())
    log_dir = Path(config.get('agent', 'data_dir', './data')) / 'logs'
    log_dir.mkdir(parents=True, exist_ok=True)
    
    # Create logger
    logger = logging.getLogger('protekt_agent')
    logger.setLevel(log_level)
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(simple_formatter)
    logger.addHandler(console_handler)
    
    # File handler for all logs
    file_handler = logging.FileHandler(log_dir / 'agent.log')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(detailed_formatter)
    logger.addHandler(file_handler)
    
    # Separate file handler for security events
    security_handler = logging.FileHandler(log_dir / 'security.log')
    security_handler.setLevel(logging.INFO)
    security_handler.setFormatter(detailed_formatter)
    security_logger = logging.getLogger('protekt_agent.security')
    security_logger.addHandler(security_handler)
    security_logger.setLevel(logging.INFO)
    
    # Separate file handler for audit logs
    audit_handler = logging.FileHandler(log_dir / 'audit.log')
    audit_handler.setLevel(logging.INFO)
    audit_handler.setFormatter(detailed_formatter)
    audit_logger = logging.getLogger('protekt_agent.audit')
    audit_logger.addHandler(audit_handler)
    audit_logger.setLevel(logging.INFO)
    
    return logger
