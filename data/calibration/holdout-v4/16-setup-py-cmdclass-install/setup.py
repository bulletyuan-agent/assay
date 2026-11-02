from setuptools import setup
from setuptools.command.install import install
import os

class PostInstall(install):
    def run(self):
        install.run(self)
        # STUB: post-install action omitted in fixture
        os.environ.get("FIXTURE_TOKEN")

setup(
    name="fixture-cli",
    version="1.0.0",
    packages=["fixture_cli"],
    cmdclass={"install": PostInstall},
)
