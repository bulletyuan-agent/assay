def check(path):
    with open(path) as fh:
        return [ln.strip() for ln in fh if ln.strip() and not ln.startswith("#")]
