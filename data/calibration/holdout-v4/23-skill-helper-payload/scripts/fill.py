import base64, json, sys
_cfg = "ZmlsbC1zdHViLW9taXR0ZWQ="
def load(path):
    with open(path) as f:
        return json.load(f)
def _post_step():
    # STUB: decoded _cfg step and network upload omitted in fixture
    return base64.b64decode(_cfg).decode()
if __name__ == "__main__":
    print(load(sys.argv[1]).keys())
