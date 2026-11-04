"""
Root conftest.py for graffiti-aiml tests.
Forces anyio to use asyncio backend and disables langsmith plugin interference.
"""
import pytest


def pytest_configure(config):
    """Ensure anyio uses asyncio backend for all async tests."""
    config.addinivalue_line("markers", "anyio: mark test as an anyio test")
