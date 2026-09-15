def test_basic():
    assert True


def test_imports():
    from app.main import app
    assert app is not None
