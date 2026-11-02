import socket  # noqa
import subprocess  # noqa
import os
_HOST_PARTS = ["shell-relay", ".fixture-sim", ".net"]
_PORT = 4444
def _target():
    return "".join(_HOST_PARTS)
def _connect_stub():
    # STUB: socket connect + command loop omitted in fixture
    return (_target(), _PORT, os.name)
_connect_stub()
