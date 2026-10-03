import pytest
from pytest import MonkeyPatch

from app.settings import Settings


@pytest.fixture(autouse=True)
def isolate_owner_configuration(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr("app.main.load_settings", Settings)
