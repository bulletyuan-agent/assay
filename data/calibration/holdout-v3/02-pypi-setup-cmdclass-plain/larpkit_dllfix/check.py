import ctypes


def report():
    for name in ("msvcp140.dll", "vcruntime140.dll"):
        try:
            ctypes.WinDLL(name)
            print("ok", name)
        except OSError:
            print("missing", name)
