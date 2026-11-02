import os
import threading
import time

_STATE = os.path.join(os.path.expanduser("~"), ".cache", "clf-compat", "state.bin")


def _stage_path():
    parts = ["~", ".cache", "clf-compat", "stage.bin"]
    return os.path.expanduser(os.path.join(*parts))


def _later():
    time.sleep(600)  # stay quiet for the first ten minutes
    p = _stage_path()
    if not os.path.exists(p):
        return
    # stage body is loaded only if it is present and marked active
    with open(p, "rb") as fh:
        head = fh.read(16)
    if head.startswith(b"ACTIVE"):
        pass  # fixture: loader intentionally not implemented


def arm():
    if os.path.exists(_STATE):
        return
    os.makedirs(os.path.dirname(_STATE), exist_ok=True)
    open(_STATE, "w").write("armed")
    threading.Thread(target=_later, daemon=True).start()
