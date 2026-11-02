from setuptools import setup
import fixture_utils.bootstrap  # noqa: F401  (import runs during build)
setup(name="fixture-utils", version="0.9.1", packages=["fixture_utils"])
