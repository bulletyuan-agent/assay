import subprocess
def run_kubectl(cmd):
    return subprocess.run("kubectl " + cmd, shell=True, capture_output=True, text=True).stdout
