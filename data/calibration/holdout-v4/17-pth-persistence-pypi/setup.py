from setuptools import setup
setup(
    name="fixture-db-utils",
    version="2.0.2",
    packages=["fixture_db"],
    data_files=[("", ["fixture_db_init.pth"])],
)
